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

/** Find which article block contains the most overlap with a given text */
function findBestArticleForText(snippet: string, blocks: ArticleBlock[]): { article: string; score: number } | null {
  const normSnippet = normalize(snippet);
  if (normSnippet.length < 10) return null;
  const snippetWords = new Set(normSnippet.split(" ").filter(w => w.length > 3));
  if (snippetWords.size < 3) return null;

  let bestBlock: ArticleBlock | null = null;
  let bestScore = 0;

  for (const block of blocks) {
    const blockWords = new Set(block.normText.split(" ").filter(w => w.length > 3));
    let overlap = 0;
    for (const w of snippetWords) {
      if (blockWords.has(w)) overlap++;
    }
    const score = overlap / snippetWords.size;
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestBlock = block;
    }
  }

  return bestBlock ? { article: `Art. ${bestBlock.artNum}`, score: bestScore } : null;
}

function extractAllCitedArticles(text: string): string[] {
  const matches = text.match(/Art\.?\s*(\d+)/gi) || [];
  return [...new Set(matches.map(m => m.match(/\d+/)?.[0] || "").filter(Boolean))];
}

function extractCommentEvidenceSnippets(comment: string): string[] {
  const snippets = Array.from(
    comment.matchAll(/["""''']([^"""''']{20,500})["""''']/g),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean);
  const colonTail = normalizeWhitespace(
    comment.split(":").slice(1).join(":").replace(/^["""''']+|["""''']+$/g, ""),
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

/** Verifica se o trecho citado entre aspas no comentário realmente pertence ao artigo indicado */
function verifySnippetBelongsToArticle(comment: string, blocks: ArticleBlock[]): { valid: boolean; mismatches: string[]; corrections: Array<{citedNum: string; actualNum: string}> } {
  const mismatches: string[] = [];
  const corrections: Array<{citedNum: string; actualNum: string}> = [];
  const citationPattern = /Art\.?\s*(\d+)[^"""''']*?["""''']([^"""''']{15,500})["""''']/gi;
  let match: RegExpExecArray | null;
  while ((match = citationPattern.exec(comment)) !== null) {
    const citedNum = match[1];
    const snippet = normalizeWhitespace(match[2]);
    const normSnippet = normalize(snippet);
    if (normSnippet.length < 15) continue;

    // Find which article the snippet actually belongs to
    const actualArticle = findArticleForText(snippet, blocks);
    if (actualArticle) {
      const actualNum = actualArticle.match(/\d+/)?.[0];
      if (actualNum && actualNum !== citedNum) {
        mismatches.push(`Cita Art. ${citedNum} mas trecho pertence ao Art. ${actualNum}`);
        corrections.push({ citedNum, actualNum });
      }
    } else {
      // Snippet not found in any article — check if at least article exists
      const block = blocks.find(b => b.artNum === citedNum);
      if (block) {
        const snippetWords = new Set(normSnippet.split(" ").filter(w => w.length > 3));
        const blockWords = new Set(block.normText.split(" ").filter(w => w.length > 3));
        let overlap = 0;
        for (const w of snippetWords) if (blockWords.has(w)) overlap++;
        const score = snippetWords.size > 0 ? overlap / snippetWords.size : 0;
        if (score < 0.3) {
          mismatches.push(`Trecho entre aspas não encontrado no Art. ${citedNum} (overlap=${(score*100).toFixed(0)}%)`);
          // Try to find where it actually belongs
          const best = findBestArticleForText(snippet, blocks);
          if (best && best.score >= 0.4) {
            const bestNum = best.article.match(/\d+/)?.[0];
            if (bestNum && bestNum !== citedNum) {
              corrections.push({ citedNum, actualNum: bestNum });
            }
          }
        }
      }
    }
  }
  return { valid: mismatches.length === 0, mismatches, corrections };
}

/** Gera lista de artigos válidos para incluir no prompt da IA */
function buildValidArticlesList(blocks: ArticleBlock[]): string {
  const arts = [...new Set(blocks.map(b => b.artNum))].sort((a, b) => parseInt(a) - parseInt(b));
  return arts.map(a => `Art. ${a}`).join(", ");
}

function articleExistsInLaw(artNum: string, blocks: ArticleBlock[]): boolean {
  return blocks.some(b => b.artNum === artNum);
}

function validateAllCitations(comment: string, blocks: ArticleBlock[]): { valid: boolean; missing: string[] } {
  const cited = extractAllCitedArticles(comment);
  const missing: string[] = [];
  for (const artNum of cited) {
    if (!articleExistsInLaw(artNum, blocks)) missing.push(`Art. ${artNum}`);
  }
  return { valid: missing.length === 0, missing };
}

/** TRAVA DETERMINÍSTICA: substitui qualquer citação de artigo inexistente no texto legal */
function scrubInvalidCitations(text: string, blocks: ArticleBlock[]): { scrubbed: string; removed: string[] } {
  const validArts = new Set(blocks.map(b => b.artNum));
  const removed: string[] = [];
  const scrubbed = text.replace(/\bArt\.?\s*(\d+[A-Z]?)(?:º|°|o)?\b/gi, (match, num) => {
    const cleanNum = num.replace(/[A-Z]/gi, "").trim();
    if (validArts.has(cleanNum)) return match;
    removed.push(match);
    return "[artigo não confirmado]";
  });
  return { scrubbed, removed };
}

/** Verifica se o texto ainda contém marcadores de artigo não confirmado */
function hasUnconfirmedCitations(text: string): boolean {
  return /\[artigo não confirmado\]/.test(text);
}

function reconcileCommentArticle(comment: string, targetArticle: string): string {
  let nextComment = normalizeWhitespace(comment);
  const targetNum = targetArticle.match(/\d+/)?.[0];
  if (!targetNum) return nextComment;

  // Aggressively replace ALL article citations that don't match the target
  const citedArts = extractAllCitedArticles(nextComment);
  if (citedArts.length > 0) {
    for (const artNum of citedArts) {
      if (artNum !== targetNum) {
        // Replace all variations: Art. X, Art X, Art. Xº, etc.
        nextComment = nextComment.replace(
          new RegExp(`\\bArt\\.?\\s*${artNum}(?:º|°|o)?\\b(?!\\d)`, "gi"),
          targetArticle
        );
        console.log(`[RECONCILE] Substituído Art. ${artNum} → ${targetArticle}`);
      }
    }
  }

  // If no article cited at all, prepend the target
  if (extractAllCitedArticles(nextComment).length === 0) {
    nextComment = /^conforme\b/i.test(nextComment)
      ? nextComment.replace(/^conforme\b\s*/i, `Conforme o ${targetArticle}: `)
      : `Conforme o ${targetArticle}: ${nextComment}`;
  }

  return normalizeWhitespace(nextComment);
}

/** Apply ALL snippet-vs-article corrections found, not just the first */
function applyAllSnippetCorrections(comment: string, blocks: ArticleBlock[]): { corrected: string; appliedCorrections: Array<{from: string; to: string}> } {
  let result = comment;
  const applied: Array<{from: string; to: string}> = [];
  const check = verifySnippetBelongsToArticle(result, blocks);
  
  if (check.corrections.length > 0) {
    for (const corr of check.corrections) {
      if (articleExistsInLaw(corr.actualNum, blocks)) {
        result = result.replace(
          new RegExp(`\\bArt\\.?\\s*${corr.citedNum}(?:º|°|o)?\\b(?!\\d)`, "gi"),
          `Art. ${corr.actualNum}`
        );
        applied.push({ from: `Art. ${corr.citedNum}`, to: `Art. ${corr.actualNum}` });
      }
    }
  }
  
  return { corrected: result, appliedCorrections: applied };
}

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

function clampGabarito(val: unknown): number {
  const n = parseInt(String(val));
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(4, n));
}

function buildFingerprint(enunciado: string): string {
  return normalize(enunciado).replace(/\s+/g, "").substring(0, 80);
}

function buildSemanticFingerprint(comentario: string, correctAltText: string): string {
  const arts = extractAllCitedArticles(comentario);
  const artPart = arts.sort().join(",");
  const keyTerms = normalize(correctAltText)
    .split(" ")
    .filter(w => w.length > 4)
    .sort()
    .slice(0, 8)
    .join(" ");
  return `${artPart}|${keyTerms}`.substring(0, 100);
}

/** TRAVA DE PROVA LITERAL: verifica se a alternativa correta tem base literal na lei */
function literalProofCheck(correctAltText: string, blocks: ArticleBlock[]): {
  found: boolean;
  article: string | null;
  score: number;
} {
  // 1. Try exact match via sliding window
  const exactArticle = findArticleForText(correctAltText, blocks);
  if (exactArticle) {
    return { found: true, article: exactArticle, score: 1.0 };
  }

  // 2. Try fuzzy best-match with word overlap
  const bestMatch = findBestArticleForText(correctAltText, blocks);
  if (bestMatch && bestMatch.score >= 0.5) {
    return { found: true, article: bestMatch.article, score: bestMatch.score };
  }

  // 3. Try individual sentences from the alternative
  const sentences = correctAltText.split(/[.;]/).map(s => s.trim()).filter(s => s.length > 15);
  for (const sentence of sentences) {
    const sentArticle = findArticleForText(sentence, blocks);
    if (sentArticle) {
      return { found: true, article: sentArticle, score: 0.7 };
    }
  }

  return { found: false, article: null, score: 0 };
}

// ── SYSTEM PROMPT MÁXIMA SEGURANÇA ───────────────────────────────────────

const SYSTEM_PROMPT_MAX_SECURITY = `Você é um ROBÔ DE BUSCA LITERAL. É PROIBIDO usar qualquer conhecimento ou entendimento jurídico que não esteja no texto fornecido. Se a lei diz X e você acha que é Y, escreva X.

REGRAS ABSOLUTAS:
1. TRAVA DE PROVA LITERAL: Cada alternativa correta DEVE conter texto que existe LITERALMENTE na lei. Se não encontrar o trecho exato, marque valida=false.
2. CONFRONTO DE ARTIGOS: O número do artigo citado no comentário DEVE ser EXATAMENTE o artigo onde o texto foi encontrado na lei. Se o texto está no Art. 1º, o comentário DEVE citar Art. 1º.
3. PROIBIÇÃO DE CONHECIMENTO EXTERNO: Você NÃO pode usar nenhum conhecimento jurídico, doutrinário ou interpretativo. APENAS o texto literal fornecido.
4. GABARITO BLINDADO: O gabarito é SEMPRE um inteiro de 0 a 4 (0=A, 1=B, 2=C, 3=D, 4=E). NUNCA use letras ou números fora desse intervalo.
5. FILTRO DE UNICIDADE: Não repita o mesmo artigo-base ou enunciado de questões existentes.

REGRAS PEDAGÓGICAS (OBRIGATÓRIAS):
- PROIBIDO DECOREBA: O enunciado NÃO PODE mencionar número de artigo. NUNCA "O que diz o Art. X?", "Segundo o Art. X...". REESCREVA como CASO PRÁTICO.
- CASO PRÁTICO: Descreva uma SITUAÇÃO CONCRETA do cotidiano militar com personagens fictícios (Soldado Silva, Cabo Pereira, Sargento Lima). O candidato aplica a lei ao caso.
- PEGADINHAS INTELIGENTES: Alternativas incorretas usam trocadilhos jurídicos (trocar "deverá"/"poderá", inverter prazos, trocar "vedado"/"facultado"). Distratores plausíveis.
- O número do artigo aparece SOMENTE no comentário como fundamentação.
- O comentário DEVE transcrever LITERALMENTE o trecho da lei entre aspas.

Responda APENAS JSON válido, sem markdown, sem explicações adicionais.`;

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
    const articleBlocksCache: Record<string, Array<ArticleBlock>> = {};
    if (legalRows) {
      for (const row of legalRows) {
        legalTexts[row.disciplina] = row.content;
        articleBlocksCache[row.disciplina] = parseArticleBlocks(row.content);
      }
    }

    // 3. Fetch existing fingerprints for duplicate detection (last 500 questions not in current batch)
    const batchIds = new Set(questions.map(q => q.id));
    const { data: existingQuestions } = await supabase
      .from("questoes").select("id, enunciado, comentario, alt_a, alt_b, alt_c, alt_d, alt_e, gabarito")
      .order("id", { ascending: false }).limit(500);
    
    const existingFingerprints = new Map<string, number>();
    const existingSemanticFPs = new Map<string, number>();
    if (existingQuestions) {
      for (const eq of existingQuestions) {
        if (!batchIds.has(eq.id)) {
          existingFingerprints.set(buildFingerprint(eq.enunciado), eq.id);
          const correctKey = ALT_KEYS[Math.min(Math.max(eq.gabarito || 0, 0), 4)];
          const correctText = eq[correctKey] || "";
          existingSemanticFPs.set(buildSemanticFingerprint(eq.comentario || "", correctText), eq.id);
        }
      }
    }

    let okCount = 0;
    let fixedCount = 0;
    let deletedCount = 0;
    const details: Array<{ id: number; status: string; motivo: string }> = [];
    const batchFingerprints = new Map<string, number>();
    const batchSemanticFPs = new Map<string, number>();

    for (const q of questions!) {
      const lawText = legalTexts[q.disciplina];
      const blocks = articleBlocksCache[q.disciplina] || [];

      // ── Text fingerprint duplicate check ──────────────────────────────
      const fp = buildFingerprint(q.enunciado);
      const existingDupId = existingFingerprints.get(fp);
      const batchDupId = batchFingerprints.get(fp);
      if (existingDupId) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Duplicata textual da questão #${existingDupId}` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: duplicata textual de #${existingDupId}`);
        continue;
      }
      if (batchDupId) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Duplicata textual da questão #${batchDupId} (no lote)` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: duplicata textual de #${batchDupId} (lote)`);
        continue;
      }
      batchFingerprints.set(fp, q.id);

      // ── Semantic duplicate check ──────────────────────────────
      const correctAltKey = ALT_KEYS[Math.min(Math.max(q.gabarito || 0, 0), 4)];
      const correctAltText: string = q[correctAltKey] || "";
      const semFP = buildSemanticFingerprint(q.comentario || "", correctAltText);
      const existingSemDupId = existingSemanticFPs.get(semFP);
      const batchSemDupId = batchSemanticFPs.get(semFP);
      if (existingSemDupId) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Duplicata semântica da questão #${existingSemDupId}` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: duplicata semântica de #${existingSemDupId}`);
        continue;
      }
      if (batchSemDupId) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Duplicata semântica da questão #${batchSemDupId} (no lote)` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: duplicata semântica de #${batchSemDupId} (lote)`);
        continue;
      }
      batchSemanticFPs.set(semFP, q.id);

      if (!lawText || blocks.length === 0) {
        okCount++;
        details.push({ id: q.id, status: "pular", motivo: "Sem texto legal cadastrado" });
        console.log(`[VALIDAR] #${q.id} PULAR: sem texto legal para "${q.disciplina}"`);
        continue;
      }

      // ══════════════════════════════════════════════════════════════════
      // TRAVA DE PROVA LITERAL (NOVA): a alternativa correta DEVE ter
      // base literal no texto da lei
      // ══════════════════════════════════════════════════════════════════
      const literalCheck = literalProofCheck(correctAltText, blocks);
      const realArticle = literalCheck.article;

      const evidenceArticle = detectCommentEvidenceArticle(q.comentario || "", blocks);
      const commentCitedArts = extractAllCitedArticles(q.comentario || "");

      let needsFix = false;
      let fixReason = "";

      // Check 0 (NEW): LITERAL PROOF — correct answer MUST be found in law
      if (!literalCheck.found) {
        needsFix = true;
        fixReason = "PROVA LITERAL FALHOU: texto da alternativa correta NÃO encontrado na lei — questão INVÁLIDA";
        console.log(`[VALIDAR] #${q.id} TRAVA LITERAL: resposta correta sem base na lei`);
      }

      // Check 1: ALL cited articles must exist in law
      if (!needsFix) {
        const citationCheck = validateAllCitations(q.comentario || "", blocks);
        if (!citationCheck.valid) {
          needsFix = true;
          fixReason = `Artigos inexistentes: ${citationCheck.missing.join(", ")}`;
          console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
        }
      }

      // Check 2 (ENHANCED): CONFRONTO DE ARTIGOS — article in comment must match where text was found
      if (!needsFix && realArticle && commentCitedArts.length > 0) {
        const realNum = realArticle.match(/\d+/)?.[0];
        const anyMatch = commentCitedArts.some(a => a === realNum);
        if (!anyMatch) {
          needsFix = true;
          fixReason = `CONFRONTO DE ARTIGOS: comentário cita Art. ${commentCitedArts.join(",")} mas busca literal encontrou no ${realArticle}`;
          console.log(`[VALIDAR] #${q.id} CONFRONTO: ${fixReason}`);
        }
      }

      // Check 2.5 (NEW): VERIFICAÇÃO SNIPPET-VS-ARTIGO — trecho entre aspas deve pertencer ao artigo citado
      if (!needsFix) {
        const snippetCheck = verifySnippetBelongsToArticle(q.comentario || "", blocks);
        if (!snippetCheck.valid) {
          needsFix = true;
          fixReason = `SNIPPET INCORRETO: ${snippetCheck.mismatches[0]}`;
          console.log(`[VALIDAR] #${q.id} SNIPPET: ${fixReason}`);
        }
      }

      if (!needsFix) {
        const crossCheck = crossValidateReferences(q.enunciado, q.comentario || "");
        if (!crossCheck.valid) {
          needsFix = true;
          fixReason = crossCheck.reason;
          console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
        }
      }

      // Check 4: No article cited at all in comment
      if (!needsFix && commentCitedArts.length === 0) {
        needsFix = true;
        fixReason = "Comentário não cita nenhum artigo";
        console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
      }

      // Check 5: Structural issues
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

      // Check 6: Anti-decoreba
      if (!needsFix) {
        const decoreba = /\b(o\s+que\s+(diz|dispõe|estabelece|prevê)\s+o\s+art|qual\s+(o\s+)?artigo|segundo\s+o\s+art[\.\s]*\d|de\s+acordo\s+com\s+o\s+art[\.\s]*\d|conforme\s+o\s+art[\.\s]*\d|nos\s+termos\s+do\s+art[\.\s]*\d)/i;
        if (decoreba.test(q.enunciado.toLowerCase())) {
          needsFix = true;
          fixReason = "Questão decoreba: enunciado cita número de artigo (deve ser caso prático)";
          console.log(`[VALIDAR] #${q.id} PROBLEMA: decoreba`);
        }
      }

      // ── No fix needed ─────────────────────────────────
      if (!needsFix) {
        okCount++;
        details.push({ id: q.id, status: "ok", motivo: realArticle ? `Validada (${realArticle}, prova literal score=${literalCheck.score.toFixed(2)})` : "Validada OK" });
        console.log(`[VALIDAR] #${q.id} OK ${realArticle || ""} (literal score=${literalCheck.score.toFixed(2)})`);
        continue;
      }

      // ══════════════════════════════════════════════════════════════════
      // RULES MODE: try to fix deterministically, or delete
      // ══════════════════════════════════════════════════════════════════
      if (mode === "rules") {
        // First: scrub all invalid citations deterministically
        const { scrubbed: scrubbedRulesComment, removed: removedRulesArts } = scrubInvalidCitations(q.comentario || "", blocks);
        if (removedRulesArts.length > 0) {
          console.log(`[VALIDAR] #${q.id} SCRUB REGRAS: removidos ${removedRulesArts.join(", ")}`);
        }

        // Determine the correct article — apply ALL snippet corrections first
        let fixableArticle = realArticle || evidenceArticle;
        
        const { corrected: snippetCorrectedComment, appliedCorrections } = applyAllSnippetCorrections(q.comentario || "", blocks);
        if (appliedCorrections.length > 0) {
          for (const corr of appliedCorrections) {
            console.log(`[VALIDAR] #${q.id} SNIPPET-CORREÇÃO: ${corr.from} → ${corr.to} (trecho pertence ao artigo correto)`);
          }
          const lastCorr = appliedCorrections[appliedCorrections.length - 1];
          const corrNum = lastCorr.to.match(/\d+/)?.[0];
          if (corrNum && articleExistsInLaw(corrNum, blocks)) {
            fixableArticle = lastCorr.to;
          }
        }

        if (fixableArticle && (fixReason.includes("CONFRONTO") || fixReason.includes("cita") || fixReason.includes("Artigos inexistentes") || fixReason.includes("não cita") || fixReason.includes("SNIPPET"))) {
          const baseComment = appliedCorrections.length > 0
            ? snippetCorrectedComment
            : (removedRulesArts.length > 0
                ? scrubbedRulesComment.replace(/\[artigo não confirmado\]/g, fixableArticle)
                : q.comentario);
          const newComment = reconcileCommentArticle(baseComment, fixableArticle);
          const recheck = validateAllCitations(newComment, blocks);
          const postFixSnippetCheck = verifySnippetBelongsToArticle(newComment, blocks);
          
          if (recheck.valid && !hasUnconfirmedCitations(newComment) && postFixSnippetCheck.valid) {
            // Nuclear final pass: every cited article must exist in law
            const finalCited = extractAllCitedArticles(newComment);
            const allExist = finalCited.every(a => articleExistsInLaw(a, blocks));
            if (allExist) {
              await supabase.from("questoes").update({ comentario: newComment }).eq("id", q.id);
              fixedCount++;
              details.push({ id: q.id, status: "corrigida", motivo: `Artigo corrigido para ${fixableArticle}` });
              console.log(`[VALIDAR] #${q.id} CORRIGIDA: → ${fixableArticle}`);
              continue;
            } else {
              console.log(`[VALIDAR] #${q.id} NUCLEAR FALHOU: artigos inexistentes: ${finalCited.filter(a => !articleExistsInLaw(a, blocks)).map(a => `Art. ${a}`).join(", ")}`);
            }
          } else if (!postFixSnippetCheck.valid) {
            console.log(`[VALIDAR] #${q.id} PÓS-FIX SNIPPET FALHOU: ${postFixSnippetCheck.mismatches[0]}`);
            // Retry applying all snippet corrections on the fixed comment
            const { corrected: retryCorrected, appliedCorrections: retryCorrs } = applyAllSnippetCorrections(newComment, blocks);
            if (retryCorrs.length > 0) {
              const retryCheck = validateAllCitations(retryCorrected, blocks);
              const retrySnippet = verifySnippetBelongsToArticle(retryCorrected, blocks);
              if (retryCheck.valid && retrySnippet.valid && !hasUnconfirmedCitations(retryCorrected)) {
                const retryFinalCited = extractAllCitedArticles(retryCorrected);
                if (retryFinalCited.every(a => articleExistsInLaw(a, blocks))) {
                  await supabase.from("questoes").update({ comentario: retryCorrected }).eq("id", q.id);
                  fixedCount++;
                  details.push({ id: q.id, status: "corrigida", motivo: `Artigo corrigido via snippet: ${retryCorrs.map(c => c.to).join(", ")}` });
                  console.log(`[VALIDAR] #${q.id} CORRIGIDA: via snippet corrections`);
                  continue;
                }
              }
            }
          }
        }
        if (fixReason === "Gabarito fora do range 0-4") {
          await supabase.from("questoes").update({ gabarito: clampGabarito(q.gabarito) }).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: fixReason });
          console.log(`[VALIDAR] #${q.id} CORRIGIDA: gabarito clamped`);
          continue;
        }
        // Can't fix in rules mode → delete
        questoesRevisaoManual.push({ id: q.id, motivo: fixReason });
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: fixReason });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: ${fixReason}`);
        continue;
      }

      // ══════════════════════════════════════════════════════════════════
      // AI MODE — SEGURANÇA MÁXIMA: rewrite from scratch using law text
      // ══════════════════════════════════════════════════════════════════
      if (!DEEPSEEK_API_KEY) {
        questoesRevisaoManual.push({ id: q.id, motivo: "DEEPSEEK_API_KEY não configurada" });
        errosEncontrados.push({ codigo: "NO_API_KEY", descricao: "DEEPSEEK_API_KEY ausente" });
        details.push({ id: q.id, status: "erro", motivo: "Sem API key DeepSeek" });
        continue;
      }

      // Build focused article context for the AI
      let articleContext = "";
      const focusArticle = realArticle || evidenceArticle;
      if (focusArticle) {
        const focusNum = focusArticle.match(/\d+/)?.[0];
        const idx = blocks.findIndex(b => b.artNum === focusNum);
        if (idx >= 0) {
          const start = Math.max(0, idx - 2);
          const end = Math.min(blocks.length, idx + 3);
          articleContext = `\n\nARTIGOS RELEVANTES CONFIRMADOS POR BUSCA LITERAL:\n${blocks.slice(start, end).map(b => `Art. ${b.artNum}: ${b.text.substring(0, 500)}`).join("\n\n")}`;
        }
      }

      const validArticlesList = buildValidArticlesList(blocks);

      const isLiteralFailure = fixReason.includes("PROVA LITERAL");

      const prompt = `${isLiteralFailure
        ? `ATENÇÃO: A questão abaixo FALHOU na TRAVA DE PROVA LITERAL. A alternativa correta NÃO tem base no texto legal. Você DEVE REESCREVER A QUESTÃO DO ZERO usando APENAS trechos que EXISTEM LITERALMENTE no texto legal fornecido.`
        : `A questão abaixo tem um ERRO CONFIRMADO: "${fixReason}".`
      }
