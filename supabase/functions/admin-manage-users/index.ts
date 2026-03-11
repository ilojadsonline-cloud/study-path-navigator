import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    // Verify caller is admin
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
      if (user_id === userData.user.id) throw new Error("Não é possível excluir a si mesmo");

      await supabaseAdmin.from("respostas_usuario").delete().eq("user_id", user_id);
      await supabaseAdmin.from("simulados").delete().eq("user_id", user_id);
      await supabaseAdmin.from("study_sessions").delete().eq("user_id", user_id);
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

      // Update email in auth if changed
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
      if (user_id === userData.user.id) throw new Error("Não é possível alterar seu próprio papel");

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
      if (user_id === userData.user.id) throw new Error("Não é possível bloquear a si mesmo");

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

    // ── LIST USERS WITH DETAILS ──
    if (action === "list_users") {
      const { search } = params;
      let query = supabaseAdmin.from("profiles").select("user_id, nome, cpf, email, created_at").order("created_at", { ascending: false });
      if (search) query = query.or(`nome.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%`);
      const { data: profiles, error: profilesErr } = await query.limit(100);
      if (profilesErr) throw new Error(profilesErr.message);

      // Get all admin roles
      const { data: allAdminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminSet = new Set((allAdminRoles || []).map(r => r.user_id));

      // Get auth user details (banned status) for each user
      const enrichedUsers = [];
      for (const p of (profiles || [])) {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
        const banned = authData?.user?.banned_until
          ? new Date(authData.user.banned_until) > new Date()
          : false;

        enrichedUsers.push({
          ...p,
          is_admin: adminSet.has(p.user_id),
          is_blocked: banned,
        });
      }

      // Check Stripe subscriptions for all users
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        for (const u of enrichedUsers) {
          if (!u.email) { u.subscription_end = null; u.subscribed = false; continue; }
          try {
            const customers = await stripe.customers.list({ email: u.email, limit: 1 });
            if (customers.data.length === 0) { u.subscription_end = null; u.subscribed = false; continue; }
            const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
            if (subs.data.length > 0) {
              const sub = subs.data[0];
              // In basil API, current_period_end is on the item, not the subscription root
              let endTimestamp = sub.current_period_end;
              if (endTimestamp === undefined && sub.items?.data?.[0]) {
                endTimestamp = (sub.items.data[0] as any).current_period_end;
              }
              if (endTimestamp) {
                const ms = typeof endTimestamp === "number" && endTimestamp < 1e12 ? endTimestamp * 1000 : Number(endTimestamp);
                u.subscription_end = new Date(ms).toISOString();
              } else {
                u.subscription_end = null;
              }
              u.subscribed = true;
            } else {
              u.subscription_end = null;
              u.subscribed = false;
            }
          } catch {
            u.subscription_end = null;
            u.subscribed = false;
          }
        }
      }

      return new Response(JSON.stringify({ success: true, users: enrichedUsers }), {
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
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
