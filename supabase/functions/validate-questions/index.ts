import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;
type ArticleBlock = { artNum: string; text: string; normText: string };

// ── Helpers ──────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[§º°ª.,;:!?\-–—""''\"\']/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeWhitespace(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/** Parse law text into article blocks: { artNum: "5", text: "full text of article 5..." } */
function parseArticleBlocks(lawText: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const regex = /Art\.?\s*(\d+)/gi;
  const positions: Array<{ num: string; pos: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(lawText)) !== null) {
    positions.push({ num: m[1], pos: m.index });
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos;
    const end = i + 1 < positions.length ? positions[i + 1].pos : lawText.length;
    const text = lawText.substring(start, end);
    blocks.push({ artNum: positions[i].num, text, normText: normalize(text) });
  }
  return blocks;
}

function findUniqueArticleMatch(probe: string, blocks: ArticleBlock[]): string | null {
  const matches = blocks.filter(block => block.normText.includes(probe));
  return matches.length === 1 ? `Art. ${matches[0].artNum}` : null;
}

/** Find which article block contains a text snippet */
function findArticleForText(snippet: string, blocks: ArticleBlock[]): string | null {
  const cleanedSnippet = normalizeWhitespace(snippet);
  if (!cleanedSnippet || cleanedSnippet.length < 15) return null;
  const normSnippet = normalize(cleanedSnippet);
  if (normSnippet.length < 15) return null;

  if (normSnippet.length >= 25) {
    const exactMatch = findUniqueArticleMatch(normSnippet, blocks);
    if (exactMatch) return exactMatch;
  }

  const words = normSnippet.split(" ").filter(w => w.length > 2);
  for (const windowSize of [12, 10, 8, 6, 5]) {
    if (words.length < windowSize) continue;
    for (let start = 0; start <= words.length - windowSize; start++) {
      const probe = words.slice(start, start + windowSize).join(" ");
      const uniqueMatch = findUniqueArticleMatch(probe, blocks);
      if (uniqueMatch) return uniqueMatch;
    }
  }

  for (let len = Math.min(normSnippet.length, 120); len >= 25; len -= 10) {
    const probe = normSnippet.substring(0, len);
    const uniqueMatch = findUniqueArticleMatch(probe, blocks);
    if (uniqueMatch) return uniqueMatch;
  }

  return null;
}

/** Extract ALL article numbers cited in text */
function extractAllCitedArticles(text: string): string[] {
  const matches = text.match(/Art\.?\s*(\d+)/gi) || [];
  return [...new Set(matches.map(m => m.match(/\d+/)?.[0] || "").filter(Boolean))];
}

