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

    // Trial foi descontinuado no Mercado Pago. Sempre cobra a assinatura trimestral.
    const isTrial = false;
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

    const origin = req.headers.get("origin") || "https://www.metodochoa.com.br";

    // Estratégia: assinatura recorrente trimestral (R$ 89,90 a cada 3 meses) com end_date em 90 dias
    // → cobra 1x agora e auto-cancela após o ciclo (sem renovação automática).
    const now = new Date();
    const startDate = new Date(now.getTime() + 5 * 60 * 1000); // 5 min de buffer
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 90);

    const reason = "Método CHOA 2026 — Assinatura Trimestral";

    const autoRecurring = {
      frequency: PLAN_FREQUENCY_MONTHS,
      frequency_type: "months",
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      transaction_amount: PLAN_AMOUNT,
      currency_id: "BRL",
    };

    const preapprovalBody: any = {
      reason,
      payer_email: payerEmail,
      back_url: `${origin}/cadastro?mp_status=success`,
      external_reference: `choa-${isTrial ? "trial" : "paid"}-${Date.now()}`,
      auto_recurring: autoRecurring,
      status: "pending",
    };

    logStep("Criando preapproval", { isTrial, email: payerEmail, body: preapprovalBody });

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

    logStep("Preapproval criado", {
      preapprovalId,
      initPoint,
      payer_email_returned: mpData?.payer_email,
    });

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
