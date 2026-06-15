// Cria uma Preference de pagamento ÚNICO no Mercado Pago — apenas Pix e boleto
// (cartão excluído). Após aprovado pelo webhook, libera 90 dias de acesso.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_AMOUNT = 99.99;
const log = (s: string, d?: any) => console.log(`[MP-PIX-BOLETO] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    let body: any = {};
    try { body = await req.json(); } catch {}

    const email = String(body?.email || "").trim().toLowerCase();
    const userId = body?.userId ? String(body.userId) : null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const origin = req.headers.get("origin") || "https://www.metodochoa.com.br";
    const externalReference = `choa-paid-${Date.now()}-${email}`;
    const webhookUrl = `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/mercadopago-webhook`;

    const preferencePayload = {
      items: [{
        title: "Método CHOA — Acesso Trimestral (90 dias)",
        quantity: 1,
        unit_price: PLAN_AMOUNT,
        currency_id: "BRL",
      }],
      payer: { email },
      payment_methods: {
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "prepaid_card" },
        ],
        installments: 1,
      },
      back_urls: {
        success: `${origin}/pagamento/sucesso`,
        failure: `${origin}/pagamento/falha`,
        pending: `${origin}/pagamento/pendente`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      external_reference: externalReference,
      metadata: {
        email,
        userId,
        plan: "trimestral",
        days: 90,
        payment_type: "avulso",
      },
      statement_descriptor: "METODOCHOA",
      expires: false,
    };

    log("Criando preference avulso", { email });

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(preferencePayload),
    });
    const data = await r.json();
    if (!r.ok) {
      log("Erro MP preference", { status: r.status, data });
      return new Response(JSON.stringify({ error: data?.message || "Falha ao criar preferência", details: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const checkoutUrl = data?.init_point || data?.sandbox_init_point;
    if (!checkoutUrl) throw new Error("init_point não retornado pelo Mercado Pago");

    return new Response(JSON.stringify({ checkoutUrl, preference_id: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
