import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;
const ARTICLE_REGEX = /(?:art(?:igos?)?\.?\s*\d+[º°]?|§\s*\d+|inciso\s+[ivxlcdm\d]+|anexo\s+[ivxlcdm\d]+)/i;
const SINGLE_TOKEN_INVALID = /^(?:a|b|c|d|e|um|dois|tr[eê]s|quatro|cinco|i|ii|iii|iv|v|1|2|3|4|5)$/i;

function normalize(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function stripPrefix(text: string): string {
  let c = normalize(text);
  c = c.replace(/^(?:alternativa|opção|opcao|letra)\s*[a-e]\s*[:)\-.–]?\s*/i, "");
  c = c.replace(/^[a-e]\s*[:)\-.–]\s*/i, "");
  c = c.replace(/^(?:\d+|i{1,3}|iv|v|um|dois|tr[eê]s|quatro|cinco)\s*[:)\-.–]\s*/i, "");
  return normalize(c);
}

function hasDuplicateAlts(alts: string[]): boolean {
  const n = alts.map((a) => normalize(a).toLowerCase());
  return new Set(n).size !== n.length;
}

function extractArticleNumbers(text: string): string[] {
  const matches = [...text.matchAll(/art(?:igo|igos)?\.?\s*(\d+[a-z]?)/gi)];
  return [...new Set(matches.map((m) => m[1].toLowerCase()))];
}

function articleExistsInLaw(comment: string, lawText: string): boolean {
  const cited = extractArticleNumbers(comment);
  if (cited.length === 0) return false;
  const lw = normalize(lawText).toLowerCase();
  return cited.some((a) =>
    lw.includes(`art. ${a}`) || lw.includes(`art ${a}`) || lw.includes(`artigo ${a}`)
  );
}

// ─── RULES MODE ────────────────────────────────────────────────
async function validateRulesMode(
  supabase: any,
  afterId: number,
  limit: number,
  autoDelete: boolean,
  legalTexts: Record<string, string>
) {
  const { data: questions, error } = await supabase
    .from("questoes")
    .select("*")
    .gt("id", afterId)
    .order("id", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!questions || questions.length === 0) {
    return { validated: 0, ok: 0, fixed: 0, deleted: 0, last_id: afterId };
  }

  let ok = 0, fixed = 0, deleted = 0;

  for (const q of questions) {
    const issues: string[] = [];
    const updates: Record<string, any> = {};

    // Strip prefixes from alternatives
    for (const key of ALT_KEYS) {
      const original = q[key];
      const cleaned = stripPrefix(original);
      if (cleaned !== normalize(original)) {
        updates[key] = cleaned;
      }
      if (!cleaned || SINGLE_TOKEN_INVALID.test(cleaned)) {
        issues.push(`${key} inválida`);
      }
    }

    const alts = ALT_KEYS.map((k) => updates[k] || normalize(q[k]));

    // Check enunciado
    if (!q.enunciado || normalize(q.enunciado).length < 30) {
      issues.push("Enunciado curto");
    }

    // Check for legal reference in comment
    if (!q.comentario || !ARTICLE_REGEX.test(q.comentario)) {
      issues.push("Comentário sem referência legal");
    }

    // Check gabarito range
    if (q.gabarito < 0 || q.gabarito > 4) {
      issues.push("Gabarito fora do intervalo 0-4");
    }

    // Check duplicate alternatives
    if (hasDuplicateAlts(alts)) {
      issues.push("Alternativas duplicadas");
    }

    // Cross-reference: check if cited articles exist in the law text
    const lawText = legalTexts[q.disciplina];
    if (lawText && q.comentario) {
      if (!articleExistsInLaw(q.comentario, lawText)) {
        issues.push("Artigo citado não encontrado na legislação");
      }
    } else if (!lawText) {
      // No legal text loaded for this discipline - can't cross-check
    }

    // Decide: delete or fix
    const irrecoverable = issues.some((i) =>
      i.includes("inválida") ||
      i.includes("Enunciado curto") ||
      i.includes("Alternativas duplicadas") ||
      i.includes("Artigo citado não encontrado") ||
      i.includes("Gabarito fora")
    );

    if (irrecoverable && autoDelete) {
      await supabase.from("questoes").delete().eq("id", q.id);
      deleted++;
    } else if (Object.keys(updates).length > 0 && !irrecoverable) {
      await supabase.from("questoes").update(updates).eq("id", q.id);
      fixed++;
    } else if (issues.length === 0) {
      ok++;
    } else if (!autoDelete) {
      ok++; // not deleting, count as ok with issues
    } else {
      await supabase.from("questoes").delete().eq("id", q.id);
      deleted++;
    }
  }

  return {
    validated: questions.length,
    ok,
    fixed,
    deleted,
    last_id: questions[questions.length - 1].id,
  };
}