function extractCommentEvidenceSnippets(comment: string): string[] {
  const snippets = Array.from(
    comment.matchAll(/["“”'‘’]([^"“”'‘’]{20,500})["“”'‘’]/g),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean);

  const colonTail = normalizeWhitespace(
    comment
      .split(":")
      .slice(1)
      .join(":")
      .replace(/^["“”'‘’]+|["“”'‘’]+$/g, ""),
  );

  if (colonTail.length >= 20) snippets.push(colonTail);
  return [...new Set(snippets)];
}

function detectCommentEvidenceArticle(comment: string, blocks: ArticleBlock[]): string | null {
  for (const snippet of extractCommentEvidenceSnippets(comment)) {
    const article = findArticleForText(snippet, blocks);
    if (article) return article;
  }
  return null;
}

/** Check if a specific article number exists in the law text */
function articleExistsInLaw(artNum: string, blocks: ArticleBlock[]): boolean {
  return blocks.some(b => b.artNum === artNum);
}

/** Validate ALL cited articles exist in law */
function validateAllCitations(comment: string, blocks: ArticleBlock[]): { valid: boolean; missing: string[] } {
  const cited = extractAllCitedArticles(comment);
  const missing: string[] = [];
  for (const artNum of cited) {
    if (!articleExistsInLaw(artNum, blocks)) missing.push(`Art. ${artNum}`);
  }
  return { valid: missing.length === 0, missing };
}

function reconcileCommentArticle(comment: string, targetArticle: string): string {
  let nextComment = normalizeWhitespace(comment);
  const targetNum = targetArticle.match(/\d+/)?.[0];
  if (!targetNum) return nextComment;

  const citedArts = extractAllCitedArticles(nextComment);
  if (citedArts.length > 0) {
    for (const artNum of citedArts) {
      if (artNum !== targetNum) {
        nextComment = nextComment.replace(new RegExp(`Art\\.?\\s*${artNum}(?!\\d)`, "gi"), targetArticle);
      }
    }
  }

  if (extractAllCitedArticles(nextComment).length === 0) {
    nextComment = /^conforme\b/i.test(nextComment)
      ? nextComment.replace(/^conforme\b\s*/i, `Conforme o ${targetArticle}: `)
      : `Conforme o ${targetArticle}: ${nextComment}`;
  }

  return normalizeWhitespace(nextComment);
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

/** Build fingerprint for duplicate detection */
function buildFingerprint(enunciado: string): string {
  return normalize(enunciado).replace(/\s+/g, "").substring(0, 80);
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
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

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

    // 2. Fetch legal texts and parse into article blocks
    const { data: legalRows } = await supabase.from("discipline_legal_texts").select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    const articleBlocksCache: Record<string, Array<{ artNum: string; text: string }>> = {};
    if (legalRows) {
      for (const row of legalRows) {
        legalTexts[row.disciplina] = row.content;
        articleBlocksCache[row.disciplina] = parseArticleBlocks(row.content);
      }
    }

    // 3. Fetch existing fingerprints for duplicate detection (last 500 questions not in current batch)
    const batchIds = new Set(questions.map(q => q.id));
    const { data: existingQuestions } = await supabase
      .from("questoes").select("id, enunciado").order("id", { ascending: false }).limit(500);
    const existingFingerprints = new Map<string, number>();
    if (existingQuestions) {
      for (const eq of existingQuestions) {
        if (!batchIds.has(eq.id)) {
          existingFingerprints.set(buildFingerprint(eq.enunciado), eq.id);
        }
      }
    }

    let okCount = 0;
    let fixedCount = 0;
    let deletedCount = 0;
    const details: Array<{ id: number; status: string; motivo: string }> = [];
    const batchFingerprints = new Map<string, number>(); // Track within-batch duplicates

    for (const q of questions!) {
      const lawText = legalTexts[q.disciplina];
      const blocks = articleBlocksCache[q.disciplina] || [];

      // ── Duplicate check ──────────────────────────────
      const fp = buildFingerprint(q.enunciado);
      const existingDupId = existingFingerprints.get(fp);
      const batchDupId = batchFingerprints.get(fp);
      if (existingDupId) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Duplicata da questão #${existingDupId}` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: duplicata de #${existingDupId}`);
        continue;
      }
      if (batchDupId) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Duplicata da questão #${batchDupId} (no lote)` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: duplicata de #${batchDupId} (lote)`);
        continue;
      }
      batchFingerprints.set(fp, q.id);

      if (!lawText || blocks.length === 0) {
        okCount++;
        details.push({ id: q.id, status: "pular", motivo: "Sem texto legal cadastrado" });
        console.log(`[VALIDAR] #${q.id} PULAR: sem texto legal para "${q.disciplina}"`);
        continue;
      }

      const correctAltKey = ALT_KEYS[q.gabarito] || "alt_a";
      const correctAltText: string = q[correctAltKey] || "";
      const literalArticle = findArticleForText(correctAltText, blocks);
      const evidenceArticle = detectCommentEvidenceArticle(q.comentario || "", blocks);
      const realArticle = evidenceArticle || literalArticle;
      const commentCitedArts = extractAllCitedArticles(q.comentario || "");

      let needsFix = false;
      let fixReason = "";

      // Check 1: ALL cited articles must exist in law
      const citationCheck = validateAllCitations(q.comentario || "", blocks);
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

      // Check 3: Article mismatch — comment cites different article than where correct answer actually is
      if (!needsFix && realArticle && commentCitedArts.length > 0) {
        const realNum = realArticle.match(/\d+/)?.[0];
        const anyMatch = commentCitedArts.some(a => a === realNum);
        if (!anyMatch) {
          needsFix = true;
          fixReason = `Comentário cita Art. ${commentCitedArts.join(",")} mas resposta correta está no ${realArticle}`;
          console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
        }
      }

      // Check 4: No article cited at all in comment
      if (!needsFix && commentCitedArts.length === 0) {
        needsFix = true;
        fixReason = "Comentário não cita nenhum artigo";
        console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
      }

      // Check 5: Correct answer text not found in law at all
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

      // ── STEP B: No fix needed ─────────────────────────────────
      if (!needsFix) {
        okCount++;
        details.push({ id: q.id, status: "ok", motivo: realArticle ? `Validada (${realArticle})` : "Validada OK" });
        console.log(`[VALIDAR] #${q.id} OK ${realArticle || ""}`);
        continue;
      }

      if (mode === "rules") {
        if (realArticle && (commentCitedArts.length === 0 || fixReason.includes("cita") || fixReason.includes("Artigos inexistentes") || fixReason.includes("não cita"))) {
          const newComment = reconcileCommentArticle(q.comentario, realArticle);
          const recheck = validateAllCitations(newComment, blocks);
          if (recheck.valid) {
            await supabase.from("questoes").update({ comentario: newComment }).eq("id", q.id);
            fixedCount++;
            details.push({ id: q.id, status: "corrigida", motivo: `Artigo corrigido para ${realArticle}` });
            console.log(`[VALIDAR] #${q.id} CORRIGIDA: → ${realArticle}`);
            continue;
          }
        }
        if (fixReason === "Gabarito fora do range 0-4") {
          await supabase.from("questoes").update({ gabarito: clampGabarito(q.gabarito) }).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: fixReason });
          console.log(`[VALIDAR] #${q.id} CORRIGIDA: gabarito clamped`);
          continue;
        }
        questoesRevisaoManual.push({ id: q.id, motivo: fixReason });
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: fixReason });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: ${fixReason}`);
        continue;
      }

      // ── STEP D: AI mode — use DeepSeek to rewrite ─────────────
      if (!DEEPSEEK_API_KEY) {
        questoesRevisaoManual.push({ id: q.id, motivo: "DEEPSEEK_API_KEY não configurada" });
        errosEncontrados.push({ codigo: "NO_API_KEY", descricao: "DEEPSEEK_API_KEY ausente" });
        details.push({ id: q.id, status: "erro", motivo: "Sem API key DeepSeek" });
        continue;
      }

      // Build article context: include the real article block + nearby blocks
      let articleContext = "";
      if (realArticle) {
        const realNum = realArticle.match(/\d+/)?.[0];
        const idx = blocks.findIndex(b => b.artNum === realNum);
        if (idx >= 0) {
          const start = Math.max(0, idx - 2);
          const end = Math.min(blocks.length, idx + 3);
          articleContext = `\n\nARTIGOS RELEVANTES CONFIRMADOS POR BUSCA LITERAL:\n${blocks.slice(start, end).map(b => `Art. ${b.artNum}: ${b.text.substring(0, 500)}`).join("\n\n")}`;
        }
      }

      const prompt = `Você é um auditor jurídico EXTREMAMENTE RIGOROSO e preciso.
