import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MP-CHECKOUT] ${step}${detailsStr}`);
};

const DEFAULT_PLAN = "pmto-mensal";
const FALLBACK_AMOUNT = 39.99;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const payerEmail = (body?.email || "").trim().toLowerCase();
    const planoSlug = String(body?.planoSlug || DEFAULT_PLAN).trim();

    if (!payerEmail) {
      return new Response(JSON.stringify({ error: "Informe o email para iniciar a assinatura." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payerEmail)) {
      return new Response(JSON.stringify({ error: "Email inválido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Busca o plano no banco (preço e cursos vinculados)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: plano } = await admin
      .from("planos")
      .select("slug, nome, preco_centavos, dias_acesso, ativo")
      .eq("slug", planoSlug)
      .maybeSingle();

    if (planoSlug !== DEFAULT_PLAN && (!plano || !plano.ativo)) {
      return new Response(JSON.stringify({ error: "Plano indisponível." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const amount = plano ? Number(plano.preco_centavos) / 100 : FALLBACK_AMOUNT;
    const reason = plano ? `Método CHOA — ${plano.nome}` : "Método CHOA — Assinatura Mensal";

    // Recorrência derivada dos dias de acesso do plano (30 = mensal, 365 = anual)
    const dias = plano ? Number(plano.dias_acesso) : 30;
    const frequency = dias >= 360 ? 12 : Math.max(1, Math.round(dias / 30));

    const origin = req.headers.get("origin") || "https://www.metodochoa.com.br";
    // formato: choa-sub-{ts}-{planoSlug}::{email}
    const externalReference = `choa-sub-${Date.now()}-${planoSlug}::${payerEmail}`;

    const preapprovalBody: any = {
      reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      back_url: `${origin}/cadastro?mp_status=success`,
      status: "pending",
      auto_recurring: {
        frequency,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "BRL",
      },
    };


    logStep("Criando preapproval", { email: payerEmail, planoSlug, amount });

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      logStep("Erro MP preapproval", { status: mpRes.status, data: mpData });
      return new Response(
        JSON.stringify({
          error: mpData?.message || "Falha ao criar assinatura no Mercado Pago",
          details: mpData,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    const initPoint = mpData?.init_point || mpData?.sandbox_init_point;
    const preapprovalId = mpData?.id;

    if (!initPoint) {
      logStep("Sem init_point", { mpData });
      throw new Error("init_point não retornado pelo Mercado Pago");
    }

    logStep("Preapproval criado", { preapprovalId, initPoint });

    return new Response(
      JSON.stringify({ url: initPoint, preapproval_id: preapprovalId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
