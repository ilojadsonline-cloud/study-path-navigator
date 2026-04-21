import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-MP] ${step}${detailsStr}`);
};

// Verifica se um email tem preapproval autorizado/ativo no Mercado Pago
async function checkPreapprovalActive(accessToken: string, email: string) {
  const searchUrl = `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(email)}&limit=20`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { active: false, results: [] as any[] };
  const data = await res.json();
  const results = (data?.results || []) as any[];
  // status válidos para acesso: authorized
  // pending = ainda não autorizou; cancelled/paused = sem acesso
  const activeOne = results.find((r) => r?.status === "authorized");
  return { active: !!activeOne, sub: activeOne, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    const body = await req.json();
    const { preapproval_id, recovery_email } = body || {};

    if (!preapproval_id && !recovery_email) {
      return new Response(JSON.stringify({ error: "preapproval_id ou recovery_email é obrigatório" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Modo 1: por preapproval_id direto (retorno do checkout MP)
    if (preapproval_id) {
      logStep("Verificando preapproval direto", { preapproval_id });
      const res = await fetch(`https://api.mercadopago.com/preapproval/${preapproval_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        logStep("Preapproval não encontrado");
        return new Response(JSON.stringify({ paid: false, reason: "not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      const data = await res.json();
      const paid = data?.status === "authorized";
      logStep("Resultado", { status: data?.status, email: data?.payer_email });
      return new Response(
        JSON.stringify({
          paid,
          customer_email: data?.payer_email || null,
          status: data?.status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Modo 2: recuperação por email
    if (recovery_email) {
      const email = String(recovery_email).trim().toLowerCase();
      logStep("Recuperação por email", { email });
      const { active, sub } = await checkPreapprovalActive(accessToken, email);
      if (active) {
        return new Response(
          JSON.stringify({
            paid: true,
            customer_email: sub?.payer_email || email,
            recovered: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
      return new Response(JSON.stringify({ paid: false, reason: "no_active_subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Requisição inválida");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
