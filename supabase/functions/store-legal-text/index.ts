import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; status: number; body: any }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims } = await supabaseAuth.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, status: 401, body: { error: "Unauthorized" } };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { ok: false, status: 403, body: { error: "Forbidden" } };
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) {
      return new Response(JSON.stringify(guard.body), {
        status: guard.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { disciplina, lei_nome, content, curso_id } = await req.json();

    if (!disciplina || !lei_nome || !content) {
      return new Response(
        JSON.stringify({ error: "disciplina, lei_nome and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Delete old version completely before inserting new one (escopado no curso)
    let del = supabase
      .from("discipline_legal_texts")
      .delete()
      .eq("disciplina", disciplina);
    del = curso_id ? del.or(`curso_id.eq.${curso_id},curso_id.is.null`) : del.is("curso_id", null);
    await del;

    const { data, error } = await supabase
      .from("discipline_legal_texts")
      .insert({ disciplina, lei_nome, content, curso_id: curso_id ?? null, updated_at: new Date().toISOString() })
      .select("id, disciplina, updated_at")
      .single();


    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
