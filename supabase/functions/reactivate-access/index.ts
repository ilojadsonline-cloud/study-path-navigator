// Reativa o acesso de um usuário banido (teste expirado) quando há pagamento
// confirmado no Stripe ou Mercado Pago para o email informado.
// Pública (sem JWT) — necessária porque o usuário banido não consegue logar
// para chamar check-subscription.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { findApprovedMercadoPagoPayment } from "../_shared/mercadopago-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRIPE_MIN_PAID_CENTS = 5000; // R$ 50,00
const ACCESS_WINDOW_DAYS = 90;

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REACTIVATE-ACCESS] ${step}${d}`);
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v && v.includes("@") ? v : null;
}

async function findStripePaidCustomer(stripe: any, emails: string[]): Promise<{ found: boolean; customerId?: string; subscriptionEnd?: string }> {
  const sinceSec = Math.floor((Date.now() - ACCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000);

  for (const email of emails) {
    // Stripe email search is case-sensitive; tenta variantes
    const variants = Array.from(new Set([email, email.toLowerCase()]));
    for (const variant of variants) {
      const customers = await stripe.customers.list({ email: variant, limit: 5 });
      for (const c of customers.data) {
        // 1) Active/trialing subscription?
        const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 10 });
        const active = subs.data.find((s: any) => s.status === "active" || s.status === "trialing");
        if (active) {
          let endIso: string | undefined;
          const endTs = active.current_period_end ?? active.items?.data?.[0]?.current_period_end;
          if (endTs) endIso = new Date(Number(endTs) * 1000).toISOString();
          return { found: true, customerId: c.id, subscriptionEnd: endIso };
        }
        // 2) PaymentIntent succeeded ≥ R$50 nos últimos 90d?
        const pis = await stripe.paymentIntents.list({ customer: c.id, limit: 20 });
        const paid = pis.data.find(
          (pi: any) => pi.status === "succeeded" && pi.amount >= STRIPE_MIN_PAID_CENTS && pi.created >= sinceSec,
        );
        if (paid) {
          const endIso = new Date((paid.created + ACCESS_WINDOW_DAYS * 24 * 60 * 60) * 1000).toISOString();
          return { found: true, customerId: c.id, subscriptionEnd: endIso };
        }
      }
    }
  }
  return { found: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const inputEmail = normalizeEmail(body?.email);
    if (!inputEmail) {
      return new Response(JSON.stringify({ error: "Email inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log("start", { email: inputEmail });

    // 1) Localizar usuário no auth pelo email (paginar até encontrar)
    let targetUser: any = null;
    let page = 1;
    while (page <= 20 && !targetUser) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      targetUser = data.users.find((u: any) => (u.email || "").toLowerCase() === inputEmail) || null;
      if (data.users.length < 200) break;
      page += 1;
    }

    // 2) Coletar emails para busca (auth + profile)
    const emails = new Set<string>([inputEmail]);
    if (targetUser?.email) emails.add(targetUser.email.toLowerCase());
    if (targetUser?.id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("user_id", targetUser.id)
        .maybeSingle();
      if (profile?.email) emails.add(profile.email.toLowerCase());
    }
    const emailList = Array.from(emails);

    // 3) Verificar Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let paymentFound = false;
    let provider: "stripe" | "mercadopago" | null = null;
    let subscriptionEnd: string | null = null;
    let stripeCustomerId: string | null = null;

    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const stripeRes = await findStripePaidCustomer(stripe, emailList);
      if (stripeRes.found) {
        paymentFound = true;
        provider = "stripe";
        subscriptionEnd = stripeRes.subscriptionEnd ?? null;
        stripeCustomerId = stripeRes.customerId ?? null;
        log("Stripe payment found", { customerId: stripeCustomerId, end: subscriptionEnd });
      }
    }

    // 4) Mercado Pago fallback
    if (!paymentFound) {
      const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (mpToken) {
        const mp = await findApprovedMercadoPagoPayment(mpToken, emailList);
        if (mp) {
          paymentFound = true;
          provider = "mercadopago";
          subscriptionEnd = mp.subscription_end;
          log("MP payment found", { paymentId: mp.payment_id, end: subscriptionEnd });
        }
      }
    }

    if (!paymentFound) {
      log("no payment found", { emails: emailList });
      return new Response(
        JSON.stringify({
          reactivated: false,
          message:
            "Não encontramos um pagamento ativo neste email no Stripe ou Mercado Pago. Verifique se você usou outro email no pagamento ou entre em contato com o suporte.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5) Reativar usuário (se existir)
    if (targetUser?.id) {
      try {
        await admin.auth.admin.updateUserById(targetUser.id, {
          ban_duration: "none",
          app_metadata: { trial_blocked: false, reactivated_at: new Date().toISOString() } as any,
        } as any);
        log("user unbanned", { userId: targetUser.id });
      } catch (e) {
        log("unban failed", { error: String(e) });
      }

      // Marca trial como convertido para evitar bloqueio futuro
      try {
        await admin.from("trial_usage").upsert(
          {
            email: inputEmail,
            user_id: targetUser.id,
            provider: provider ?? "stripe",
            stripe_customer_id: stripeCustomerId,
            converted_to_paid: true,
          },
          { onConflict: "email" },
        );
      } catch (e) {
        log("trial_usage upsert warning", { error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        reactivated: true,
        provider,
        subscription_end: subscriptionEnd,
        had_user: Boolean(targetUser?.id),
        message: targetUser?.id
          ? "Pagamento confirmado! Seu acesso foi reativado. Faça login normalmente."
          : "Pagamento confirmado, mas não encontramos um cadastro com este email. Faça seu cadastro usando o mesmo email do pagamento.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
