import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MP-CHECKOUT] ${step}${detailsStr}`);
};

const PLAN_AMOUNT = 99.99;

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
    // O parâmetro `trial` é mantido por compatibilidade com chamadas existentes,
    // mas o trial de 1 dia é SEMPRE aplicado pelo plano (regra de negócio atual).

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

    const origin = req.headers.get("origin") || "https://www.metodochoa.com.br";
    const externalReference = `choa-sub-${Date.now()}-${payerEmail}`;

    // ===== Assinatura recorrente via MP (preapproval) =====
    // - SEM período de teste gratuito (cobrança imediata na adesão)
    // - Cobrança automática de R$ 99,99 a cada 3 meses
    const preapprovalBody: any = {
      reason: "Método CHOA — Assinatura Trimestral",
      external_reference: externalReference,
      payer_email: payerEmail,
      back_url: `${origin}/cadastro?mp_status=success`,
      status: "pending",
      auto_recurring: {
        frequency: 3,
        frequency_type: "months",
        transaction_amount: PLAN_AMOUNT,
        currency_id: "BRL",
      },
    };

    logStep("Criando preapproval", { email: payerEmail });

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
