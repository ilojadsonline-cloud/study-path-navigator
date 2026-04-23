import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    // Service-role client para gravar/ler em trial_usage (bypass RLS)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const origin = req.headers.get("origin") || "https://www.metodochoa.com.br";

    let isTrial = false;
    let bodyEmail: string | undefined;
    let bodyCpf: string | undefined;
    try {
      const body = await req.json();
      isTrial = body?.trial === true;
      bodyEmail = body?.email;
      bodyCpf = body?.cpf;
    } catch {}

    // Resolve email/CPF do usuário autenticado quando disponível
    let customerEmail: string | undefined = bodyEmail;
    let customerId: string | undefined;
    let userId: string | undefined;
    let resolvedCpf: string | undefined = bodyCpf;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await userClient.auth.getUser(token);
      if (data?.user?.email) {
        userId = data.user.id;
        if (!customerEmail) customerEmail = data.user.email;

        // Busca CPF do profile se ainda não informado
        if (!resolvedCpf) {
          const { data: prof } = await adminClient
            .from("profiles")
            .select("cpf")
            .eq("user_id", data.user.id)
            .maybeSingle();
          if (prof?.cpf) resolvedCpf = prof.cpf;
        }

        const customers = await stripe.customers.list({ email: data.user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    // ===== ANTI-FRAUDE TRIAL =====
    if (isTrial) {
      const emailToCheck = customerEmail;
      if (!emailToCheck) {
        return new Response(JSON.stringify({ error: "É necessário informar o email para o teste grátis." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // 1) Camada permanente: trial_usage por email OU CPF
      const { data: hasUsed, error: rpcErr } = await adminClient.rpc("has_used_trial", {
        p_email: emailToCheck,
        p_cpf: resolvedCpf ?? null,
      });
      if (rpcErr) console.error("[create-checkout] has_used_trial error:", rpcErr);
      if (hasUsed === true) {
        return new Response(JSON.stringify({
          error: "Este CPF ou email já utilizou o teste grátis. Assine o plano definitivo para continuar.",
          trial_used: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // 2) Camada Stripe: qualquer assinatura prévia (incluindo canceladas)
      const existingCustomers = await stripe.customers.list({ email: emailToCheck, limit: 5 });
      for (const cust of existingCustomers.data) {
        const subs = await stripe.subscriptions.list({ customer: cust.id, limit: 10 });
        if (subs.data.length > 0) {
          // Registra retroativamente para futuras verificações
          await adminClient.from("trial_usage").upsert({
            email: emailToCheck.toLowerCase(),
            cpf: resolvedCpf ?? null,
            user_id: userId ?? null,
            provider: "stripe",
            stripe_customer_id: cust.id,
            converted_to_paid: subs.data.some((s) => s.status === "active"),
          }, { onConflict: "email" });

          return new Response(JSON.stringify({
            error: "Este email já utilizou o teste grátis. Assine o plano definitivo para continuar.",
            trial_used: true,
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
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/cadastro?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/assinatura?payment=canceled`,
    };

    if (isTrial) {
      sessionParams.payment_method_collection = "if_required";
      sessionParams.subscription_data = {
        trial_period_days: 1,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Registra trial em trial_usage IMEDIATAMENTE (não esperar o usuário voltar)
    if (isTrial && customerEmail) {
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 1);
      const { error: insErr } = await adminClient.from("trial_usage").upsert({
        email: customerEmail.toLowerCase(),
        cpf: resolvedCpf ?? null,
        user_id: userId ?? null,
        provider: "stripe",
        trial_ends_at: trialEnds.toISOString(),
        converted_to_paid: false,
      }, { onConflict: "email" });
      if (insErr) console.error("[create-checkout] trial_usage insert error:", insErr);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
