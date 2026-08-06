import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function extractPlanoSlug(reference: unknown): string | null {
  if (typeof reference !== "string") return null;
  const match = reference.match(/choa-(?:paid|sub)-\d+-([^:]+)::/i);
  return match?.[1]?.trim() || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const emails = new Set<string>();
    const authEmail = normalizeEmail(user.email);
    if (authEmail) emails.add(authEmail);

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();
    const profileEmail = normalizeEmail(profile?.email);
    if (profileEmail) emails.add(profileEmail);

    if (emails.size === 0) {
      return new Response(JSON.stringify({ reconciled: false, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: events, error: eventsError } = await admin
      .from("payment_events")
      .select("id, email, status, processed_at, raw_payload")
      .eq("gateway", "mercadopago")
      .in("status", ["approved", "authorized"])
      .in("email", Array.from(emails))
      .order("processed_at", { ascending: false })
      .limit(20);
    if (eventsError) throw eventsError;

    // Alguns eventos chegam sem a coluna `email` preenchida (ex.: preapproval).
    // Nesses casos o e-mail está embutido no external_reference do pagamento.
    const extraEvents: any[] = [];
    for (const email of emails) {
      const { data: byRef } = await admin
        .from("payment_events")
        .select("id, email, status, processed_at, raw_payload")
        .eq("gateway", "mercadopago")
        .in("status", ["approved", "authorized"])
        .is("email", null)
        .ilike("raw_payload->>external_reference", `%${email}%`)
        .order("processed_at", { ascending: false })
        .limit(10);
      if (byRef?.length) extraEvents.push(...byRef);
    }

    const allEvents = [...(events ?? []), ...extraEvents].sort(
      (a, b) => new Date(String(b.processed_at)).getTime() - new Date(String(a.processed_at)).getTime(),
    );


    const grants: string[] = [];
    for (const event of allEvents) {
      const raw = event.raw_payload as Record<string, unknown> | null;
      const planoSlug = extractPlanoSlug(raw?.external_reference)
        ?? (typeof raw?.metadata === "object" && raw.metadata !== null
          ? String((raw.metadata as Record<string, unknown>).plano_slug ?? (raw.metadata as Record<string, unknown>).plan ?? "")
          : null);
      if (!planoSlug) continue;

      const { data: plano } = await admin
        .from("planos")
        .select("slug, dias_acesso, cursos_slugs, ativo")
        .eq("slug", planoSlug)
        .eq("ativo", true)
        .maybeSingle();
      if (!plano?.cursos_slugs?.length) continue;

      const paidAtValue = raw?.date_approved ?? raw?.date_created ?? event.processed_at;
      const paidAt = new Date(String(paidAtValue));
      if (!Number.isFinite(paidAt.getTime())) continue;
      const expiresAt = new Date(paidAt.getTime() + Number(plano.dias_acesso) * 86_400_000);
      if (expiresAt.getTime() <= Date.now()) continue;

      const { data: cursos } = await admin
        .from("cursos")
        .select("id, slug")
        .in("slug", plano.cursos_slugs);

      for (const curso of cursos ?? []) {
        // Os eventos vêm do mais recente para o mais antigo; não permita que
        // uma compra antiga encurte um acesso já reconciliado nesta execução.
        if (grants.includes(curso.slug)) continue;

        // Nunca encurtar um acesso já existente (ex.: concedido manualmente
        // pelo admin ou por um plano mais longo).
        const { data: existente } = await admin
          .from("acessos_curso")
          .select("expires_at, ativo")
          .eq("user_id", user.id)
          .eq("curso_id", curso.id)
          .maybeSingle();
        const existenteMs = existente?.expires_at ? new Date(existente.expires_at).getTime() : null;
        if (existente?.ativo && (existente.expires_at === null || (existenteMs ?? 0) >= expiresAt.getTime())) {
          grants.push(curso.slug);
          continue;
        }

        const { error: accessError } = await admin.from("acessos_curso").upsert({
          user_id: user.id,
          curso_id: curso.id,
          plano_slug: plano.slug,
          origem: "mercadopago_reconciliado",
          starts_at: paidAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          ativo: true,
        }, { onConflict: "user_id,curso_id" });
        if (accessError) throw accessError;
        grants.push(curso.slug);
      }

    }

    return new Response(JSON.stringify({ reconciled: grants.length > 0, cursos: [...new Set(grants)] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[RECONCILE-MP-COURSE-ACCESS]", error);
    return new Response(JSON.stringify({ error: "reconciliation_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});