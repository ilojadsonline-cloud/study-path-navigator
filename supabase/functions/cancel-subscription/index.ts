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
  console.log(`[CANCEL-SUB] ${s}${d ? " " + JSON.stringify(d) : ""}`);

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

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    let cancelled = false;
    let provider: string | null = null;
    let accessUntil: string | null = null;
    let userMessage = "";

    // 1) MercadoPago preapproval
    if (mpToken) {
      try {
        const pre = await findActiveMercadoPagoPreapproval(mpToken, [email]);
        if (pre?.preapproval_id) {
          const r = await fetch(
            `https://api.mercadopago.com/preapproval/${pre.preapproval_id}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${mpToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "cancelled" }),
            },
          );
          if (!r.ok) {
            const t = await r.text();
            throw new Error(`MP cancel failed [${r.status}]: ${t}`);
          }
          cancelled = true;
          provider = "mercadopago";
          accessUntil = pre.next_payment_date;
          userMessage = `Sua assinatura foi cancelada. Você continuará tendo acesso até ${formatBR(accessUntil)}.`;
        }
      } catch (e) {
        log("mp cancel error", { e: String(e) });
        throw e;
      }
    }

    // 2) Stripe
    if (!cancelled && stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email, limit: 5 });
        for (const c of customers.data) {
          const subs = await stripe.subscriptions.list({ customer: c.id, limit: 10 });
          const active = subs.data.find(
            (s: any) => (s.status === "active" || s.status === "trialing") && !s.cancel_at_period_end,
          );
          if (active) {
            const updated = await stripe.subscriptions.update(active.id, {
              cancel_at_period_end: true,
            });
            const endTs = (updated as any).current_period_end ?? updated.items?.data?.[0]?.current_period_end;
            accessUntil = endTs ? new Date(endTs * 1000).toISOString() : null;
            cancelled = true;
            provider = "stripe";
            userMessage = `Sua assinatura foi cancelada. Você continuará tendo acesso até ${formatBR(accessUntil)}.`;
            break;
          }
        }
      } catch (e) {
        log("stripe cancel error", { e: String(e) });
        throw e;
      }
    }

    // 3) Avulso (Pix/Boleto) — nothing to cancel
    if (!cancelled && mpToken) {
      try {
        const payment = await findApprovedMercadoPagoPayment(mpToken, [email]);
        if (payment) {
          provider = "mercadopago_avulso";
          accessUntil = payment.subscription_end;
          userMessage = `Você não possui renovação automática. Seu acesso expira em ${formatBR(accessUntil)} e não haverá cobranças futuras.`;
          return json({ success: true, accessUntil, provider, message: userMessage, oneoff: true });
        }
      } catch (e) {
        log("mp payment lookup error", { e: String(e) });
      }
    }

    if (!cancelled) {
      return json(
        { success: false, error: "Nenhuma assinatura ativa encontrada para cancelar." },
        404,
      );
    }

    // Update app_metadata: keep access until end of paid period
    try {
      await adminClient.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...meta,
          subscription_cancelled_at: new Date().toISOString(),
          subscription_status: "cancelled",
          subscription_access_until: accessUntil,
          trial_blocked: false,
        } as any,
      } as any);
    } catch (e) {
      log("metadata update warning", { e: String(e) });
    }

    // Log payment_event (also serves as admin notification via histórico)
    try {
      await adminClient.from("payment_events").insert({
        user_id: user.id,
        email,
        gateway: provider,
        action_taken: "subscription_cancelled",
        status: "cancelled",
        payment_type: "subscription",
        processed_at: new Date().toISOString(),
        raw_payload: {
          access_until: accessUntil,
          cancelled_by: "user",
          user_name: meta.nome ?? null,
        },
      });
    } catch (e) {
      log("payment_events insert warning", { e: String(e) });
    }

    return json({ success: true, accessUntil, provider, message: userMessage });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    log("ERROR", { m });
    return new Response(JSON.stringify({ success: false, error: m }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: m.includes("Authentication") ? 401 : 500,
    });
  }
});

function formatBR(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
