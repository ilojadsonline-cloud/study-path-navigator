import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[§º°ª.,;:!?\-–—""''\"\']/g, " ").replace(/\s+/g, " ").trim();
}

/** Extract ALL article numbers cited in text */
function extractAllCitedArticles(text: string): string[] {
  const matches = text.match(/Art\.?\s*(\d+)/gi) || [];
  return [...new Set(matches.map(m => m.match(/\d+/)?.[0] || "").filter(Boolean))];
}

/** Check if a specific article number exists in the law text */
function articleExistsInLaw(artNum: string, lawText: string): boolean {
  const num = artNum.match(/\d+/)?.[0];
  if (!num) return false;
  const regex = new RegExp(`Art\\.?\\s*${num}[^\\d]`, "i");
  return regex.test(lawText);
}

/** Find text snippet in the law and return the nearest article */
function findArticleForText(snippet: string, lawText: string): string | null {
  if (!snippet || snippet.length < 15) return null;
  const normSnippet = normalize(snippet);
  const normLaw = normalize(lawText);

  for (let len = normSnippet.length; len >= Math.min(25, normSnippet.length); len -= 8) {
    const probe = normSnippet.substring(0, len);
    const pos = normLaw.indexOf(probe);
    if (pos !== -1) {
      const before = lawText.substring(0, Math.min(pos + 300, lawText.length));
      const artRegex = /Art\.?\s*(\d+)/gi;
      let lastMatch: string | null = null;
      let m: RegExpExecArray | null;
      while ((m = artRegex.exec(before)) !== null) lastMatch = m[1];
      return lastMatch ? `Art. ${lastMatch}` : null;
    }
  }
  return null;
}

/** Validate ALL cited articles exist in law */
function validateAllCitations(comment: string, lawText: string): { valid: boolean; missing: string[] } {
  const cited = extractAllCitedArticles(comment);
  const missing: string[] = [];
  for (const artNum of cited) {
    if (!articleExistsInLaw(artNum, lawText)) missing.push(`Art. ${artNum}`);
  }
  return { valid: missing.length === 0, missing };
}

