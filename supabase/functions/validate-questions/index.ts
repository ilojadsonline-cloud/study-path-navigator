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
  // Regex aprimorada para capturar números de artigos de forma mais precisa
  const matches = [...text.matchAll(/art(?:igo|igos)?\.?\s*(\d+)/gi)];
  return [...new Set(matches.map((m) => m[1]))];
}

function articleExistsInLaw(comment: string, lawText: string): boolean {
  const cited = extractArticleNumbers(comment);
  if (cited.length === 0) return true; // Se não citar artigo, não falha por "artigo inexistente" (mas pode falhar em outra regra)
  
  const lw = normalize(lawText).toLowerCase();
  // Verifica se o artigo citado realmente existe no texto legal
  return cited.every((a) => {
    const pattern = new RegExp(`art(?:igo)?\\.?\\s*${a}\\b`, 'i');
    return pattern.test(lw);
  });
}

// ─── RULES MODE (RIGOROSO) ──────────────────────────────────────
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

    // 1. Limpeza de prefixos
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

    // 2. Validação de Enunciado
    if (!q.enunciado || normalize(q.enunciado).length < 25) {
      issues.push("Enunciado muito curto");
    }

    // 3. Validação de Comentário e Referência Legal
    if (!q.comentario || !ARTICLE_REGEX.test(q.comentario)) {
      issues.push("Comentário sem referência legal");
    }

    // 4. Validação de Gabarito
    if (q.gabarito === null || q.gabarito < 0 || q.gabarito > 4) {
      issues.push("Gabarito inválido");
    }

    // 5. Alternativas Duplicadas
    if (hasDuplicateAlts(alts)) {
      issues.push("Alternativas duplicadas");
    }

    // 6. CROSS-CHECK CRÍTICO: O artigo citado existe na lei?
    const lawText = legalTexts[q.disciplina];
    if (lawText && q.comentario) {
      if (!articleExistsInLaw(q.comentario, lawText)) {
        issues.push("Artigo citado NÃO existe no texto legal desta disciplina");
      }
    }

    // DECISÃO: Deletar se houver problemas críticos
    const criticalIssues = issues.some((i) => 
      i.includes("inválida") || 
      i.includes("duplicadas") || 
      i.includes("NÃO existe") || 
      i.includes("Gabarito inválido")
    );

    if (criticalIssues && autoDelete) {
      await supabase.from("questoes").delete().eq("id", q.id);
      deleted++;
    } else if (Object.keys(updates).length > 0 && issues.length === 0) {
      await supabase.from("questoes").update(updates).eq("id", q.id);
      fixed++;
    } else if (issues.length === 0) {
      ok++;
    } else if (autoDelete) {
      // Se tem qualquer issue e autoDelete está on, remove para garantir qualidade
      await supabase.from("questoes").delete().eq("id", q.id);
      deleted++;
    } else {
      ok++;
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

// ─── AI MODE (GROQ - MAIS RÍGIDO) ───────────────────────────────
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
      // Sem texto legal para comparar, não podemos validar via IA com segurança
      ok++;
      continue;
    }

    const prompt = `Você é um auditor jurídico rigoroso. Analise se a questão abaixo é FIEL ao texto legal fornecido.
    
TEXTO LEGAL (${q.disciplina}):
${lawText.substring(0, 35000)}

QUESTÃO:
Enunciado: ${q.enunciado}
A) ${q.alt_a}
B) ${q.alt_b}
C) ${q.alt_c}
D) ${q.alt_d}
E) ${q.alt_e}
Gabarito: ${String.fromCharCode(65 + q.gabarito)}
Comentário: ${q.comentario}

REGRAS DE AUDITORIA:
1. O artigo citado no comentário EXISTE no texto legal acima? (Se não existir, a questão é INVÁLIDA)
2. O conteúdo da alternativa correta é LITERALMENTE o que diz a lei?
3. Há alguma contradição entre a questão e a lei?

Responda APENAS em JSON:
{
  "valida": true/false,
  "motivo": "explicação curta",
  "sugestao_gabarito": 0-4
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
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) return { validated: questions.indexOf(q), ok, fixed, deleted, last_id: q.id - 1, paused: true };
        ok++; continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(content);

      if (result.valida) {
        ok++;
      } else if (autoDelete) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deleted++;
      } else {
        ok++;
      }
    } catch (err) {
      ok++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return {
    validated: questions.length,
    ok, fixed, deleted,
    last_id: questions[questions.length - 1].id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const afterId = body.after_id ?? 0;
    const limit = Math.min(body.limit || 25, 50);
    const mode = body.mode || "rules";
    const autoDelete = body.auto_delete !== false;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: legalRows } = await supabase.from("discipline_legal_texts").select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    if (legalRows) legalRows.forEach(row => legalTexts[row.disciplina] = row.content);

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
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