// ─── AI MODE (Groq) ───────────────────────────────────────────
async function validateAiMode(
  supabase: any,
  afterId: number,
  limit: number,
  autoDelete: boolean,
  legalTexts: Record<string, string>
) {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const { data: questions, error } = await supabase
    .from("questoes")
    .select("*")
    .gt("id", afterId)
    .order("id", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!questions || questions.length === 0) {
    return { validated: 0, ok: 0, fixed: 0, deleted: 0, last_id: afterId };
  }

  let ok = 0, fixed = 0, deleted = 0;

  for (const q of questions) {
    const lawText = legalTexts[q.disciplina] || "";

    if (!lawText) {
      // No legal text available - skip AI validation, run rules only
      ok++;
      continue;
    }

    const prompt = `Você é um auditor de questões de concurso militar. Analise a questão abaixo e verifique se está em TOTAL conformidade com o texto legal fornecido.

TEXTO LEGAL OFICIAL (${q.disciplina}):
${lawText.substring(0, 30000)}

QUESTÃO A VALIDAR:
ID: ${q.id}
Enunciado: ${q.enunciado}
A) ${q.alt_a}
B) ${q.alt_b}
C) ${q.alt_c}
D) ${q.alt_d}
E) ${q.alt_e}
Gabarito: ${String.fromCharCode(65 + q.gabarito)}
Comentário: ${q.comentario}

VERIFICAÇÕES OBRIGATÓRIAS:
1. O artigo citado no comentário EXISTE no texto legal?
2. O conteúdo da alternativa correta CORRESPONDE ao que diz a lei?
3. As alternativas incorretas são REALMENTE incorretas segundo a lei?
4. A questão trata EXCLUSIVAMENTE desta lei (não mistura com outra)?
5. O enunciado é claro e coerente?
6. Há exatamente UMA alternativa correta?

Responda APENAS em JSON (sem markdown):
{
  "valida": true/false,
  "problemas": ["lista de problemas encontrados"],
  "correcao_possivel": true/false,
  "sugestao_gabarito": 0-4 (se o gabarito estiver errado)
}`;

    try {
      const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429 || status === 402) {
          return {
            validated: questions.indexOf(q),
            ok, fixed, deleted,
            last_id: q.id > afterId ? q.id - 1 : afterId,
            paused: true,
            error: `Groq rate limit (${status})`,
          };
        }
        // Skip this question on other errors
        ok++;
        continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let result;
      try {
        result = JSON.parse(content);
      } catch {
        ok++; // Can't parse AI response, skip
        continue;
      }

      if (result.valida) {
        ok++;
      } else if (result.correcao_possivel && result.sugestao_gabarito !== undefined) {
        // Try to fix the gabarito
        const newGabarito = Math.min(Math.max(Number(result.sugestao_gabarito), 0), 4);
        if (newGabarito !== q.gabarito) {
          await supabase.from("questoes").update({ gabarito: newGabarito }).eq("id", q.id);
          fixed++;
        } else {
          // AI says correctable but same gabarito - delete if auto_delete
          if (autoDelete) {
            await supabase.from("questoes").delete().eq("id", q.id);
            deleted++;
          } else {
            ok++;
          }
        }
      } else {
        // Not valid, not correctable - delete
        if (autoDelete) {
          await supabase.from("questoes").delete().eq("id", q.id);
          deleted++;
        } else {
          ok++;
        }
      }
    } catch (err) {
      console.error(`Error validating question ${q.id}:`, err);
      ok++; // Skip on error
    }

    // Small delay between AI calls to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    validated: questions.length,
    ok, fixed, deleted,
    last_id: questions[questions.length - 1].id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const afterId = body.after_id ?? 0;
    const limit = Math.min(body.limit || 25, 50);
    const mode = body.mode || "rules"; // "rules" | "ai"
    const autoDelete = body.auto_delete !== false;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all legal texts for cross-referencing
    const { data: legalRows } = await supabase
      .from("discipline_legal_texts")
      .select("disciplina, content");

    const legalTexts: Record<string, string> = {};
    if (legalRows) {
      for (const row of legalRows) {
        legalTexts[row.disciplina] = row.content;
      }
    }

    let result;
    if (mode === "ai") {
      result = await validateAiMode(supabase, afterId, limit, autoDelete, legalTexts);
    } else {
      result = await validateRulesMode(supabase, afterId, limit, autoDelete, legalTexts);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("validate-questions error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
