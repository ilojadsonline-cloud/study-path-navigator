import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { findApprovedMercadoPagoPayment } from "../_shared/mercadopago-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-MP] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    const body = await req.json();
    const { payment_id, preference_id, recovery_email, collection_id, status: queryStatus } = body || {};

    // Modo 1: payment_id ou collection_id direto (vem do back_url do MP após aprovação)
    const directPaymentId = payment_id || collection_id;
    if (directPaymentId) {
      logStep("Verificando payment direto", { directPaymentId, queryStatus });
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${directPaymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ paid: false, reason: "not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      const data = await res.json();
      const paid = data?.status === "approved";
      logStep("Payment status", { id: data?.id, status: data?.status, email: data?.payer?.email });
      return new Response(
        JSON.stringify({
          paid,
          customer_email: data?.payer?.email || null,
          status: data?.status,
          amount: data?.transaction_amount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Modo 2: recuperação por email — busca último pagamento aprovado nos últimos 90 dias
    if (recovery_email) {
      const email = String(recovery_email).trim().toLowerCase();
      logStep("Recuperação por email", { email });
      const approved = await findApprovedMercadoPagoPayment(accessToken, [email]);
      if (approved) {
        return new Response(
          JSON.stringify({
            paid: true,
            customer_email: approved.customer_email || email,
            recovered: true,
            payment_id: approved.payment_id,
            paid_at: approved.paid_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      return new Response(JSON.stringify({ paid: false, reason: "no_approved_payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "payment_id, collection_id ou recovery_email é obrigatório" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