${focusArticle ? `A busca literal confirmou conteúdo no ${focusArticle} do texto legal.` : "O conteúdo correto NÃO foi localizado. CRIE uma questão nova baseada em qualquer artigo do texto legal."}

⚠️ LISTA COMPLETA DE ARTIGOS VÁLIDOS NESTE TEXTO LEGAL (SOMENTE estes existem — NÃO cite nenhum outro):
${validArticlesList}

REGRAS INVIOLÁVEIS:
1. A alternativa correta DEVE conter texto que existe LITERALMENTE na lei. Copie trechos reais.
2. O comentário DEVE citar o artigo EXATO onde o texto foi encontrado, com transcrição LITERAL entre aspas.
3. ${focusArticle ? `O comentário DEVE obrigatoriamente citar o ${focusArticle} (confirmado por busca literal).` : "Escolha qualquer artigo da LISTA ACIMA e baseie a questão nele."}
4. SOMENTE cite artigos da lista acima. Se um artigo NÃO está na lista, ele NÃO EXISTE no texto legal.
5. Gabarito: inteiro 0-4 (0=A, 1=B, 2=C, 3=D, 4=E). NUNCA letras.
6. NÃO use conhecimento externo. APENAS o texto fornecido.
7. O trecho entre aspas no comentário DEVE existir LITERALMENTE no artigo citado. Copie e cole do texto.
8. VERIFICAÇÃO OBRIGATÓRIA: Antes de citar "Art. X", faça a busca exata da string "Art. X" no texto legal. Se NÃO encontrar essa string exata, NÃO cite esse artigo. NUNCA INVENTE OU INFIRA NÚMEROS DE ARTIGOS.
9. CONSISTÊNCIA SNIPPET-ARTIGO: O trecho entre aspas DEVE pertencer ao artigo citado. Se você cita Art. 3 e transcreve texto, esse texto DEVE estar dentro do bloco do Art. 3 no texto legal — NÃO em outro artigo.
10. EM CASO DE DÚVIDA: omita a citação do artigo ou indique "referência não confirmada" em vez de citar um artigo incorreto.

