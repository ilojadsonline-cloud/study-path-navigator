import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────

/** Normalize whitespace & punctuation for fuzzy matching */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[§º°ª.,;:!?\-–—""''\"\']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Find which Art. contains a given text snippet inside the law.
 *  Returns the article label (e.g. "Art. 12") or null. */
function findArticleForText(snippet: string, lawText: string): string | null {
  if (!snippet || snippet.length < 15) return null;

  const normSnippet = normalize(snippet);
  const normLaw = normalize(lawText);

  // Try progressively shorter prefixes of the snippet (min 30 chars)
  for (let len = normSnippet.length; len >= Math.min(30, normSnippet.length); len -= 10) {
    const probe = normSnippet.substring(0, len);
    const pos = normLaw.indexOf(probe);
    if (pos !== -1) {
      // Walk backwards in the ORIGINAL law text to find the nearest "Art." header
      const originalPos = findOriginalPosition(lawText, pos);
      return extractArticleAtPosition(lawText, originalPos);
    }
  }

  // Fallback: try a shorter chunk (first 40 normalized chars)
  const shortProbe = normSnippet.substring(0, 40);
  const pos = normLaw.indexOf(shortProbe);
  if (pos !== -1) {
    const originalPos = findOriginalPosition(lawText, pos);
    return extractArticleAtPosition(lawText, originalPos);
  }

  return null;
}

/** Map a position in the normalized text back to approximate position in original */
function findOriginalPosition(original: string, normalizedPos: number): number {
  // Re-normalize character by character to map positions
  let normIdx = 0;
  for (let i = 0; i < original.length && normIdx < normalizedPos; i++) {
    const ch = original[i];
    const normCh = normalize(ch);
    if (normCh.length > 0) normIdx += normCh.length;
  }
  // Return approximate position — we'll search backwards from here
  return Math.min(normalizedPos, original.length - 1);
}

/** Extract the nearest Art. N label before a given position */
function extractArticleAtPosition(lawText: string, pos: number): string | null {
  const before = lawText.substring(0, pos + 200);
  // Find all "Art. N" occurrences before this position
  const artRegex = /Art\.?\s*(\d+)/gi;
  let lastMatch: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = artRegex.exec(before)) !== null) {
    lastMatch = `Art. ${m[1]}`;
  }
  return lastMatch;
}

/** Extract all article numbers cited in a comment string */
function extractCitedArticles(comment: string): string[] {
  const matches = comment.match(/Art\.?\s*(\d+)/gi) || [];
  return matches.map(m => {
    const num = m.match(/\d+/)?.[0];
    return num ? `Art. ${num}` : m;
  });
}

/** Check if a specific article number exists in the law text */
function articleExistsInLaw(artNum: string, lawText: string): boolean {
  const num = artNum.match(/\d+/)?.[0];
  if (!num) return false;
  const regex = new RegExp(`Art\\.?\\s*${num}[^\\d]`, "i");
  return regex.test(lawText);
}

/** Clamp gabarito to 0-4 integer */
function clampGabarito(val: unknown): number {
  const n = parseInt(String(val));
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(4, n));
}

// ── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const afterId = body.after_id ?? 0;
    const limit = Math.min(body.limit || 5, 10);
    const mode: "rules" | "ai" = body.mode || "rules";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // 1. Fetch questions batch
    const { data: questions, error } = await supabase
      .from("questoes")
      .select("*")
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw error;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({
        success: true, validated: 0, ok: 0, fixed: 0, deleted: 0, last_id: afterId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Fetch legal texts
    const { data: legalRows } = await supabase
      .from("discipline_legal_texts")
      .select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    if (legalRows) legalRows.forEach(row => { legalTexts[row.disciplina] = row.content; });

    let okCount = 0;
    let fixedCount = 0;
    let deletedCount = 0;
    const details: Array<{ id: number; status: string; motivo: string }> = [];

    for (const q of questions!) {
      const lawText = legalTexts[q.disciplina];

      if (!lawText) {
        // No legal text available — skip
        okCount++;
        details.push({ id: q.id, status: "pular", motivo: "Sem texto legal cadastrado" });
        continue;
      }

      // ── STEP A: Literal Confrontation (both modes) ──────────────

      const correctAltKey = ALT_KEYS[q.gabarito] || "alt_a";
      const correctAltText: string = q[correctAltKey] || "";
      const realArticle = findArticleForText(correctAltText, lawText);
      const citedArticles = extractCitedArticles(q.comentario || "");

      let needsFix = false;
      let fixReason = "";

      // Check 1: Does the correct answer text actually exist in the law?
      if (!realArticle && correctAltText.length > 20) {
        // Text not found in law at all — suspicious
        needsFix = true;
        fixReason = "Texto da alternativa correta não encontrado na lei";
      }

      // Check 2: Article mismatch — comment cites wrong article
      if (realArticle && citedArticles.length > 0) {
        const realNum = realArticle.match(/\d+/)?.[0];
        const allMatch = citedArticles.some(c => c.match(/\d+/)?.[0] === realNum);
        if (!allMatch) {
          needsFix = true;
          fixReason = `Comentário cita ${citedArticles.join(", ")} mas texto está no ${realArticle}`;
        }
      }

      // Check 3: Cited articles don't exist in the law
      for (const cited of citedArticles) {
        if (!articleExistsInLaw(cited, lawText)) {
          needsFix = true;
          fixReason = `${cited} não existe no texto legal`;
          break;
        }
      }

      // Check 4: Structural issues
      const alts = ALT_KEYS.map(k => (q[k] || "").trim());
      const uniqueAlts = new Set(alts.map(a => normalize(a)));
      if (uniqueAlts.size < 5) {
        needsFix = true;
        fixReason = "Alternativas duplicadas";
      }
      if (alts.some(a => a.length < 3)) {
        needsFix = true;
        fixReason = "Alternativa vazia ou muito curta";
      }
      if (q.gabarito < 0 || q.gabarito > 4) {
        needsFix = true;
        fixReason = "Gabarito fora do range 0-4";
      }

      // ── STEP B: Apply fix ───────────────────────────────────────

      if (!needsFix) {
        okCount++;
        details.push({ id: q.id, status: "ok", motivo: realArticle ? `Validada (${realArticle})` : "Validada OK" });
        continue;
      }

      if (mode === "rules") {
        // Rules mode: fix comment article reference if possible, or delete
        if (realArticle && fixReason.includes("cita")) {
          // Simple fix: replace wrong article in comment
          let newComment = q.comentario;
          for (const cited of citedArticles) {
            newComment = newComment.replace(new RegExp(cited.replace(".", "\\."), "gi"), realArticle);
          }
          await supabase.from("questoes").update({ comentario: newComment }).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: `Comentário corrigido: ${fixReason}` });
        } else if (fixReason === "Gabarito fora do range 0-4") {
          await supabase.from("questoes").update({ gabarito: clampGabarito(q.gabarito) }).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: fixReason });
        } else {
          // Can't fix structurally — delete
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluida", motivo: fixReason });
        }
        continue;
      }

      // ── AI mode: rewrite with Lovable AI ─────────────────────

      const prompt = `Você é um auditor jurídico militar rigoroso. Analise se a questão abaixo é 100% FIEL ao texto legal fornecido.

TEXTO LEGAL (${q.disciplina}):
${lawText.substring(0, 30000)}

QUESTÃO:
ID: ${q.id} | Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário Atual: ${q.comentario}

PROBLEMA DETECTADO: ${fixReason}
${realArticle ? `O texto da alternativa correta foi localizado no ${realArticle} do texto legal.` : "O texto da alternativa correta NÃO foi localizado no texto legal."}

SUA TAREFA:
1. É PROIBIDO usar conhecimento externo. Use APENAS o texto legal acima.
2. Reescreva a questão para que fique 100% correta e fiel à lei seca.
3. O comentário DEVE citar o artigo/parágrafo/inciso CORRETO onde o conteúdo está literalmente no texto legal.
${realArticle ? `4. O comentário DEVE referenciar o ${realArticle} (já confirmado por busca literal).` : "4. Se não encontrar base legal, responda com valida=false e motivo_erro explicando."}
5. O gabarito DEVE ser um número inteiro: 0=A, 1=B, 2=C, 3=D, 4=E.

Responda APENAS em JSON:
{
  "valida": true/false,
  "motivo_erro": "se invalida, explique",
  "enunciado": "texto corrigido ou original",
  "alt_a": "...", "alt_b": "...", "alt_c": "...", "alt_d": "...", "alt_e": "...",
  "gabarito": 0,
  "comentario": "Comentário com citação literal e correta da lei"
}`;

      try {
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          // Rate limit — pause
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({
              success: true, paused: true, error: "Rate limit Groq. Aguarde e retome.",
              validated: okCount + fixedCount + deletedCount, ok: okCount, fixed: fixedCount, deleted: deletedCount,
              last_id: q.id, details,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw new Error(`Groq ${aiResponse.status}: ${errText.substring(0, 200)}`);
        }

        const aiData = await aiResponse.json();
        let content = aiData.choices?.[0]?.message?.content || "";
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(content);

        if (result.valida === false) {
          // AI says it's unfixable — delete
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluida", motivo: result.motivo_erro || fixReason });
        } else {
          // AI fixed it — apply + re-verify article in comment
          let finalComment = result.comentario || q.comentario;

          // Post-AI literal confrontation: verify the AI's article citation
          if (realArticle) {
            const aiCitedArticles = extractCitedArticles(finalComment);
            const realNum = realArticle.match(/\d+/)?.[0];
            const aiMatchesReal = aiCitedArticles.some(c => c.match(/\d+/)?.[0] === realNum);
            if (!aiMatchesReal && aiCitedArticles.length > 0) {
              // AI still got the article wrong — force correct it
              for (const cited of aiCitedArticles) {
                finalComment = finalComment.replace(new RegExp(cited.replace(".", "\\."), "gi"), realArticle);
              }
            }
          }

          const updateData: Record<string, unknown> = {
            enunciado: result.enunciado || q.enunciado,
            alt_a: result.alt_a || q.alt_a,
            alt_b: result.alt_b || q.alt_b,
            alt_c: result.alt_c || q.alt_c,
            alt_d: result.alt_d || q.alt_d,
            alt_e: result.alt_e || q.alt_e,
            gabarito: clampGabarito(result.gabarito),
            comentario: finalComment,
          };

          await supabase.from("questoes").update(updateData).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: fixReason });
        }
      } catch (aiErr) {
        // AI call failed — fallback to delete
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Erro IA: ${String(aiErr).substring(0, 100)}` });
      }

      // Delay between AI calls
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({
      success: true,
      validated: okCount + fixedCount + deletedCount,
      ok: okCount,
      fixed: fixedCount,
      deleted: deletedCount,
      details,
      last_id: questions[questions.length - 1]?.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
