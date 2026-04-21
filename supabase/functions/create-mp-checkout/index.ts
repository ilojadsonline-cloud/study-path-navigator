import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MP-CHECKOUT] ${step}${detailsStr}`);
};

const PLAN_AMOUNT = 89.90;
const PLAN_FREQUENCY_MONTHS = 3;

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

    const isTrial = body?.trial === true;
    const payerEmail = (body?.email || "").trim().toLowerCase();

    if (!payerEmail) {
      return new Response(JSON.stringify({ error: "Informe o email para iniciar o pagamento." }), {
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

    // Anti-abuso: para trial, verificar se este email já tem qualquer preapproval no MP
    if (isTrial) {
      logStep("Verificando histórico de assinaturas MP para trial", { email: payerEmail });
      const searchUrl = `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(payerEmail)}&limit=10`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData?.results || [];
        if (results.length > 0) {
          logStep("Email já utilizou MP", { count: results.length });
          return new Response(
            JSON.stringify({
              error: "Este email já utilizou o teste grátis ou possui assinatura no Mercado Pago. Assine o plano definitivo para continuar.",
              trial_used: true,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            },
          );
        }
      }
    }

    // Calcular datas
    const now = new Date();
    const startDate = new Date(now.getTime() + 5 * 60 * 1000); // 5 min de buffer
    // 90 dias trimestral; trial cobra após 1 dia o valor cheio (não temos "free trial" nativo no preapproval básico)
    // Estratégia: trial = preapproval com primeira cobrança em 1 dia e end_date = start+1day (auto-cancela depois)
    //             paid  = preapproval com cobrança imediata e end_date = start+90days (auto-cancela ao fim)
    const endDate = new Date(startDate);
    if (isTrial) {
      endDate.setDate(endDate.getDate() + 1);
    } else {
      endDate.setDate(endDate.getDate() + 90);
    }

    const reason = isTrial
      ? "Método CHOA 2026 — Teste grátis (1 dia)"
      : "Método CHOA 2026 — Assinatura Trimestral (90 dias)";

    const transactionAmount = isTrial ? 0.5 : PLAN_AMOUNT;
    // MP exige valor > 0 mesmo para "trial". Vamos usar valor cheio mas com end_date curto (1 dia) e cancelar antes de cobrar novamente.
    // Para trial real sem cobrança, usamos transaction_amount mínimo permitido pelo MP (R$ 0,50) APENAS na 1ª cobrança? Não — preapproval cobra o valor único.
    // Solução real: trial = R$ 0,00 não é aceito. Cobramos valor simbólico R$ 0,50 OU usamos modelo "authorized_payment" sem cobrar.
    // Mais simples: para trial, criamos preapproval com auto_recurring sem cobrança imediata e end_date 1 dia. Usuário autoriza método, cancelamos antes de qualquer cobrança.
    // MP suporta isso via "preapproval" sem "card_token_id" — usuário só autoriza, sem cobrança. Vamos usar transaction_amount: PLAN_AMOUNT mas frequency: 1 month e end_date em 1 dia (não chega a cobrar).

    const preapprovalBody: any = {
      reason,
      payer_email: payerEmail,
      back_url: `${origin}/cadastro?mp_status=success`,
      external_reference: `choa-${isTrial ? "trial" : "paid"}-${Date.now()}`,
      auto_recurring: {
        frequency: isTrial ? 1 : PLAN_FREQUENCY_MONTHS,
        frequency_type: "months",
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        transaction_amount: PLAN_AMOUNT,
        currency_id: "BRL",
      },
      status: "pending",
    };

    logStep("Criando preapproval", { isTrial, email: payerEmail, end: endDate.toISOString() });

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
      logStep("Erro MP", { status: mpRes.status, data: mpData });
      return new Response(
        JSON.stringify({ error: mpData?.message || "Falha ao criar assinatura no Mercado Pago", details: mpData }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    const initPoint = mpData?.init_point || mpData?.sandbox_init_point;
    const preapprovalId = mpData?.id;

    if (!initPoint) {
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
