import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Search by multiple email variants (same logic as check-subscription)
    const emailsToSearch: string[] = [user.email];
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .single();

    if (profileData?.email) {
      if (!emailsToSearch.includes(profileData.email)) emailsToSearch.push(profileData.email);
      const lower = profileData.email.toLowerCase();
      if (!emailsToSearch.includes(lower)) emailsToSearch.push(lower);
    }

    let stripeCustomer = null;
    for (const email of emailsToSearch) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomer = customers.data[0];
        break;
      }
    }

    if (!stripeCustomer) {
      throw new Error("Nenhum cliente Stripe encontrado para este usuário");
    }

    const origin = req.headers.get("origin") || "https://www.metodochoa.com.br";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomer.id,
      return_url: `${origin}/configuracoes`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