A questão abaixo tem um ERRO CONFIRMADO: "${fixReason}".
${realArticle ? `A busca literal confirmou que o conteúdo correto está no ${realArticle} do texto legal.` : "O conteúdo correto NÃO foi localizado no texto legal."}

REGRAS INVIOLÁVEIS:
1. Use EXCLUSIVAMENTE o texto legal fornecido. NUNCA invente artigos ou trechos.
2. O comentário DEVE citar o artigo CORRETO com transcrição LITERAL do texto legal.
3. ${realArticle ? `O comentário DEVE obrigatoriamente citar o ${realArticle} (confirmado por busca literal no texto da lei).` : "Se não encontrar base legal para esta questão, responda valida=false."}
4. VERIFIQUE que cada "Art. X" que você citar EXISTE no texto fornecido.
5. Gabarito: 0=A, 1=B, 2=C, 3=D, 4=E.
${articleContext}

TEXTO LEGAL COMPLETO (${q.disciplina}):
${lawText.substring(0, 28000)}

QUESTÃO COM ERRO:
Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário Atual: ${q.comentario}

Corrija a questão. Responda APENAS JSON (sem markdown):
{"valida":true/false,"motivo_erro":"se invalida","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"Conforme o Art. X da ...: '...'"}`;

      try {
        const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "Você é um auditor jurídico que corrige questões de concurso. Responda APENAS JSON válido, sem markdown." },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 4000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({
              status: "parcial", mensagem: "Rate limit DeepSeek. Aguarde.", paused: true,
              detalhes: {
                total_processado: okCount + fixedCount + deletedCount,
                questoes_criadas: 0, questoes_corrigidas: fixedCount,
                questoes_revisao_manual: questoesRevisaoManual,
                erros_encontrados: [{ codigo: "RATE_LIMIT", descricao: "Aguarde 1 minuto" }],
              },
              success: true, validated: okCount + fixedCount + deletedCount, ok: okCount, fixed: fixedCount, deleted: deletedCount,
              last_id: q.id, details, timestamp,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw new Error(`DeepSeek ${aiResponse.status}: ${errText.substring(0, 200)}`);
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
          let finalComment = normalizeWhitespace(result.comentario || q.comentario);

          // Post-AI validation: verify ALL cited articles exist
          const postCheck = validateAllCitations(finalComment, blocks);
          if (!postCheck.valid) {
            console.log(`[VALIDAR] #${q.id} IA ALUCINANDO: ${postCheck.missing.join(", ")}`);
            // If we know the real article, try replacing hallucinated ones
            if (realArticle) {
              for (const miss of postCheck.missing) {
                const missNum = miss.match(/\d+/)?.[0];
                if (missNum) {
                  finalComment = finalComment.replace(new RegExp(`Art\\.?\\s*${missNum}(?!\\d)`, "gi"), realArticle);
                }
              }
              const recheck = validateAllCitations(finalComment, blocks);
              if (!recheck.valid) {
                questoesRevisaoManual.push({ id: q.id, motivo: `IA alucinação persistente: ${recheck.missing.join(", ")}` });
                await supabase.from("questoes").delete().eq("id", q.id);
                deletedCount++;
                details.push({ id: q.id, status: "excluida", motivo: `Alucinação: ${recheck.missing.join(", ")}` });
                console.log(`[VALIDAR] #${q.id} EXCLUÍDA: alucinação persistente`);
                await new Promise(r => setTimeout(r, 300));
                continue;
              }
            } else {
              questoesRevisaoManual.push({ id: q.id, motivo: `IA citou artigos inexistentes: ${postCheck.missing.join(", ")}` });
              await supabase.from("questoes").delete().eq("id", q.id);
              deletedCount++;
              details.push({ id: q.id, status: "excluida", motivo: `Alucinação: ${postCheck.missing.join(", ")}` });
              console.log(`[VALIDAR] #${q.id} EXCLUÍDA: alucinação sem artigo real`);
              await new Promise(r => setTimeout(r, 300));
              continue;
            }
          }

          // Force correct article if we have literal confirmation
          if (realArticle) {
            const aiCitedArts = extractAllCitedArticles(finalComment);
            const realNum = realArticle.match(/\d+/)?.[0];
            if (realNum && aiCitedArts.length > 0 && !aiCitedArts.includes(realNum)) {
              for (const artNum of aiCitedArts) {
                finalComment = finalComment.replace(new RegExp(`Art\\.?\\s*${artNum}(?!\\d)`, "gi"), realArticle);
              }
              console.log(`[VALIDAR] #${q.id} FORÇADO: artigo → ${realArticle}`);
            }
          }

          // Cross-validate final result
          const finalEnunciado = normalizeWhitespace(result.enunciado || q.enunciado);
          const crossCheck = crossValidateReferences(finalEnunciado, finalComment);
          if (!crossCheck.valid) {
            questoesRevisaoManual.push({ id: q.id, motivo: `Divergência pós-correção: ${crossCheck.reason}` });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: crossCheck.reason });
            console.log(`[VALIDAR] #${q.id} EXCLUÍDA: divergência pós-IA`);
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          const updateData: Record<string, unknown> = {
            enunciado: finalEnunciado,
            alt_a: normalizeWhitespace(result.alt_a || q.alt_a),
            alt_b: normalizeWhitespace(result.alt_b || q.alt_b),
            alt_c: normalizeWhitespace(result.alt_c || q.alt_c),
            alt_d: normalizeWhitespace(result.alt_d || q.alt_d),
            alt_e: normalizeWhitespace(result.alt_e || q.alt_e),
            gabarito: clampGabarito(result.gabarito),
            comentario: finalComment,
          };

          await supabase.from("questoes").update(updateData).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: `IA corrigiu: ${fixReason}` });
          console.log(`[VALIDAR] #${q.id} CORRIGIDA (IA): ${fixReason}`);
        }
      } catch (aiErr) {
        questoesRevisaoManual.push({ id: q.id, motivo: `Erro IA: ${String(aiErr).substring(0, 100)}` });
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Erro IA: ${String(aiErr).substring(0, 100)}` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: erro IA - ${String(aiErr).substring(0, 100)}`);
      }

      await new Promise(r => setTimeout(r, 300));
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
      success: true, validated: totalProcessado, ok: okCount, fixed: fixedCount, deleted: deletedCount,
      details, last_id: questions[questions.length - 1]?.id,
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
