import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Collect all email variants to search in Stripe (case-sensitive API!)
    const emailsToSearch: string[] = [];
    emailsToSearch.push(user.email);

    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .single();

    if (profileData?.email) {
      if (!emailsToSearch.includes(profileData.email)) {
        emailsToSearch.push(profileData.email);
      }
      const lowerProfile = profileData.email.toLowerCase();
      if (!emailsToSearch.includes(lowerProfile)) {
        emailsToSearch.push(lowerProfile);
      }
      logStep("Profile email found", { profileEmail: profileData.email });
    }

    logStep("Searching Stripe with emails", { emails: emailsToSearch });

    // Search Stripe for customer by each email variant
    let stripeCustomer = null;
    for (const searchEmail of emailsToSearch) {
      const customers = await stripe.customers.list({ email: searchEmail, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomer = customers.data[0];
        logStep("Found Stripe customer", { customerId: stripeCustomer.id, matchedEmail: searchEmail });
        break;
      }
    }

    if (!stripeCustomer) {
      logStep("No Stripe customer found, tentando Mercado Pago");
      // Fallback: tentar Mercado Pago
      if (mpToken) {
        const mpResult = await checkMercadoPago(mpToken, emailsToSearch);
        if (mpResult.subscribed) {
          logStep("MP subscription found", { end: mpResult.subscription_end });
          return new Response(JSON.stringify(mpResult), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = stripeCustomer.id;

    // Check active subscriptions (includes trialing status)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });

    // Find an active or trialing subscription
    const activeSub = subscriptions.data.find(
      (s) => s.status === "active" || s.status === "trialing"
    );

    if (!activeSub) {
      // Check canceled subs for logging
      const hasCanceled = subscriptions.data.some((s) => s.status === "canceled");
      logStep(hasCanceled ? "Only canceled subscriptions found" : "No subscriptions found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Determine subscription end date
    let subscriptionEnd = null;
    try {
      let endTimestamp = activeSub.current_period_end;
      if (endTimestamp === undefined && activeSub.items?.data?.[0]) {
        endTimestamp = (activeSub.items.data[0] as any).current_period_end;
      }
      if (endTimestamp) {
        const ms = typeof endTimestamp === 'number' && endTimestamp < 1e12 ? endTimestamp * 1000 : Number(endTimestamp);
        const date = new Date(ms);
        if (!isNaN(date.getTime())) {
          subscriptionEnd = date.toISOString();
        }
      }
    } catch (e) {
      logStep("Error parsing subscription end date", { error: String(e) });
    }

    // Determine if this is a trial subscription
    const isTrial = activeSub.status === "trialing";
    let trialEndsAt: string | null = null;

    if (isTrial && activeSub.trial_end) {
      const trialEndMs = typeof activeSub.trial_end === 'number' && activeSub.trial_end < 1e12
        ? activeSub.trial_end * 1000
        : Number(activeSub.trial_end);
      const trialDate = new Date(trialEndMs);
      if (!isNaN(trialDate.getTime())) {
        trialEndsAt = trialDate.toISOString();
      }
    }

    logStep("Subscription found", {
      subscriptionId: activeSub.id,
      status: activeSub.status,
      isTrial,
      trialEndsAt,
      endDate: subscriptionEnd,
    });

    return new Response(JSON.stringify({
      subscribed: true,
      subscription_end: subscriptionEnd,
      is_trial: isTrial,
      trial_ends_at: trialEndsAt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    const isAuthError = errorMessage.includes("Authentication") || errorMessage.includes("authorization") || errorMessage.includes("session");
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isAuthError ? 401 : 500,
    });
  }
});
