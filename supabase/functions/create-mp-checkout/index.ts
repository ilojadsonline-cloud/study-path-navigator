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

    // Estratégia: Preference (pagamento único) — aceita Pix + Cartão de Crédito + Boleto
    // Acesso liberado por 90 dias após confirmação. Sem renovação automática.
    // Quando expirar, usuário compra novamente e a verificação por email reativa o acesso.
    const externalReference = `choa-paid-${Date.now()}-${payerEmail}`;

    const preferenceBody: any = {
      items: [
        {
          id: "choa-trimestral",
          title: "Método CHOA 2026 — Acesso Trimestral (90 dias)",
          description: "Plataforma de prática ativa e simulados. Acesso por 90 dias.",
          quantity: 1,
          unit_price: PLAN_AMOUNT,
          currency_id: "BRL",
          category_id: "education",
        },
      ],
      payer: {
        email: payerEmail,
      },
      payment_methods: {
        // Aceita todos os métodos: Pix, cartão de crédito, débito, boleto
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 12,
      },
      back_urls: {
        success: `${origin}/cadastro?mp_status=success`,
        failure: `${origin}/assinatura?payment=canceled`,
        pending: `${origin}/cadastro?mp_status=pending`,
      },
      auto_return: "approved",
      external_reference: externalReference,
      statement_descriptor: "METODO CHOA",
      metadata: {
        plan: "trimestral",
        days: 90,
        email: payerEmail,
      },
    };

    logStep("Criando preference", { email: payerEmail });

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      logStep("Erro MP", { status: mpRes.status, data: mpData });
      return new Response(
        JSON.stringify({
          error: mpData?.message || "Falha ao criar checkout no Mercado Pago",
          details: mpData,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    const initPoint = mpData?.init_point || mpData?.sandbox_init_point;
    const preferenceId = mpData?.id;

    if (!initPoint) {
      logStep("Sem init_point", { mpData });
      throw new Error("init_point não retornado pelo Mercado Pago");
    }

    logStep("Preference criada", { preferenceId, initPoint });

    return new Response(
      JSON.stringify({ url: initPoint, preference_id: preferenceId }),
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
