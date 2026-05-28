// P1.6 — Aplica patches sugeridos por auditoria (modo repair) com versionamento.
// Ações suportadas:
//  - "approve"          : aplica patch original ou editado, status auto_fixed/admin_resolved
//  - "edit_approve"     : usa edited_patch enviado pelo admin
//  - "reject"           : apenas marca a auditoria como rejeitada
//  - "unrecoverable"    : marca a questão como audit_status='deleted' (soft) preservando histórico
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_PATCH_FIELDS = ["enunciado","alt_a","alt_b","alt_c","alt_d","alt_e","gabarito","comentario","assunto","dificuldade"];

function sanitizePatch(p: any): Record<string, unknown> {
  if (!p || typeof p !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_PATCH_FIELDS) {
    if (k in p) out[k] = (p as any)[k];
  }
  if ("gabarito" in out) {
    const g = Number(out.gabarito);
    if (!Number.isInteger(g) || g < 0 || g > 4) delete out.gabarito;
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supabaseAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const auditId = Number(body.audit_id);
    const action: string = String(body.action ?? "").toLowerCase();
    if (!Number.isInteger(auditId) || auditId <= 0) {
      return new Response(JSON.stringify({ error: "audit_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["approve","edit_approve","reject","unrecoverable"].includes(action)) {
      return new Response(JSON.stringify({ error: "action inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega audit + questão
    const { data: audit, error: aErr } = await supabase
      .from("question_audits").select("*").eq("id", auditId).single();
    if (aErr || !audit) {
      return new Response(JSON.stringify({ error: "audit não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const questaoId = Number(audit.questao_id);
    const { data: questao } = await supabase.from("questoes").select("*").eq("id", questaoId).single();
    if (!questao) {
      return new Response(JSON.stringify({ error: "questão não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REJECT — descarta sugestão
    if (action === "reject") {
      await supabase.from("question_audits").update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        ai_summary: `${audit.ai_summary ?? ""} | REJEITADO pelo admin`.slice(0, 4000),
      }).eq("id", auditId);
      // Libera a questão para a fila novamente, marcando como aprovada pelo admin (mantém como está).
      await supabase.from("questoes").update({
        audit_status: "admin_resolved",
        audit_status_updated_at: new Date().toISOString(),
      }).eq("id", questaoId);
      return new Response(JSON.stringify({ ok: true, applied: false, action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UNRECOVERABLE — soft delete da questão
    if (action === "unrecoverable") {
      await supabase.from("question_versions").insert({
        questao_id: questaoId,
        snapshot: questao,
        change_reason: "marked_unrecoverable_by_admin",
        audit_id: auditId,
        changed_by: userId,
      } as any);
      await supabase.from("questoes").update({
        audit_status: "deleted",
        audit_status_updated_at: new Date().toISOString(),
      }).eq("id", questaoId);
      await supabase.from("question_audits").update({
        status: "soft_deleted",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        ai_summary: `${audit.ai_summary ?? ""} | IRRECUPERÁVEL marcada pelo admin (soft delete)`.slice(0, 4000),
      }).eq("id", auditId);
      // Encerra outras auditorias abertas da mesma questão
      await supabase.from("question_audits")
        .update({ status: "superseded" })
        .eq("questao_id", questaoId)
        .neq("id", auditId)
        .in("status", ["manual_review","pending","error"]);
      return new Response(JSON.stringify({ ok: true, applied: false, action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // APPROVE | EDIT_APPROVE — aplica patch
    const rawPatch = action === "edit_approve" ? body.edited_patch : audit.proposed_patch;
    // Remove campos meta (__proof_matrix, __repair_type, __source_articles) antes de aplicar
    const cleanedSource = rawPatch && typeof rawPatch === "object"
      ? Object.fromEntries(Object.entries(rawPatch).filter(([k]) => !k.startsWith("__")))
      : null;
    const patch = sanitizePatch(cleanedSource);
    if (!Object.keys(patch).length) {
      return new Response(JSON.stringify({ error: "patch vazio após sanitização" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Snapshot antes de aplicar
    await supabase.from("question_versions").insert({
      questao_id: questaoId,
      snapshot: questao,
      change_reason: action === "edit_approve" ? "admin_edit_approve_patch" : "admin_approve_patch",
      audit_id: auditId,
      changed_by: userId,
    } as any);

    const { error: upErr } = await supabase.from("questoes").update({
      ...patch,
      audit_status: "admin_resolved",
      audit_status_updated_at: new Date().toISOString(),
    }).eq("id", questaoId);
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("question_audits").update({
      status: "approved",
      applied_patch: patch,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      ai_summary: `${audit.ai_summary ?? ""} | ${action === "edit_approve" ? "EDITADO E APROVADO" : "APROVADO"} pelo admin`.slice(0, 4000),
    }).eq("id", auditId);

    // Encerra outras auditorias abertas
    await supabase.from("question_audits")
      .update({ status: "superseded" })
      .eq("questao_id", questaoId)
      .neq("id", auditId)
      .in("status", ["manual_review","pending","error"]);

    return new Response(JSON.stringify({ ok: true, applied: true, action, applied_patch: patch }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
