import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_PAID = "price_1TI8o8ARWUFKTz2d2rpw2naZ";
const PRICE_TRIAL = "price_1TKl85ARWUFKTz2dRD3UZO8a";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://www.metodochoa.com.br";

    // Parse body to check for trial mode
    let isTrial = false;
    let bodyEmail: string | undefined;
    try {
      const body = await req.json();
      isTrial = body?.trial === true;
      bodyEmail = body?.email;
    } catch {
      // No body or invalid JSON — default to paid checkout
    }

    // Try to get user email from auth or body
    let customerEmail: string | undefined = bodyEmail;
    let customerId: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      if (data?.user?.email) {
        if (!customerEmail) customerEmail = data.user.email;
        // Check if customer already exists in Stripe
        const customers = await stripe.customers.list({ email: data.user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    // Anti-abuse: for trials, check if this email already had any subscription
    if (isTrial) {
      const emailToCheck = customerEmail;
      if (!emailToCheck) {
        return new Response(JSON.stringify({ error: "É necessário informar o email para o teste grátis." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Search for any Stripe customer with this email
      const existingCustomers = await stripe.customers.list({ email: emailToCheck, limit: 5 });
      for (const cust of existingCustomers.data) {
        const subs = await stripe.subscriptions.list({ customer: cust.id, limit: 10 });
        if (subs.data.length > 0) {
          // Customer already had a subscription (active, canceled, trialing, etc.)
          return new Response(JSON.stringify({ 
            error: "Este email já utilizou o teste grátis. Assine o plano definitivo para continuar.",
            trial_used: true 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
      }
    }

    const priceId = isTrial ? PRICE_TRIAL : PRICE_PAID;

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/cadastro?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/assinatura?payment=canceled`,
    };

    if (isTrial) {
      // Trial: 1 day free, no payment method required, auto-cancel when trial ends
      sessionParams.payment_method_collection = "if_required";
      sessionParams.subscription_data = {
        trial_period_days: 1,
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel",
          },
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
