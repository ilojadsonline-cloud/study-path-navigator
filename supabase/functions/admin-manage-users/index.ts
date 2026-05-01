import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getMercadoPagoSubscriptionsByEmail } from "../_shared/mercadopago-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-USERS] ${step}${detailsStr}`);
};

const STRIPE_MIN_PAID_CENTS = 5000;
const ACCESS_WINDOW_DAYS = 90;

type PaidAccess = {
  subscribed: boolean;
  subscription_end: string | null;
  provider?: "stripe" | "mercadopago";
  is_trial?: boolean;
};

function getStripeSubscriptionEnd(subscription: any): string | null {
  const endTimestamp = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  if (!endTimestamp) return null;
  const ms = typeof endTimestamp === "number" && endTimestamp < 1e12 ? endTimestamp * 1000 : Number(endTimestamp);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function getStripePaidAccess(stripe: any, email: string): Promise<PaidAccess> {
  const variants = Array.from(new Set([email, email.toLowerCase()].filter(Boolean)));
  const sinceSec = Math.floor((Date.now() - ACCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000);

  for (const variant of variants) {
    const customers = await stripe.customers.list({ email: variant, limit: 5 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
      const activeSub = subs.data.find((s: any) => s.status === "active" || s.status === "trialing");
      if (activeSub) {
        return {
          subscribed: true,
          subscription_end: getStripeSubscriptionEnd(activeSub),
          provider: "stripe",
          is_trial: activeSub.status === "trialing",
        };
      }

      const paymentIntents = await stripe.paymentIntents.list({ customer: customer.id, limit: 20 });
      const paidIntent = paymentIntents.data.find(
        (pi: any) => pi.status === "succeeded" && pi.amount >= STRIPE_MIN_PAID_CENTS && pi.created >= sinceSec,
      );
      if (paidIntent) {
        return {
          subscribed: true,
          subscription_end: new Date((paidIntent.created + ACCESS_WINDOW_DAYS * 24 * 60 * 60) * 1000).toISOString(),
          provider: "stripe",
          is_trial: false,
        };
      }
    }
  }

  return { subscribed: false, subscription_end: null };
}

async function verifyAdmin(supabaseAdmin: any, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Não autorizado");
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Não autorizado");

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin");
  if (!roleData || roleData.length === 0) throw new Error("Acesso negado: não é admin");
  return userData.user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const caller = await verifyAdmin(supabaseAdmin, req);
    const { action, ...params } = await req.json();

    // ── CREATE USER ──
    if (action === "create") {
      const { email, password, nome, cpf } = params;
      if (!email || !password || !nome || !cpf) throw new Error("Campos obrigatórios: email, password, nome, cpf");

      const { data: cpfExists } = await supabaseAdmin.rpc("check_cpf_exists", { p_cpf: cpf });
      if (cpfExists) throw new Error("CPF já cadastrado");

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createError) throw new Error(`Erro ao criar usuário: ${createError.message}`);

      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        user_id: newUser.user.id, nome, cpf, email,
      });
      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw new Error(`Erro ao criar perfil: ${profileError.message}`);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE USER ──
    if (action === "delete") {
      const { user_id } = params;
      if (!user_id) throw new Error("user_id é obrigatório");
      if (user_id === caller.id) throw new Error("Não é possível excluir a si mesmo");

      await supabaseAdmin.from("respostas_usuario").delete().eq("user_id", user_id);
      await supabaseAdmin.from("simulados").delete().eq("user_id", user_id);
      await supabaseAdmin.from("study_sessions").delete().eq("user_id", user_id);
      await supabaseAdmin.from("notification_reads").delete().eq("user_id", user_id);
      await supabaseAdmin.from("question_reports").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (deleteError) throw new Error(`Erro ao excluir usuário: ${deleteError.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE USER PROFILE ──
    if (action === "update_user") {
      const { user_id, nome, email, cpf } = params;
      if (!user_id) throw new Error("user_id é obrigatório");

      const profileUpdates: Record<string, string> = {};
      if (nome) profileUpdates.nome = nome;
      if (email) profileUpdates.email = email;
      if (cpf) profileUpdates.cpf = cpf;

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabaseAdmin.from("profiles").update(profileUpdates).eq("user_id", user_id);
        if (error) throw new Error(`Erro ao atualizar perfil: ${error.message}`);
      }

      if (email) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
        if (error) throw new Error(`Erro ao atualizar email auth: ${error.message}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── TOGGLE ADMIN ──
    if (action === "toggle_admin") {
      const { user_id } = params;
      if (!user_id) throw new Error("user_id é obrigatório");
      if (user_id === caller.id) throw new Error("Não é possível alterar seu próprio papel");

      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .eq("role", "admin");

      if (existingRole && existingRole.length > 0) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id).eq("role", "admin");
        return new Response(JSON.stringify({ success: true, is_admin: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await supabaseAdmin.from("user_roles").insert({ user_id, role: "admin" });
        return new Response(JSON.stringify({ success: true, is_admin: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── BLOCK / UNBLOCK USER ──
    if (action === "toggle_block") {
      const { user_id, block } = params;
      if (!user_id) throw new Error("user_id é obrigatório");
      if (user_id === caller.id) throw new Error("Não é possível bloquear a si mesmo");

      if (block) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h",
        });
        if (error) throw new Error(`Erro ao bloquear: ${error.message}`);
      } else {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });
        if (error) throw new Error(`Erro ao desbloquear: ${error.message}`);
      }

      return new Response(JSON.stringify({ success: true, blocked: !!block }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST USERS (FAST — DB only, no external API calls) ──
    if (action === "list_users") {
      const { search } = params;
      logStep("Loading users (fast mode)", { search });

      let query = supabaseAdmin.from("profiles").select("user_id, nome, cpf, email, telefone, created_at").order("created_at", { ascending: false });
      if (search) query = query.or(`nome.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%`);
      const { data: profiles, error: profilesErr } = await query.limit(100);
      if (profilesErr) throw new Error(profilesErr.message);

      const { data: allAdminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminSet = new Set((allAdminRoles || []).map((r: any) => r.user_id));

      const profilesList = profiles || [];
      const enrichedUsers: any[] = [];

      // Auth lookups in parallel batches of 10
      for (let i = 0; i < profilesList.length; i += 10) {
        const batch = profilesList.slice(i, i + 10);
        const results = await Promise.all(
          batch.map(async (p: any) => {
            try {
              const { data: authData } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
              const bannedUntil = (authData?.user as any)?.banned_until as string | undefined;
              const banned = bannedUntil ? new Date(bannedUntil) > new Date() : false;
              return { ...p, is_admin: adminSet.has(p.user_id), is_blocked: banned, subscribed: false, subscription_end: null };
            } catch {
              return { ...p, is_admin: adminSet.has(p.user_id), is_blocked: false, subscribed: false, subscription_end: null };
            }
          })
        );
        enrichedUsers.push(...results);
      }

      logStep("Fast list done", { count: enrichedUsers.length });
      return new Response(JSON.stringify({ success: true, users: enrichedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ENRICH SUBSCRIPTIONS (called lazily for a batch of user_ids) ──
    if (action === "enrich_subscriptions") {
      const { user_ids } = params;
      if (!Array.isArray(user_ids) || user_ids.length === 0) throw new Error("user_ids é obrigatório");

      // Cap batch size
      const ids = user_ids.slice(0, 20);

      // Get emails for these users
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, created_at")
        .in("user_id", ids);

      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ success: true, subscriptions: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subscriptions: Record<string, any> = {};
      const now = Date.now();
      const TRIAL_MS = 24 * 60 * 60 * 1000;

      // Check MercadoPago
      const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      const mpMap = new Map<string, { subscription_end: string }>();
      if (mpToken) {
        try {
          const emails = profiles.filter((p: any) => p.email).map((p: any) => String(p.email).toLowerCase());
          const found = await getMercadoPagoSubscriptionsByEmail(mpToken, emails);
          for (const [email, sub] of found) {
            mpMap.set(email, sub);
          }
        } catch (e) {
          logStep("MP warning", { err: e instanceof Error ? e.message : String(e) });
        }
      }

      for (const p of profiles) {
        const email = p.email ? String(p.email).toLowerCase() : null;
        if (email && mpMap.has(email)) {
          const mp = mpMap.get(email)!;
          subscriptions[p.user_id] = { subscribed: true, subscription_end: mp.subscription_end, provider: "mercadopago", is_trial: false };
        }
      }

      // Check Stripe
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const toCheck = profiles.filter((p: any) => p.email && !subscriptions[p.user_id]);

        for (let i = 0; i < toCheck.length; i += 5) {
          const batch = toCheck.slice(i, i + 5);
          await Promise.all(
            batch.map(async (p: any) => {
              try {
                const access = await getStripePaidAccess(stripe, p.email);
                if (access.subscribed) {
                  subscriptions[p.user_id] = {
                    subscribed: true,
                    subscription_end: access.subscription_end,
                    provider: access.provider,
                    is_trial: access.is_trial,
                  };
                }
              } catch { /* ignore */ }
            })
          );
        }
      }

      // Fill in trial_expired for users without subscription
      for (const p of profiles) {
        if (!subscriptions[p.user_id]) {
          const createdMs = p.created_at ? new Date(p.created_at).getTime() : 0;
          const trialExpired = createdMs > 0 && now - createdMs > TRIAL_MS;
          subscriptions[p.user_id] = { subscribed: false, subscription_end: null, trial_expired: trialExpired };
        }
      }

      // Ban sync for this batch
      const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").in("user_id", ids);
      const adminSet = new Set((adminRoles || []).map((r: any) => r.user_id));

      await Promise.all(
        profiles.map(async (p: any) => {
          if (adminSet.has(p.user_id)) return;
          const sub = subscriptions[p.user_id];
          const createdMs = p.created_at ? new Date(p.created_at).getTime() : 0;
          const trialExpired = createdMs > 0 && now - createdMs > TRIAL_MS;

          try {
            const { data: authData } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
            const bannedUntil = (authData?.user as any)?.banned_until as string | undefined;
            const isBanned = bannedUntil ? new Date(bannedUntil) > new Date() : false;

            if (sub?.subscribed && isBanned) {
              await supabaseAdmin.auth.admin.updateUserById(p.user_id, { ban_duration: "none" } as any);
            } else if (!sub?.subscribed && trialExpired && !isBanned) {
              await supabaseAdmin.auth.admin.updateUserById(p.user_id, { ban_duration: "876000h" } as any);
            }
          } catch { /* ignore */ }
        })
      );

      logStep("Enrich done", { count: Object.keys(subscriptions).length });
      return new Response(JSON.stringify({ success: true, subscriptions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESET PASSWORD (admin) ──
    if (action === "reset_password") {
      const { user_id, new_password } = params;
      if (!user_id || !new_password) throw new Error("user_id e new_password são obrigatórios");
      if (new_password.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres");

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) throw new Error(`Erro ao alterar senha: ${error.message}`);

      logStep("Password reset by admin", { user_id });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE QUESTION ──
    if (action === "update_question") {
      const { question_id, updates } = params;
      if (!question_id || !updates) throw new Error("question_id e updates são obrigatórios");

      const allowed = ["enunciado", "alt_a", "alt_b", "alt_c", "alt_d", "alt_e", "gabarito", "comentario", "disciplina", "assunto", "dificuldade"];
      const safeUpdates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in updates) safeUpdates[key] = updates[key];
      }

      if (Object.keys(safeUpdates).length === 0) throw new Error("Nenhum campo válido para atualizar");

      const { error } = await supabaseAdmin.from("questoes").update(safeUpdates).eq("id", question_id);
      if (error) throw new Error(`Erro ao atualizar questão: ${error.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
