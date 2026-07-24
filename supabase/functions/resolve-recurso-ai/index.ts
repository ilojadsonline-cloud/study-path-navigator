import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
  "Um aluno INTERPÔS RECURSO contra uma questão do Simulado Semanal. Sua tarefa tem 3 partes: " +
  "(1) JULGAR se o recurso é PROCEDENTE (o aluno tem razão e a questão deve ser ANULADA) ou IMPROCEDENTE (a questão está correta e o recurso deve ser indeferido); " +
  "(2) escrever a JUSTIFICATIVA técnica e objetiva da decisão (será exibida ao aluno como resposta do admin); " +
  "(3) indicar recomendação de anulação. " +
  "Baseie-se ESTRITAMENTE no TEXTO LEGAL DE REFERÊNCIA quando fornecido; nunca invente artigos ou fundamentos. " +
  "Se faltar base legal para decidir com segurança, marque needs_human_review=true e não recomende anulação. " +
  "O campo 'gabarito' é um índice inteiro 0-4 (0=A, 1=B, 2=C, 3=D, 4=E). " +
  "Responda APENAS com JSON válido, sem markdown, no formato: " +
  '{ "procedente": true|false, "needs_human_review": true|false, "confianca": 0.0-1.0, ' +
  '"justificativa": "texto técnico e cordial, 2-6 frases, será exibido ao aluno como decisão do admin" }';

function buildUserPrompt(q: any, recursos: string[], legalText: string | null): string {
  const alts = LETTERS.map((L) => `${L}) ${q[`alt_${L.toLowerCase()}`] ?? ""}`).join("\n");
  const legalBlock = legalText
    ? `\n\nTEXTO LEGAL DE REFERÊNCIA (fonte única de verdade, pode estar truncado):\n"""${legalText.slice(0, 9000)}"""`
    : "\n\n(Não há texto legal oficial cadastrado para esta disciplina — se a decisão depender de base legal específica, marque needs_human_review=true.)";

  return [
    `DISCIPLINA: ${q.disciplina ?? "-"} | ASSUNTO: ${q.assunto ?? "-"} | DIFICULDADE: ${q.dificuldade ?? "-"}`,
    `\nENUNCIADO:\n${q.enunciado ?? ""}`,
    `\nALTERNATIVAS:\n${alts}`,
    `\nGABARITO OFICIAL: ${LETTERS[q.gabarito] ?? "?"} (índice ${q.gabarito})`,
    `\nCOMENTÁRIO DA QUESTÃO:\n${q.comentario ?? ""}`,
    `\n\nRECURSO(S) DO(S) ALUNO(S) CONTRA ESTA QUESTÃO:\n${recursos.map((m, i) => `${i + 1}. ${m}`).join("\n")}`,
    legalBlock,
    `\n\nDecida se o recurso deve ser DEFERIDO (procedente=true, anular a questão) ou INDEFERIDO (procedente=false, manter o gabarito).`,
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
    const recursoId = String(body.recurso_id ?? "");
    if (!recursoId) {
      return new Response(JSON.stringify({ error: "recurso_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recurso } = await supabase
      .from("simulado_semanal_recursos").select("*").eq("id", recursoId).single();
    if (!recurso) {
      return new Response(JSON.stringify({ error: "Recurso não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questao } = await supabase
      .from("simulado_semanal_questoes").select("*").eq("id", recurso.questao_id).single();
    if (!questao) {
      return new Response(JSON.stringify({ error: "Questão não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reúne TODOS os recursos pendentes/decididos contra a mesma questão neste simulado.
    const { data: allRecursos } = await supabase
      .from("simulado_semanal_recursos")
      .select("id, argumento")
      .eq("simulado_id", recurso.simulado_id)
      .eq("questao_id", recurso.questao_id);
    const argumentos = (allRecursos?.length ? allRecursos : [recurso]).map((r: any) => r.argumento).filter(Boolean);

    const { data: legalRows } = await supabase
      .from("discipline_legal_texts")
      .select("content")
      .eq("disciplina", questao.disciplina)
      .limit(3);
    const legalText = (legalRows ?? []).map((r: any) => r.content).filter(Boolean).join("\n\n") || null;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(questao, argumentos, legalText) },
    ];

    const ai = await runAiStage("heavy_reported_question_audit", messages, {
      jsonResponse: true,
      questionId: questao.id,
      complexity: "high",
      metadata: { feature: "resolve-recurso-ai", recurso_id: recursoId },
    });

    const parsed = safeJsonParse(ai.content);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Falha ao interpretar resposta da IA", raw: ai.content?.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      recurso_id: recursoId,
      questao_id: questao.id,
      procedente: Boolean(parsed.procedente),
      needs_human_review: Boolean(parsed.needs_human_review),
      confianca: Number(parsed.confianca ?? 0),
      justificativa: String(parsed.justificativa ?? ""),
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
