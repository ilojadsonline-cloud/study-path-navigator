import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { runAiStage, type ChatMessage } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const LETTERS = ["A", "B", "C", "D", "E"];

function stripThinkTags(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function safeJsonParse(s: string): any {
  const clean = stripThinkTags(s);
  try { return JSON.parse(clean); } catch { /* noop */ }
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
  return null;
}

const SYSTEM_PROMPT =
  "Você é PROFESSOR-REVISOR especialista em questões objetivas de concursos militares (PMTO, CFO/CHOA) e jurídicos. " +
  "Um aluno REPORTOU um possível erro em uma questão. Sua tarefa tem 3 partes: " +
  "(1) JULGAR se o reporte é PROCEDENTE (o aluno tem razão, há de fato um erro) ou IMPROCEDENTE (a questão está correta e o aluno se equivocou); " +
  "(2) se PROCEDENTE e for corrigível, propor a CORREÇÃO mínima necessária (apenas os campos que mudam); " +
  "(3) escrever uma RESPOSTA cordial e didática ao aluno, em 2ª pessoa ('você'), agradecendo o reporte e explicando com clareza se o reporte procede ou não e o que foi feito. " +
  "Baseie-se ESTRITAMENTE no TEXTO LEGAL DE REFERÊNCIA quando fornecido; nunca invente artigos ou fundamentos. " +
  "Se faltar base legal para decidir com segurança, marque needs_human_review=true e não proponha correção. " +
  "O campo 'gabarito' é um índice inteiro 0-4 (0=A, 1=B, 2=C, 3=D, 4=E). " +
  "Responda APENAS com JSON válido, sem markdown, no formato: " +
  '{ "procedente": true|false, "needs_human_review": true|false, "confianca": 0.0-1.0, ' +
  '"justificativa": "1-3 frases explicando a decisão", ' +
  '"proposed_patch": null | { "enunciado"?: "...", "alt_a"?: "...", "alt_b"?: "...", "alt_c"?: "...", "alt_d"?: "...", "alt_e"?: "...", "gabarito"?: 0-4, "comentario"?: "..." }, ' +
  '"resposta_usuario": "mensagem cordial ao aluno" }';

function buildUserPrompt(q: any, motivos: string[], legalText: string | null): string {
  const alts = LETTERS.map((L, i) => `${L}) ${q[`alt_${L.toLowerCase()}`] ?? ""}`).join("\n");
  const legalBlock = legalText
    ? `\n\nTEXTO LEGAL DE REFERÊNCIA (fonte única de verdade, pode estar truncado):\n"""${legalText.slice(0, 9000)}"""`
    : "\n\n(Não há texto legal oficial cadastrado para esta disciplina — se a decisão depender de base legal específica, marque needs_human_review=true.)";

  return [
    `DISCIPLINA: ${q.disciplina ?? "-"} | ASSUNTO: ${q.assunto ?? "-"} | DIFICULDADE: ${q.dificuldade ?? "-"}`,
    `\nENUNCIADO:\n${q.enunciado ?? ""}`,
    `\nALTERNATIVAS:\n${alts}`,
    `\nGABARITO ATUAL: ${LETTERS[q.gabarito] ?? "?"} (índice ${q.gabarito})`,
    `\nCOMENTÁRIO ATUAL:\n${q.comentario ?? ""}`,
    `\n\nREPORTE(S) DO(S) ALUNO(S):\n${motivos.map((m, i) => `${i + 1}. ${m}`).join("\n")}`,
    legalBlock,
    `\n\nLembre: proposed_patch deve conter SOMENTE os campos alterados. Se a questão já estiver correta, procedente=false e proposed_patch=null.`,
  ].join("");
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

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
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
    const reportId = Number(body.report_id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return new Response(JSON.stringify({ error: "report_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: report } = await supabase
      .from("question_reports").select("*").eq("id", reportId).single();
    if (!report) {
      return new Response(JSON.stringify({ error: "Reporte não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questao } = await supabase
      .from("questoes").select("*").eq("id", report.questao_id).single();
    if (!questao) {
      return new Response(JSON.stringify({ error: "Questão não encontrada (pode ter sido excluída)" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reúne TODOS os reportes pendentes da mesma questão para um veredito único.
    const { data: allReports } = await supabase
      .from("question_reports")
      .select("id, motivo")
      .eq("questao_id", report.questao_id)
      .neq("status", "resolvido");
    const motivos = (allReports?.length ? allReports : [report]).map((r: any) => r.motivo).filter(Boolean);

    // Texto legal de referência (se cadastrado para a disciplina).
    const { data: legalRows } = await supabase
      .from("discipline_legal_texts")
      .select("content")
      .eq("disciplina", questao.disciplina)
      .limit(3);
    const legalText = (legalRows ?? []).map((r: any) => r.content).filter(Boolean).join("\n\n") || null;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(questao, motivos, legalText) },
    ];

    const ai = await runAiStage("heavy_reported_question_audit", messages, {
      jsonResponse: true,
      questionId: questao.id,
      complexity: "high",
      metadata: { feature: "resolve-report-ai", report_id: reportId },
    });

    const parsed = safeJsonParse(ai.content);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Falha ao interpretar resposta da IA", raw: ai.content?.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitiza o proposed_patch: só campos válidos, gabarito 0-4.
    const rawPatch = parsed.proposed_patch && typeof parsed.proposed_patch === "object" ? parsed.proposed_patch : null;
    let patch: Record<string, unknown> | null = null;
    if (rawPatch) {
      const allowed = ["enunciado", "alt_a", "alt_b", "alt_c", "alt_d", "alt_e", "gabarito", "comentario"];
      const clean: Record<string, unknown> = {};
      for (const k of allowed) {
        if (rawPatch[k] === undefined || rawPatch[k] === null) continue;
        if (k === "gabarito") {
          const g = Number(rawPatch[k]);
          if (Number.isInteger(g) && g >= 0 && g <= 4 && g !== questao.gabarito) clean[k] = g;
        } else if (typeof rawPatch[k] === "string" && rawPatch[k].trim() && rawPatch[k] !== questao[k]) {
          clean[k] = rawPatch[k];
        }
      }
      if (Object.keys(clean).length > 0) patch = clean;
    }

    return new Response(JSON.stringify({
      ok: true,
      questao_id: questao.id,
      procedente: Boolean(parsed.procedente),
      needs_human_review: Boolean(parsed.needs_human_review),
      confianca: Number(parsed.confianca ?? 0),
      justificativa: String(parsed.justificativa ?? ""),
      resposta_usuario: String(parsed.resposta_usuario ?? ""),
      proposed_patch: patch,
      provider: `${ai.provider}:${ai.model}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
