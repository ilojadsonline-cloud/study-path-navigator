import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARTICLE_REGEX = /art\.?\s*\d+/i;
const SINGLE_TOKEN_INVALID_ALT_REGEX = /^(?:a|b|c|d|e|um|dois|tr[eê]s|quatro|cinco|i|ii|iii|iv|v|1|2|3|4|5)$/i;
const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;

type AltKey = (typeof ALT_KEYS)[number];

function normalizeWhitespace(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function stripAlternativePrefix(text: string): string {
  let cleaned = normalizeWhitespace(text);

  cleaned = cleaned.replace(/^(?:alternativa|opção|opcao|letra)\s*[a-e]\s*[:)\-.–]?\s*/i, "");
  cleaned = cleaned.replace(/^[a-e]\s*[:)\-.–]\s*/i, "");
  cleaned = cleaned.replace(/^(?:\d+|i{1,3}|iv|v|um|dois|tr[eê]s|quatro|cinco)\s*[:)\-.–]\s*/i, "");

  return normalizeWhitespace(cleaned);
}

function hasDuplicateAlternatives(alternatives: string[]): boolean {
  const normalized = alternatives.map((alt) => normalizeWhitespace(alt).toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

function detectLocalIssues(questao: Record<string, any>): string[] {
  const issues: string[] = [];

  const alternatives = ALT_KEYS.map((k) => stripAlternativePrefix(questao[k]));

  alternatives.forEach((alt, idx) => {
    if (!alt) issues.push(`Alternativa ${String.fromCharCode(65 + idx)} vazia`);
    if (SINGLE_TOKEN_INVALID_ALT_REGEX.test(alt)) {
      issues.push(`Alternativa ${String.fromCharCode(65 + idx)} inválida (${alt})`);
    }
  });

  if (hasDuplicateAlternatives(alternatives)) {
    issues.push("Alternativas duplicadas ou semanticamente idênticas");
  }

  const enunciado = normalizeWhitespace(questao.enunciado);
  if (enunciado.length < 30) {
    issues.push("Enunciado curto ou incompleto");
  }

  const comentario = normalizeWhitespace(questao.comentario);
  if (!ARTICLE_REGEX.test(comentario)) {
    issues.push("Comentário sem citação explícita de artigo legal");
  }

  if (typeof questao.gabarito !== "number" || questao.gabarito < 0 || questao.gabarito > 4) {
    issues.push("Gabarito fora do intervalo 0..4");
  }

  return issues;
}

function sanitizeQuestion(
  base: Record<string, any>,
  overrides?: Record<string, any>,
): Record<string, any> {
  const source = { ...base, ...(overrides || {}) };

  const sanitized: Record<string, any> = {
    enunciado: normalizeWhitespace(source.enunciado),
    comentario: normalizeWhitespace(source.comentario),
    gabarito:
      typeof source.gabarito === "number"
        ? Math.min(Math.max(source.gabarito, 0), 4)
        : Math.min(Math.max(Number(source.gabarito || 0), 0), 4),
  };

  for (const key of ALT_KEYS) {
    sanitized[key] = stripAlternativePrefix(source[key]);
  }

  return sanitized;
}

function buildUpdateDiff(
  original: Record<string, any>,
  candidate: Record<string, any>,
): Record<string, any> {
  const keys: (AltKey | "enunciado" | "comentario" | "gabarito")[] = [
    "enunciado",
    "comentario",
    "gabarito",
    ...ALT_KEYS,
  ];

  const update: Record<string, any> = {};

  for (const key of keys) {
    const originalValue = normalizeWhitespace(original[key]);
    const candidateValue = normalizeWhitespace(candidate[key]);

    if (key === "gabarito") {
      if (Number(original[key]) !== Number(candidate[key])) {
        update[key] = Number(candidate[key]);
      }
      continue;
    }

    if (originalValue !== candidateValue) {
      update[key] = candidate[key];
    }
  }

  return update;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 5, after_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from("questoes")
      .select("*")
      .order("id", { ascending: true })
      .limit(limit);

    if (after_id && after_id > 0) {
      query = query.gt("id", after_id);
    }

    const { data: questoes, error: fetchErr } = await query;

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch questions", details: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!questoes || questoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more questions to validate", validated: 0, ok: 0, fixed: 0, deleted: 0, last_id: after_id || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lastId = questoes[questoes.length - 1].id;

    const payload = questoes.map((q) => {
      const sanitized = sanitizeQuestion(q);
      return {
        id: q.id,
        disciplina: q.disciplina,
        assunto: q.assunto,
        dificuldade: q.dificuldade,
        enunciado: sanitized.enunciado,
        alt_a: sanitized.alt_a,
        alt_b: sanitized.alt_b,
        alt_c: sanitized.alt_c,
        alt_d: sanitized.alt_d,
        alt_e: sanitized.alt_e,
        gabarito: sanitized.gabarito,
        comentario: sanitized.comentario,
        diagnostico_local: detectLocalIssues({ ...q, ...sanitized }),
      };
    });

    const prompt = `Você é um revisor especialista em questões de concursos militares (CHOA PMTO).

OBJETIVO:
Revisar cada questão e devolver um array JSON com uma decisão para CADA id fornecido, garantindo conformidade com LEI SECA do edital:
- Lei nº 2.578/2012
- LC nº 128/2021
- Lei nº 2.575/2012
- CPPM (apenas Arts. 8º a 28º e 243º a 253º)
- RDMETO (Decreto nº 4.994/2014)
- CPM (Parte Geral)
- Lei nº 14.751/2023 (Lei Orgânica Nacional)

REGRAS CRÍTICAS:
1) Cada questão deve ter exatamente 5 alternativas textuais válidas e coerentes.
2) NÃO aceitar alternativas placeholder como: "UM", "DOIS", "TRÊS", "A", "B", "I", "II", "III" isolados.
3) Apenas UMA alternativa correta.
4) Gabarito deve ser 0-indexado (0=A,1=B,2=C,3=D,4=E).
5) Comentário deve citar artigo/dispositivo real da legislação.
6) Conteúdo fora da lei seca do edital deve ser deletado.

IMPORTANTE:
- Mantenha o id original.
- Retorne TODOS os ids recebidos (um objeto por id).
- Se estiver correta: {"id":X,"ok":true}
- Se irrecuperável: {"id":X,"deletar":true,"motivo":"..."}
- Se precisar corrigir: {"id":X,"corrigida":{...campos completos...}}

Questões para revisar (com diagnóstico local já incluído):
${JSON.stringify(payload)}

Responda APENAS com JSON array válido.`;

    let aiResultados: any[] = [];
    let aiWarning: string | null = null;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      const status = aiResponse.status;
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: status === 429 ? "Rate limit exceeded. Tente novamente em alguns segundos." : "Créditos insuficientes.", last_id: after_id || 0 }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      aiWarning = `AI unavailable: ${errText.slice(0, 220)}`;
    } else {
      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          aiResultados = parsed;
        } else if (Array.isArray(parsed?.resultados)) {
          aiResultados = parsed.resultados;
        } else {
          aiWarning = "AI response was not an array";
        }
      } catch {
        aiWarning = `Failed to parse AI response: ${content.slice(0, 220)}`;
      }
    }

    const aiMap = new Map<number, any>();
    for (const item of aiResultados) {
      if (item?.id) aiMap.set(Number(item.id), item);
    }

    let fixed = 0;
    let deleted = 0;
    let okCount = 0;
    const errors: string[] = [];

    for (const original of questoes) {
      const aiDecision = aiMap.get(Number(original.id));

      if (aiDecision?.deletar) {
        await supabase.from("respostas_usuario").delete().eq("questao_id", original.id);
        const { error: delErr } = await supabase.from("questoes").delete().eq("id", original.id);
        if (delErr) {
          errors.push(`Delete ${original.id}: ${delErr.message}`);
        } else {
          deleted++;
        }
        continue;
      }

      const baseSanitized = sanitizeQuestion(original);
      const candidate = aiDecision?.corrigida
        ? sanitizeQuestion({ ...original, ...baseSanitized }, aiDecision.corrigida)
        : baseSanitized;

      const candidateIssues = detectLocalIssues({ ...original, ...candidate });
      const allowedIssues = new Set(["Comentário sem citação explícita de artigo legal"]);
      const blockingIssues = candidateIssues.filter((issue) => !allowedIssues.has(issue));

      if (blockingIssues.length > 0) {
        errors.push(`Questão ${original.id} ignorada por inconsistência: ${blockingIssues.join("; ")}`);
        okCount++;
        continue;
      }

      const update = buildUpdateDiff(original, candidate);

      if (Object.keys(update).length > 0) {
        const { error: upErr } = await supabase.from("questoes").update(update).eq("id", original.id);
        if (upErr) {
          errors.push(`Update ${original.id}: ${upErr.message}`);
        } else {
          fixed++;
        }
      } else {
        okCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        validated: questoes.length,
        ok: okCount,
        fixed,
        deleted,
        last_id: lastId,
        ai_warning: aiWarning || undefined,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
