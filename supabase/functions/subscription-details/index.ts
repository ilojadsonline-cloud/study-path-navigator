import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  findApprovedMercadoPagoPayment,
  findActiveMercadoPagoPreapproval,
} from "../_shared/mercadopago-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: any) =>
  console.log(`[SUB-DETAILS] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user?.email) throw new Error("Authentication failed");
    const user = userData.user;
    const email = user.email!.toLowerCase();
    const meta = (user.app_metadata ?? {}) as Record<string, any>;
    const bannedUntil = (user as any).banned_until ?? null;
    const isBlocked =
      meta.trial_blocked === true ||
      (bannedUntil && new Date(bannedUntil).getTime() > Date.now());

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    let result: any = {
      status: "none",
      provider: null,
      paymentMethod: null,
      planName: "Método CHOA — Acesso Trimestral",
      planPrice: "R$ 89,90 a cada 3 meses",
      startDate: null,
      endDate: null,
      nextBillingDate: null,
      preapprovalId: null,
      stripeSubscriptionId: null,
      canCancel: false,
      cancelledAt: meta.subscription_cancelled_at ?? null,
      isBlocked,
    };

    // 1) MercadoPago preapproval (recurring card)
    if (mpToken) {
      try {
        const pre = await findActiveMercadoPagoPreapproval(mpToken, [email]);
        if (pre) {
          result = {
            ...result,
            status: pre.is_trial ? "trial" : "active_recurring",
            provider: "mercadopago",
            paymentMethod: "Cartão de crédito (renovação automática)",
            nextBillingDate: pre.next_payment_date,
            endDate: pre.next_payment_date,
            preapprovalId: pre.preapproval_id,
            canCancel: !meta.subscription_cancelled_at,
          };
          return json(result);
        }
      } catch (e) {
        log("mp preapproval error", { e: String(e) });
      }

      // 2) MP one-off (Pix/Boleto)
      try {
        const payment = await findApprovedMercadoPagoPayment(mpToken, [email]);
        if (payment) {
          result = {
            ...result,
            status: "active_oneoff",
            provider: "mercadopago_avulso",
            paymentMethod: "Pix ou Boleto (sem renovação automática)",
            startDate: payment.paid_at,
            endDate: payment.subscription_end,
            canCancel: false,
          };
          return json(result);
        }
      } catch (e) {
        log("mp payment error", { e: String(e) });
      }
    }

    // 3) Stripe subscription
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email, limit: 5 });
        for (const c of customers.data) {
          const subs = await stripe.subscriptions.list({ customer: c.id, limit: 10 });
          const active = subs.data.find((s: any) => s.status === "active" || s.status === "trialing");
          if (active) {
            const endTs = (active as any).current_period_end ?? active.items?.data?.[0]?.current_period_end;
            const endIso = endTs ? new Date(endTs * 1000).toISOString() : null;
            result = {
              ...result,
              status: active.status === "trialing" ? "trial" : "active_recurring",
              provider: "stripe",
              paymentMethod: "Cartão (Stripe — renovação automática)",
              nextBillingDate: endIso,
              endDate: endIso,
              stripeSubscriptionId: active.id,
              canCancel: !active.cancel_at_period_end,
            };
            if (active.cancel_at_period_end) result.cancelledAt = result.cancelledAt ?? new Date().toISOString();
            return json(result);
          }
        }
      } catch (e) {
        log("stripe error", { e: String(e) });
      }
    }

    if (isBlocked) result.status = "blocked";
    return json(result);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    log("ERROR", { m });
    return new Response(JSON.stringify({ error: m }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: m.includes("Authentication") ? 401 : 500,
    });
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
