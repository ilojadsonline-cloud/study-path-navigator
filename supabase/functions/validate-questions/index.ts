import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;
const ARTICLE_REGEX = /(?:art(?:igos?)?\.?\s*\d+|§\s*\d+|inciso\s+[ivxlcdm\d]+|anexo\s+[ivxlcdm\d]+)/i;

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

function hasDuplicateAlts(alts: string[]): boolean {
  const norm = alts.map(a => normalizeWhitespace(a).toLowerCase());
  return new Set(norm).size !== norm.length;
}

function extractCitedArticles(text: string): string[] {
  const matches = text.matchAll(/art(?:igos?)?\.?\s*(\d+)/gi);
  return [...matches].map(m => m[1]);
}

function articleExistsInLaw(artNum: string, lawText: string): boolean {
  const lower = lawText.toLowerCase();
  return lower.includes(`art. ${artNum}`) || lower.includes(`artigo ${artNum}`) || lower.includes(`art ${artNum}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const afterId = body.after_id ?? 0;
    const limit = Math.min(body.limit || 10, 20);
    const mode = body.mode || "rules"; // "rules" or "ai"

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    // 1. Fetch questions
    const { data: questions, error } = await supabase
      .from("questoes")
      .select("*")
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw error;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ success: true, validated: 0, ok: 0, fixed: 0, deleted: 0, last_id: afterId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch legal texts
    const { data: legalRows } = await supabase.from("discipline_legal_texts").select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    if (legalRows) legalRows.forEach(row => legalTexts[row.disciplina] = row.content);

    let okCount = 0, fixedCount = 0, deletedCount = 0;
    const details: any[] = [];

    for (const q of questions) {
      const lawText = legalTexts[q.disciplina];

      // --- Structural checks (both modes) ---
      const alts = ALT_KEYS.map(k => normalizeWhitespace(q[k]));
      const enunciado = normalizeWhitespace(q.enunciado);
      const comentario = normalizeWhitespace(q.comentario);
      const gabaritoValid = typeof q.gabarito === "number" && q.gabarito >= 0 && q.gabarito <= 4;

      // Irrecoverable structural issues → delete
      const hasEmptyAlt = alts.some(a => !a || a.length < 2);
      const hasDupes = hasDuplicateAlts(alts);
      const shortEnunciado = enunciado.length < 25;
      const noLegalRef = !ARTICLE_REGEX.test(comentario);

      if (hasEmptyAlt || hasDupes || shortEnunciado) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluída", motivo: hasEmptyAlt ? "Alternativa vazia" : hasDupes ? "Alternativas duplicadas" : "Enunciado curto" });
        continue;
      }

      // Strip prefixes from alternatives
      const cleanedAlts: Record<string, string> = {};
      let altChanged = false;
      for (const k of ALT_KEYS) {
        const cleaned = stripAlternativePrefix(q[k]);
        if (cleaned !== normalizeWhitespace(q[k])) altChanged = true;
        cleanedAlts[k] = cleaned;
      }

      // Fix gabarito if needed
      const gabaritoFix: Record<string, any> = {};
      if (!gabaritoValid) {
        gabaritoFix.gabarito = Math.min(Math.max(Number(q.gabarito) || 0, 0), 4);
      }

      // Apply structural fixes
      if (altChanged || Object.keys(gabaritoFix).length > 0) {
        await supabase.from("questoes").update({ ...cleanedAlts, ...gabaritoFix }).eq("id", q.id);
      }

      // --- Legal verification ---
      if (!lawText) {
        // No legal text to compare against
        if (noLegalRef) {
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluída", motivo: "Sem referência legal e sem texto para comparar" });
        } else {
          okCount++;
          details.push({ id: q.id, status: "ok", motivo: "Sem texto legal para validar profundamente" });
        }
        continue;
      }

      // Check if cited articles exist in law
      const citedArticles = extractCitedArticles(comentario);
      const allArticlesExist = citedArticles.length > 0 && citedArticles.every(a => articleExistsInLaw(a, lawText));

      if (allArticlesExist) {
        okCount++;
        details.push({ id: q.id, status: "ok", motivo: `Artigo(s) ${citedArticles.join(", ")} verificado(s)` });
        continue;
      }

      // --- Repair mode ---
      if (mode === "rules") {
        // Rules mode: if article doesn't exist, delete
        if (citedArticles.length > 0) {
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluída", motivo: `Artigo(s) ${citedArticles.join(", ")} não encontrado(s) na lei` });
        } else if (noLegalRef) {
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluída", motivo: "Comentário sem referência legal" });
        } else {
          okCount++;
          details.push({ id: q.id, status: "ok", motivo: "Referência genérica aceita" });
        }
        continue;
      }

      // AI mode: attempt repair using Groq
      if (!GROQ_API_KEY) {
        details.push({ id: q.id, status: "pular", motivo: "GROQ_API_KEY não configurada" });
        continue;
      }

      try {
        const repairPrompt = `Você é um revisor jurídico rigoroso. Corrija a questão abaixo para que fique 100% fiel ao texto legal fornecido.

REGRAS:
- Use APENAS o texto legal fornecido abaixo. É PROIBIDO usar conhecimento externo.
- Se o artigo citado não existir no texto, substitua pelo artigo correto que fundamenta a questão.
- Se não houver fundamento legal no texto para a questão, responda com {"excluir": true}.
- O gabarito DEVE ser um número inteiro: 0=A, 1=B, 2=C, 3=D, 4=E.
- Todas as 5 alternativas devem ser distintas e sem prefixo (sem "A)", "Letra A", etc.).

TEXTO LEGAL (${q.disciplina}):
${lawText.substring(0, 25000)}

QUESTÃO:
Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito: ${q.gabarito} | Comentário: ${q.comentario}

Responda APENAS em JSON (sem markdown):
{"enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"..."}
ou {"excluir": true} se não houver fundamento.`;

        const aiResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: repairPrompt }],
            temperature: 0.1,
          }),
        });

        if (aiResp.status === 429 || aiResp.status === 402) {
          return new Response(JSON.stringify({
            success: false, paused: true,
            error: aiResp.status === 429 ? "Rate limit atingido. Aguarde e tente novamente." : "Créditos Groq insuficientes.",
            validated: okCount + fixedCount + deletedCount, ok: okCount, fixed: fixedCount, deleted: deletedCount,
            last_id: q.id, detalhes: details,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!aiResp.ok) {
          details.push({ id: q.id, status: "erro", motivo: `AI status ${aiResp.status}` });
          continue;
        }

        const aiData = await aiResp.json();
        let content = aiData.choices?.[0]?.message?.content || "";
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(content);

        if (parsed.excluir) {
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluída", motivo: "IA determinou sem fundamento legal" });
        } else {
          // Validate repair
          parsed.gabarito = Math.min(Math.max(Number(parsed.gabarito) || 0, 0), 4);
          const repairAlts = ALT_KEYS.map(k => stripAlternativePrefix(parsed[k] || ""));
          if (repairAlts.some(a => !a || a.length < 2) || hasDuplicateAlts(repairAlts)) {
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluída", motivo: "Reparo gerou alternativas inválidas" });
          } else {
            const updateData: Record<string, any> = {
              enunciado: normalizeWhitespace(parsed.enunciado),
              comentario: normalizeWhitespace(parsed.comentario),
              gabarito: parsed.gabarito,
            };
            ALT_KEYS.forEach((k, i) => updateData[k] = repairAlts[i]);
            await supabase.from("questoes").update(updateData).eq("id", q.id);
            fixedCount++;
            details.push({ id: q.id, status: "corrigida", motivo: "IA reparou com base no texto legal" });
          }
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (aiErr) {
        details.push({ id: q.id, status: "erro", motivo: String(aiErr) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      validated: okCount + fixedCount + deletedCount,
      ok: okCount,
      fixed: fixedCount,
      deleted: deletedCount,
      detalhes: details,
      last_id: questions[questions.length - 1]?.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
