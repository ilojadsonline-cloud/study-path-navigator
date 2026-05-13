// Função agendada (cron) — bloqueia usuários com access_expires_at vencido
// e que NÃO possuem assinatura recorrente ativa (Stripe ou MP preapproval).
// Admins nunca são bloqueados.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { findActiveMercadoPagoPreapproval } from "../_shared/mercadopago-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const log = (s: string, d?: any) => console.log(`[BLOCK-EXPIRED] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

async function hasActiveStripe(stripe: any, email: string): Promise<boolean> {
  try {
    for (const e of new Set([email, email.toLowerCase()])) {
      const customers = await stripe.customers.list({ email: e, limit: 3 });
      for (const c of customers.data) {
        const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 5 });
        if (subs.data.some((s: any) => s.status === "active" || s.status === "trialing")) return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: requer CRON_SECRET (header Authorization: Bearer <secret> ou x-cron-secret).
  // Falha fechada se segredo não configurado.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    log("CRON_SECRET not configured — rejecting");
    return new Response(JSON.stringify({ error: "cron secret not configured" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (req.headers.get("x-cron-secret") ?? "");
  if (provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

  const now = Date.now();
  let scanned = 0, blocked = 0, kept = 0;

  try {
    const { data: profiles } = await admin
      .from("profiles").select("user_id, email").limit(2000);

    const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const adminSet = new Set((roles || []).map((r: any) => r.user_id));

    for (const p of profiles || []) {
      if (adminSet.has(p.user_id)) continue;
      scanned += 1;
      try {
        const { data: au } = await admin.auth.admin.getUserById(p.user_id);
        const u: any = au?.user;
        if (!u) continue;
        const bannedUntil = u.banned_until as string | undefined;
        const isBanned = bannedUntil ? new Date(bannedUntil) > new Date() : false;
        if (isBanned) continue;

        const meta = u.app_metadata || {};
        const expiresAtIso = meta.access_expires_at as string | undefined;
        if (!expiresAtIso) continue;
        const expMs = new Date(expiresAtIso).getTime();
        if (!Number.isFinite(expMs) || expMs >= now) continue;

        // expirado — verificar se há recorrência ativa
        const email = (p.email || u.email || "").toLowerCase();
        let hasActive = false;
        if (mpToken && email) {
          const mp = await findActiveMercadoPagoPreapproval(mpToken, [email]);
          if (mp) hasActive = true;
        }
        if (!hasActive && stripe && email) {
          hasActive = await hasActiveStripe(stripe, email);
        }

        if (hasActive) { kept += 1; continue; }

        await admin.auth.admin.updateUserById(p.user_id, {
          ban_duration: "876000h",
          app_metadata: {
            ...meta,
            trial_blocked: true,
            block_reason: "acesso_expirado_90_dias",
            blocked_at: new Date().toISOString(),
          },
        } as any);
        blocked += 1;
        log("blocked", { user_id: p.user_id, email });
      } catch (e) {
        log("user error", { user_id: p.user_id, err: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, scanned, blocked, kept }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
