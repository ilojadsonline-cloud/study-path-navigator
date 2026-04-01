import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_id, recovery_email } = body;

    if (!session_id && !recovery_email) {
      throw new Error("session_id or recovery_email is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Mode 1: Direct session_id verification
    if (session_id) {
      logStep("Verifying by session_id", { session_id });
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const paid = session.payment_status === "paid";
      logStep("Session result", { paid, email: session.customer_details?.email });

      return new Response(JSON.stringify({
        paid,
        customer_email: session.customer_details?.email || null,
        amount_total: session.amount_total,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Mode 2: Recovery by email — find recent paid checkout session
    if (recovery_email) {
      logStep("Recovery by email", { email: recovery_email });
      
      const customers = await stripe.customers.list({ email: recovery_email, limit: 1 });
      if (customers.data.length === 0) {
        logStep("No customer found for email");
        return new Response(JSON.stringify({ paid: false, reason: "no_customer" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const customerId = customers.data[0].id;
      
      // Check for active subscription
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      if (subs.data.length > 0) {
        logStep("Active subscription found via recovery", { subId: subs.data[0].id });
        return new Response(JSON.stringify({
          paid: true,
          customer_email: recovery_email,
          recovered: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      logStep("No active subscription for customer");
      return new Response(JSON.stringify({ paid: false, reason: "no_active_subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid request");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
