// Webhook público do MercadoPago — processa pagamentos e assinaturas aprovados,
// reativa o acesso do usuário no Supabase e registra evento em payment_events.
//
// URL pública: https://<project-ref>.supabase.co/functions/v1/mercadopago-webhook
//
// Assinatura: validada via header `x-signature` + `x-request-id` quando o segredo
// MERCADOPAGO_WEBHOOK_SECRET estiver configurado. Se não houver segredo, aceita
// (modo permissivo para configuração inicial), mas registra warning.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

const ACCESS_WINDOW_DAYS = 30;
const PLAN_AMOUNT = 99.99;

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MP-WEBHOOK] ${step}${d}`);
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyMpSignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  // x-signature é formato: "ts=...,v1=..."
  const parts = Object.fromEntries(
    xSignature.split(",").map((kv) => kv.trim().split("=").map((s) => s.trim())) as [string, string][],
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return expected === v1;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v && v.includes("@") ? v : null;
}

function extractEmailFromExternalRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  // formatos: choa-paid-{ts}-{email} | choa-paid-{ts}-{planoSlug}::{email}
  const match = ref.match(/choa-(?:paid|sub)-\d+-(.+)$/i);
  if (match) {
    const tail = match[1];
    const withPlan = tail.split("::");
    return normalizeEmail(withPlan.length > 1 ? withPlan[1] : tail);
  }
  if (ref.includes("@")) return normalizeEmail(ref);
  return null;
}

function extractPlanoFromExternalRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const match = ref.match(/choa-(?:paid|sub)-\d+-([^:]+)::/i);
  return match ? match[1] : null;
}

// Concede acesso aos cursos vinculados ao plano pago
async function grantCursoAccess(
  admin: any, userId: string, planoSlug: string | null, expiresAtIso: string, origem: string,
): Promise<void> {
  try {
    if (!planoSlug) {
      throw new Error("plano_slug ausente no pagamento; acesso não concedido");
    }
    const slug = planoSlug;
    const { data: plano, error: planoError } = await admin
      .from("planos").select("slug, cursos_slugs").eq("slug", slug).maybeSingle();
    if (planoError) throw planoError;
    if (!plano?.cursos_slugs?.length) {
      throw new Error(`plano inválido ou sem curso vinculado: ${slug}`);
    }
    const cursosSlugs: string[] = plano.cursos_slugs;
    const { data: cursos, error: cursosError } = await admin
      .from("cursos").select("id, slug").in("slug", cursosSlugs);
    if (cursosError) throw cursosError;
    if (!cursos?.length) throw new Error(`nenhum curso encontrado para o plano: ${slug}`);
    for (const c of cursos || []) {
      const { error: accessError } = await admin.from("acessos_curso").upsert({
        user_id: userId,
        curso_id: c.id,
        plano_slug: slug,
        origem,
        starts_at: new Date().toISOString(),
        expires_at: expiresAtIso,
        ativo: true,
      }, { onConflict: "user_id,curso_id" });
      if (accessError) throw accessError;
    }
    log("curso access granted", { userId, slug, cursos: (cursos || []).map((c: any) => c.slug) });
  } catch (e) {
    log("grantCursoAccess failed", { error: String(e) });
  }
}

async function findUserByEmail(admin: any, email: string): Promise<any | null> {
  let page = 1;
  while (page <= 30) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u: any) => (u.email || "").toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) break;
    page += 1;
  }
  // fallback: profile pode ter email diferente do auth
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle();
  if (profile?.user_id) {
    const { data: u } = await admin.auth.admin.getUserById(profile.user_id);
    return u?.user ?? null;
  }
  return null;
}

async function reactivateUser(
  admin: any, user: any, expiresAtIso: string,
  source: "mercadopago" | "mercadopago_avulso" = "mercadopago",
  paymentTypeLabel?: string,
): Promise<void> {
  await admin.auth.admin.updateUserById(user.id, {
    ban_duration: "none",
    app_metadata: {
      ...(user.app_metadata || {}),
      trial_blocked: false,
      block_reason: null,
      reactivated_at: new Date().toISOString(),
      access_expires_at: expiresAtIso,
      payment_source: source,
      payment_type: paymentTypeLabel ?? (user.app_metadata?.payment_type ?? null),
    },
  } as any);
}

async function recordEvent(admin: any, payload: Record<string, unknown>): Promise<void> {
  try {
    await admin.from("payment_events").insert(payload);
  } catch (e) {
    log("payment_events insert failed", { error: String(e) });
  }
}

async function fetchMpPayment(token: string, paymentId: string): Promise<any | null> {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    log("MP payment fetch failed", { status: r.status, paymentId });
    return null;
  }
  return await r.json();
}

async function fetchMpPreapproval(token: string, preapprovalId: string): Promise<any | null> {
  const r = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    log("MP preapproval fetch failed", { status: r.status, preapprovalId });
    return null;
  }
  return await r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Healthcheck — MP exige que a URL retorne 200
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "mercadopago-webhook" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  log("notification received", { type: body?.type, action: body?.action, dataId: body?.data?.id });

  const dataId = body?.data?.id ? String(body.data.id) : "";
  const type: string = body?.type || body?.topic || "";

  // Validação de assinatura — obrigatória. Sem segredo configurado, rejeitamos.
  const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!webhookSecret) {
    log("ERROR: MERCADOPAGO_WEBHOOK_SECRET não configurado — rejeitando requisição");
    return new Response(JSON.stringify({ error: "webhook secret not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (dataId) {
    const ok = await verifyMpSignature(req, dataId, webhookSecret);
    if (!ok) {
      log("invalid signature");
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotência: ignora event_id já processado com sucesso.
    try {
      const { data: existing } = await admin
        .from("payment_events")
        .select("id")
        .eq("payment_id", String(dataId))
        .eq("gateway", "mercadopago")
        // `user_not_found` não é conclusão: o pagamento pode ter ocorrido antes
        // do cadastro e um reenvio posterior precisa tentar conceder o acesso.
        .eq("action_taken", "access_reactivated")
        .limit(1)
        .maybeSingle();
      if (existing) {
        log("duplicate event ignored", { dataId });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      log("idempotency check warning", { error: String(e) });
    }
  }

  // Responde 200 imediatamente; processamento segue no background.
  const processing = (async () => {
    try {
      const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!mpToken) {
        log("missing MERCADOPAGO_ACCESS_TOKEN");
        return;
      }
      if (!dataId) {
        log("no data.id, skipping");
        return;
      }

      // ───── Pagamento avulso ─────
      if (type === "payment" || type === "" || type === "merchant_order") {
        const paymentTopic = type === "payment" || type === "";
        if (!paymentTopic) return;

        const payment = await fetchMpPayment(mpToken, dataId);
        if (!payment) return;

        const status = payment.status as string;
        const amount = Number(payment.transaction_amount || 0);
        const paymentMethod = payment.payment_type_id || payment.payment_method_id || null;

        const email =
          normalizeEmail(payment?.metadata?.email) ||
          normalizeEmail(payment?.payer?.email) ||
          extractEmailFromExternalRef(payment?.external_reference);

        log("payment fetched", { status, amount, email, paymentMethod });

        if (status !== "approved") {
          await recordEvent(admin, {
            email, payment_id: String(payment.id), amount, payment_type: paymentMethod,
            gateway: "mercadopago", status, action_taken: "ignored_not_approved",
            raw_payload: payment,
          });
          return;
        }

        if (amount > 0 && amount + 0.01 < PLAN_AMOUNT) {
          await recordEvent(admin, {
            email, payment_id: String(payment.id), amount, payment_type: paymentMethod,
            gateway: "mercadopago", status, action_taken: "ignored_low_amount",
            raw_payload: payment,
          });
          return;
        }

        if (!email) {
          await recordEvent(admin, {
            email: null, payment_id: String(payment.id), amount, payment_type: paymentMethod,
            gateway: "mercadopago", status, action_taken: "ignored_no_email", raw_payload: payment,
          });
          return;
        }

        const user = await findUserByEmail(admin, email);
        const planoSlugForDays = (payment?.metadata?.plano_slug as string | undefined)
          || (payment?.metadata?.plan as string | undefined)
          || extractPlanoFromExternalRef(payment?.external_reference);
        const planDays = await resolvePlanDays(admin, planoSlugForDays ?? null, payment?.metadata?.days);
        const expiresAt = new Date(Date.now() + planDays * 24 * 3600 * 1000).toISOString();
        const isAvulso = payment?.metadata?.payment_type === "avulso";
        const source = isAvulso ? "mercadopago_avulso" : "mercadopago";
        const typeLabel = isAvulso ? "pix_ou_boleto" : (paymentMethod || null);

        if (user) {
          await reactivateUser(admin, user, expiresAt, source, typeLabel);
          await grantCursoAccess(admin, user.id, planoSlugForDays ?? null, expiresAt, source);
          try {
            await admin.from("trial_usage").upsert(
              {
                email, user_id: user.id, provider: "mercadopago",
                converted_to_paid: true, trial_ends_at: expiresAt,
              },
              { onConflict: "email" },
            );
          } catch { /* ignore */ }
        }

        await recordEvent(admin, {
          user_id: user?.id ?? null, email, payment_id: String(payment.id),
          amount, payment_type: paymentMethod, gateway: "mercadopago", status,
          action_taken: user ? "access_reactivated" : "user_not_found", raw_payload: payment,
        });
        return;
      }

      // ───── Assinatura recorrente ─────
      if (type === "subscription_preapproval" || type === "preapproval") {
        const sub = await fetchMpPreapproval(mpToken, dataId);
        if (!sub) return;

        const status = sub.status as string;
        const email = normalizeEmail(sub?.payer_email);
        log("preapproval fetched", { status, email });

        if (status !== "authorized") {
          await recordEvent(admin, {
            email, payment_id: String(sub.id), amount: Number(sub?.auto_recurring?.transaction_amount || 0),
            payment_type: "subscription", gateway: "mercadopago", status,
            action_taken: "ignored_not_authorized", raw_payload: sub,
          });
          return;
        }

        if (!email) {
          await recordEvent(admin, {
            email: null, payment_id: String(sub.id), amount: 0, payment_type: "subscription",
            gateway: "mercadopago", status, action_taken: "ignored_no_email", raw_payload: sub,
          });
          return;
        }

        const user = await findUserByEmail(admin, email);
        const nextPayment = sub?.next_payment_date ? new Date(sub.next_payment_date).toISOString() : null;
        const expiresAt = nextPayment ?? new Date(Date.now() + ACCESS_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

        if (user) {
          await reactivateUser(admin, user, expiresAt);
          await grantCursoAccess(
            admin, user.id, extractPlanoFromExternalRef(sub?.external_reference),
            expiresAt, "mercadopago",
          );
          try {
            await admin.from("trial_usage").upsert(
              { email, user_id: user.id, provider: "mercadopago", converted_to_paid: true },
              { onConflict: "email" },
            );
          } catch { /* ignore */ }
        }

        await recordEvent(admin, {
          user_id: user?.id ?? null, email, payment_id: String(sub.id),
          amount: Number(sub?.auto_recurring?.transaction_amount || 0),
          payment_type: "subscription", gateway: "mercadopago", status,
          action_taken: user ? "access_reactivated" : "user_not_found", raw_payload: sub,
        });
        return;
      }

      log("type not handled", { type });
    } catch (e) {
      log("processing error", { error: e instanceof Error ? e.message : String(e) });
    }
  })();

  // Fire-and-forget no Deno: aguardamos rapidamente para não derrubar o response
  // (background tasks não são suportadas em todos runtimes — usamos waitUntil-like via Promise sem await)
  // @ts-ignore EdgeRuntime global is available in Supabase
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    (EdgeRuntime as any).waitUntil(processing);
  } else {
    // fallback: awaitar para garantir processamento (MP permite até ~22s)
    await processing;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