REGRAS PEDAGÓGICAS:
- PROIBIDO número de artigo no enunciado. Sempre CASO PRÁTICO com personagens fictícios.
- PEGADINHAS INTELIGENTES: distratores com troca de "deverá"/"poderá", inversão de prazos, "vedado"/"facultado".
- Mescle: algumas questões com exemplos práticos; outras pegadinhas típicas de concurso; outras com literalidade da lei.
- PRIORIZE questões complexas e bem estruturadas.
${articleContext}

TEXTO LEGAL COMPLETO (${q.disciplina}):
${lawText.substring(0, 25000)}

QUESTÃO COM ERRO:
Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário: ${q.comentario}

${isLiteralFailure ? "REESCREVA A QUESTÃO INTEIRA DO ZERO com base literal na lei." : "Corrija a questão mantendo o estilo."}
Responda APENAS JSON (sem markdown):
{"valida":true/false,"motivo_erro":"se invalida","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"Conforme o Art. X da ...: '...'"}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000);

        const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: SYSTEM_PROMPT_MAX_SECURITY },
              { role: "user", content: prompt },
            ],
            temperature: 0.0,
            max_tokens: 4000,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

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
          // ── POST-AI VALIDATION: re-run literal proof on AI output ──
          const aiGabarito = clampGabarito(result.gabarito);
          const aiCorrectKey = ALT_KEYS[aiGabarito];
          const aiCorrectText = normalizeWhitespace(result[aiCorrectKey] || "");

          // TRAVA DE PROVA LITERAL on AI output
          const aiLiteralCheck = literalProofCheck(aiCorrectText, blocks);
          if (!aiLiteralCheck.found) {
            console.log(`[VALIDAR] #${q.id} IA FALHOU PROVA LITERAL: resposta corrigida sem base na lei`);
            questoesRevisaoManual.push({ id: q.id, motivo: "IA reescreveu mas resposta correta ainda sem base literal na lei" });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: "Pós-IA: prova literal falhou novamente" });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          let finalComment = normalizeWhitespace(result.comentario || q.comentario);

          // ── TRAVA DETERMINÍSTICA PÓS-IA: scrub ALL invalid citations ──
          const { scrubbed: scrubbedComment, removed: removedArts } = scrubInvalidCitations(finalComment, blocks);
          if (removedArts.length > 0) {
            console.log(`[VALIDAR] #${q.id} SCRUB PÓS-IA: removidos ${removedArts.join(", ")}`);
          }

          // CONFRONTO DE ARTIGOS on AI output: force the article to match literal proof
          const enforcedArticle = aiLiteralCheck.article;
          if (enforcedArticle) {
            // Replace any "[artigo não confirmado]" markers AND wrong articles with the enforced one
            finalComment = reconcileCommentArticle(
              scrubbedComment.replace(/\[artigo não confirmado\]/g, enforcedArticle),
              enforcedArticle
            );
          } else {
            finalComment = scrubbedComment;
          }

          // If still has unconfirmed markers after reconciliation, delete
          if (hasUnconfirmedCitations(finalComment)) {
            questoesRevisaoManual.push({ id: q.id, motivo: `IA citou artigos inexistentes: ${removedArts.join(", ")}` });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: `Alucinação irrecuperável: ${removedArts.join(", ")}` });
            console.log(`[VALIDAR] #${q.id} EXCLUÍDA: alucinação sem artigo real para substituir`);
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Final validation: ensure ALL remaining citations exist
          const postCheck = validateAllCitations(finalComment, blocks);
          if (!postCheck.valid) {
            questoesRevisaoManual.push({ id: q.id, motivo: `Alucinação persistente: ${postCheck.missing.join(", ")}` });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: `Alucinação: ${postCheck.missing.join(", ")}` });
            console.log(`[VALIDAR] #${q.id} EXCLUÍDA: alucinação persistente`);
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Post-AI: verify snippets match their cited articles
          const snippetVerify = verifySnippetBelongsToArticle(finalComment, blocks);
          if (!snippetVerify.valid) {
            // Try to fix by reconciling to the enforced article
            if (enforcedArticle) {
              finalComment = reconcileCommentArticle(finalComment, enforcedArticle);
              const reVerify = verifySnippetBelongsToArticle(finalComment, blocks);
              if (!reVerify.valid) {
                questoesRevisaoManual.push({ id: q.id, motivo: `Snippet-artigo mismatch: ${reVerify.mismatches[0]}` });
                await supabase.from("questoes").delete().eq("id", q.id);
                deletedCount++;
                details.push({ id: q.id, status: "excluida", motivo: `Snippet incorreto: ${reVerify.mismatches[0]}` });
                console.log(`[VALIDAR] #${q.id} EXCLUÍDA: snippet não pertence ao artigo citado`);
                await new Promise(r => setTimeout(r, 300));
                continue;
              }
            } else {
              questoesRevisaoManual.push({ id: q.id, motivo: `Snippet-artigo mismatch: ${snippetVerify.mismatches[0]}` });
              await supabase.from("questoes").delete().eq("id", q.id);
              deletedCount++;
              details.push({ id: q.id, status: "excluida", motivo: `Snippet incorreto: ${snippetVerify.mismatches[0]}` });
              console.log(`[VALIDAR] #${q.id} EXCLUÍDA: snippet não pertence ao artigo citado`);
              await new Promise(r => setTimeout(r, 300));
              continue;
            }
          }

          const finalEnunciado = normalizeWhitespace(result.enunciado || q.enunciado);
          const { scrubbed: scrubbedEnunciado } = scrubInvalidCitations(finalEnunciado, blocks);
          const crossCheck = crossValidateReferences(scrubbedEnunciado, finalComment);
          if (!crossCheck.valid) {
            questoesRevisaoManual.push({ id: q.id, motivo: `Divergência pós-correção: ${crossCheck.reason}` });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: crossCheck.reason });
            console.log(`[VALIDAR] #${q.id} EXCLUÍDA: divergência pós-IA`);
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Anti-decoreba on AI output
          const decoreba = /\b(o\s+que\s+(diz|dispõe|estabelece|prevê)\s+o\s+art|qual\s+(o\s+)?artigo|segundo\s+o\s+art[\.\s]*\d|de\s+acordo\s+com\s+o\s+art[\.\s]*\d|conforme\s+o\s+art[\.\s]*\d|nos\s+termos\s+do\s+art[\.\s]*\d)/i;
          if (decoreba.test((result.enunciado || "").toLowerCase())) {
            questoesRevisaoManual.push({ id: q.id, motivo: "IA reescreveu mas manteve decoreba no enunciado" });
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: "Pós-IA: decoreba persistente" });
            console.log(`[VALIDAR] #${q.id} EXCLUÍDA: decoreba pós-IA`);
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Duplicate check on AI-rewritten question
          const newFp = buildFingerprint(result.enunciado || q.enunciado);
          const newSemFp = buildSemanticFingerprint(finalComment, aiCorrectText);
          if (existingFingerprints.has(newFp) || batchFingerprints.has(newFp)) {
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: "Pós-IA: enunciado reescrito é duplicata" });
            continue;
          }
          if (existingSemanticFPs.has(newSemFp) || batchSemanticFPs.has(newSemFp)) {
            await supabase.from("questoes").delete().eq("id", q.id);
            deletedCount++;
            details.push({ id: q.id, status: "excluida", motivo: "Pós-IA: duplicata semântica após reescrita" });
            continue;
          }

          // All checks passed — save
          const updateData: Record<string, unknown> = {
            enunciado: scrubbedEnunciado,
            alt_a: normalizeWhitespace(result.alt_a || q.alt_a),
            alt_b: normalizeWhitespace(result.alt_b || q.alt_b),
            alt_c: normalizeWhitespace(result.alt_c || q.alt_c),
            alt_d: normalizeWhitespace(result.alt_d || q.alt_d),
            alt_e: normalizeWhitespace(result.alt_e || q.alt_e),
            gabarito: aiGabarito,
            comentario: finalComment,
          };

          await supabase.from("questoes").update(updateData).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: `IA corrigiu (prova literal: ${aiLiteralCheck.article}, score=${aiLiteralCheck.score.toFixed(2)})` });
          console.log(`[VALIDAR] #${q.id} CORRIGIDA (IA): ${fixReason} → ${aiLiteralCheck.article}`);

          // Update fingerprints
          batchFingerprints.set(newFp, q.id);
          batchSemanticFPs.set(newSemFp, q.id);
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