/** Cross-validate enunciado vs comment references */
function crossValidateReferences(enunciado: string, comment: string): { valid: boolean; reason: string } {
  const enunciadoArts = extractAllCitedArticles(enunciado);
  const commentArts = extractAllCitedArticles(comment);
  if (enunciadoArts.length > 0 && commentArts.length > 0) {
    const overlap = enunciadoArts.some(a => commentArts.includes(a));
    if (!overlap) {
      return { valid: false, reason: `Enunciado cita Art. ${enunciadoArts.join(",")} mas comentário cita Art. ${commentArts.join(",")}` };
    }
  }
  return { valid: true, reason: "" };
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

  const timestamp = new Date().toISOString();
  const questoesRevisaoManual: Array<{ id: number; motivo: string }> = [];
  const errosEncontrados: Array<{ codigo: string; descricao: string }> = [];

  try {
    const body = await req.json();
    const afterId = body.after_id ?? 0;
    const limit = Math.min(body.limit || 5, 10);
    const mode: "rules" | "ai" = body.mode || "rules";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // 1. Fetch questions batch
    const { data: questions, error } = await supabase
      .from("questoes").select("*").gt("id", afterId).order("id", { ascending: true }).limit(limit);

    if (error) throw error;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({
        status: "sucesso", mensagem: "Nenhuma questão pendente.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [] },
        success: true, validated: 0, ok: 0, fixed: 0, deleted: 0, last_id: afterId,
        timestamp,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Fetch legal texts
    const { data: legalRows } = await supabase.from("discipline_legal_texts").select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    if (legalRows) legalRows.forEach(row => { legalTexts[row.disciplina] = row.content; });

    let okCount = 0;
    let fixedCount = 0;
    let deletedCount = 0;
    const details: Array<{ id: number; status: string; motivo: string }> = [];

    for (const q of questions!) {
      const lawText = legalTexts[q.disciplina];

      if (!lawText) {
        okCount++;
        details.push({ id: q.id, status: "pular", motivo: "Sem texto legal cadastrado" });
        console.log(`[VALIDAR] #${q.id} PULAR: sem texto legal para "${q.disciplina}"`);
        continue;
      }

      // ── STEP A: Comprehensive Validation ──────────────────────

      const correctAltKey = ALT_KEYS[q.gabarito] || "alt_a";
      const correctAltText: string = q[correctAltKey] || "";
      const realArticle = findArticleForText(correctAltText, lawText);
      const commentCitedArts = extractAllCitedArticles(q.comentario || "");

      let needsFix = false;
      let fixReason = "";
      let isUnfixable = false;

      // Check 1: ALL cited articles must exist in law
      const citationCheck = validateAllCitations(q.comentario || "", lawText);
      if (!citationCheck.valid) {
        needsFix = true;
        fixReason = `Artigos inexistentes: ${citationCheck.missing.join(", ")}`;
        console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
      }

      // Check 2: Cross-validation — enunciado vs comment
      if (!needsFix) {
        const crossCheck = crossValidateReferences(q.enunciado, q.comentario || "");
        if (!crossCheck.valid) {
          needsFix = true;
          fixReason = crossCheck.reason;
          console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
        }
      }

      // Check 3: Article mismatch — comment cites different article than where correct answer is
      if (!needsFix && realArticle && commentCitedArts.length > 0) {
        const realNum = realArticle.match(/\d+/)?.[0];
        const allMatch = commentCitedArts.some(a => a === realNum);
        if (!allMatch) {
          needsFix = true;
          fixReason = `Comentário cita Art. ${commentCitedArts.join(",")} mas resposta está no ${realArticle}`;
          console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
        }
      }

      // Check 4: No article cited at all in comment
      if (!needsFix && commentCitedArts.length === 0) {
        needsFix = true;
        fixReason = "Comentário não cita nenhum artigo";
        console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
      }

      // Check 5: Correct answer text not found in law
      if (!needsFix && correctAltText.length > 20 && !realArticle) {
        needsFix = true;
        fixReason = "Texto da alternativa correta não encontrado na lei";
        console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
      }

      // Check 6: Structural issues
      if (!needsFix) {
        const alts = ALT_KEYS.map(k => (q[k] || "").trim());
        const uniqueAlts = new Set(alts.map(a => normalize(a)));
        if (uniqueAlts.size < 5) {
          needsFix = true;
          fixReason = "Alternativas duplicadas";
        } else if (alts.some(a => a.length < 3)) {
          needsFix = true;
          fixReason = "Alternativa vazia ou muito curta";
        } else if (q.gabarito < 0 || q.gabarito > 4) {
          needsFix = true;
          fixReason = "Gabarito fora do range 0-4";
        }
      }

      // ── STEP B: Apply fix ───────────────────────────────────────

      if (!needsFix) {
        okCount++;
        details.push({ id: q.id, status: "ok", motivo: realArticle ? `Validada (${realArticle})` : "Validada OK" });
        console.log(`[VALIDAR] #${q.id} OK ${realArticle || ""}`);
        continue;
      }

      if (mode === "rules") {
        // Rules mode: fix what we can, delete what we can't
        if (realArticle && fixReason.includes("cita")) {
          // Fix: replace wrong article references with correct one
          let newComment = q.comentario;
          for (const artNum of commentCitedArts) {
            const wrongArt = `Art. ${artNum}`;
            newComment = newComment.replace(new RegExp(wrongArt.replace(".", "\\."), "gi"), realArticle);
          }
          // Re-validate after fix
          const recheck = validateAllCitations(newComment, lawText);
          if (recheck.valid) {
            await supabase.from("questoes").update({ comentario: newComment }).eq("id", q.id);
            fixedCount++;
            details.push({ id: q.id, status: "corrigida", motivo: `Comentário corrigido: ${fixReason}` });
            console.log(`[VALIDAR] #${q.id} CORRIGIDA: ${fixReason} → ${realArticle}`);
          } else {
            // Fix didn't help — mark for manual review
            questoesRevisaoManual.push({ id: q.id, motivo: `${fixReason} (auto-correção falhou: ${recheck.missing.join(", ")} restam)` });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: `${fixReason} (incorrigível)` });
            console.log(`[VALIDAR] #${q.id} EXCLUÍDA: correção falhou`);
          }
        } else if (fixReason === "Gabarito fora do range 0-4") {
          await supabase.from("questoes").update({ gabarito: clampGabarito(q.gabarito) }).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: fixReason });
          console.log(`[VALIDAR] #${q.id} CORRIGIDA: gabarito clamped`);
        } else {
          // Can't fix — delete and log for manual review
          questoesRevisaoManual.push({ id: q.id, motivo: fixReason });
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluida", motivo: fixReason });
          console.log(`[VALIDAR] #${q.id} EXCLUÍDA: ${fixReason}`);
        }
        continue;
      }

      // ── AI mode: rewrite with Lovable AI ─────────────────────

      const prompt = `Você é um auditor jurídico militar EXTREMAMENTE RIGOROSO. Analise se a questão abaixo é 100% FIEL ao texto legal fornecido.

REGRAS INVIOLÁVEIS:
- NUNCA invente, alucine ou fabrique artigos, parágrafos ou trechos de lei.
- Use EXCLUSIVAMENTE o texto legal fornecido abaixo como fonte de verdade.
- O comentário é uma PROVA IRREFUTÁVEL da alternativa correta.
- ANTES de citar "Art. X", confirme que esse artigo EXISTE no texto fornecido.
- Se não encontrar base legal literal, responda com valida=false.

TEXTO LEGAL (${q.disciplina}):
${lawText.substring(0, 30000)}

QUESTÃO:
ID: ${q.id} | Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário Atual: ${q.comentario}

PROBLEMA DETECTADO: ${fixReason}
${realArticle ? `O texto da alternativa correta foi localizado no ${realArticle} do texto legal.` : "O texto da alternativa correta NÃO foi localizado no texto legal."}

SUA TAREFA:
1. Reescreva a questão para que fique 100% correta e fiel à lei seca.
2. O comentário DEVE incluir: "Conforme o Art. X: '[transcrição literal]'."
3. VERIFIQUE que cada artigo citado EXISTE no texto legal fornecido.
${realArticle ? `4. O comentário DEVE referenciar o ${realArticle} (confirmado por busca literal).` : "4. Se não encontrar base legal, responda com valida=false e motivo_erro."}
5. gabarito: 0=A, 1=B, 2=C, 3=D, 4=E.

Responda APENAS em JSON:
{
  "valida": true/false,
  "motivo_erro": "se invalida, explique",
  "enunciado": "...",
  "alt_a": "...", "alt_b": "...", "alt_c": "...", "alt_d": "...", "alt_e": "...",
  "gabarito": 0,
  "comentario": "Conforme o Art. X: '...'"
}`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          if (aiResponse.status === 429 || aiResponse.status === 402) {
            const msg = aiResponse.status === 429 ? "Rate limit atingido. Aguarde e retome." : "Créditos insuficientes.";
            return new Response(JSON.stringify({
              status: "parcial", mensagem: msg, paused: true,
              detalhes: {
                total_processado: okCount + fixedCount + deletedCount,
                questoes_criadas: 0, questoes_corrigidas: fixedCount,
                questoes_revisao_manual: questoesRevisaoManual,
                erros_encontrados: [{ codigo: "RATE_LIMIT", descricao: msg }],
              },
              success: true, validated: okCount + fixedCount + deletedCount, ok: okCount, fixed: fixedCount, deleted: deletedCount,
              last_id: q.id, details, error: msg, timestamp,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw new Error(`AI Gateway ${aiResponse.status}: ${errText.substring(0, 200)}`);
        }

        const aiData = await aiResponse.json();
        let content = aiData.choices?.[0]?.message?.content || "";
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(content);

        if (result.valida === false) {
          questoesRevisaoManual.push({ id: q.id, motivo: result.motivo_erro || fixReason });
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluida", motivo: result.motivo_erro || fixReason });
          console.log(`[VALIDAR] #${q.id} EXCLUÍDA (IA): ${result.motivo_erro || fixReason}`);
        } else {
          let finalComment = result.comentario || q.comentario;

          // Post-AI validation: verify ALL cited articles in the AI's new comment exist
          const postCheck = validateAllCitations(finalComment, lawText);
          if (!postCheck.valid) {
            console.log(`[VALIDAR] #${q.id} IA AINDA ALUCINANDO: ${postCheck.missing.join(", ")}`);
            // AI hallucinated — delete instead of keeping bad data
            questoesRevisaoManual.push({ id: q.id, motivo: `IA reescreveu mas ainda cita artigos inexistentes: ${postCheck.missing.join(", ")}` });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: `Alucinação persistente: ${postCheck.missing.join(", ")}` });
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          // Cross-validate AI's rewritten enunciado vs comment
          const crossCheck = crossValidateReferences(result.enunciado || q.enunciado, finalComment);
          if (!crossCheck.valid) {
            console.log(`[VALIDAR] #${q.id} IA DIVERGÊNCIA: ${crossCheck.reason}`);
            questoesRevisaoManual.push({ id: q.id, motivo: `IA reescreveu com divergência: ${crossCheck.reason}` });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: `Divergência pós-IA: ${crossCheck.reason}` });
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          // Force correct article if we know the real one
          if (realArticle) {
            const aiCitedArticles = extractAllCitedArticles(finalComment);
            const realNum = realArticle.match(/\d+/)?.[0];
            const aiMatchesReal = aiCitedArticles.some(a => a === realNum);
            if (!aiMatchesReal && aiCitedArticles.length > 0) {
              for (const artNum of aiCitedArticles) {
                const wrongArt = `Art. ${artNum}`;
                finalComment = finalComment.replace(new RegExp(wrongArt.replace(".", "\\."), "gi"), realArticle);
              }
              console.log(`[VALIDAR] #${q.id} FORÇADO: artigo corrigido para ${realArticle}`);
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
          console.log(`[VALIDAR] #${q.id} CORRIGIDA (IA): ${fixReason}`);
        }
      } catch (aiErr) {
        questoesRevisaoManual.push({ id: q.id, motivo: `Erro IA: ${String(aiErr).substring(0, 100)}` });
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Erro IA: ${String(aiErr).substring(0, 100)}` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: erro IA - ${String(aiErr).substring(0, 100)}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const totalProcessado = okCount + fixedCount + deletedCount;
    const statusResult = deletedCount > 0 || questoesRevisaoManual.length > 0 ? "parcial" : "sucesso";
    const mensagem = `${totalProcessado} revisadas · ${okCount} OK · ${fixedCount} corrigidas · ${deletedCount} excluídas · ${questoesRevisaoManual.length} para revisão manual`;

    console.log(`[VALIDAR] RESULTADO: ${mensagem}`);

    return new Response(JSON.stringify({
      status: statusResult,
      mensagem,
      detalhes: {
        total_processado: totalProcessado,
        questoes_criadas: 0,
        questoes_corrigidas: fixedCount,
        questoes_revisao_manual: questoesRevisaoManual,
        erros_encontrados: errosEncontrados,
      },
      // Legacy fields for frontend compatibility
      success: true,
      validated: totalProcessado,
      ok: okCount,
      fixed: fixedCount,
      deleted: deletedCount,
      details,
      last_id: questions[questions.length - 1]?.id,
      timestamp,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[VALIDAR] Unexpected error:", String(err));
    return new Response(JSON.stringify({
      status: "erro",
      mensagem: String(err),
      detalhes: {
        total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0,
        questoes_revisao_manual: questoesRevisaoManual,
        erros_encontrados: [{ codigo: "UNEXPECTED", descricao: String(err) }],
      },
      success: false, error: String(err), timestamp,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
