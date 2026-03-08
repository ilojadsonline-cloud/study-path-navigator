import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

    if (action === "create") {
      const { email, password, nome, cpf } = params;
      if (!email || !password || !nome || !cpf) throw new Error("Campos obrigatórios: email, password, nome, cpf");

      // Check CPF
      const { data: cpfExists } = await supabaseAdmin.rpc("check_cpf_exists", { p_cpf: cpf });
      if (cpfExists) throw new Error("CPF já cadastrado");

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw new Error(`Erro ao criar usuário: ${createError.message}`);

      // Create profile
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        user_id: newUser.user.id,
        nome,
        cpf,
        email,
      });
      if (profileError) {
        // Rollback: delete auth user
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw new Error(`Erro ao criar perfil: ${profileError.message}`);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = params;
      if (!user_id) throw new Error("user_id é obrigatório");

      // Don't allow deleting yourself
      if (user_id === userData.user.id) throw new Error("Não é possível excluir a si mesmo");

      // Delete related data first
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

    throw new Error("Ação inválida. Use 'create' ou 'delete'.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
