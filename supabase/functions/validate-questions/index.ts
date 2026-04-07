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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectArticlePositions(lawText: string): Array<{ num: string; pos: number }> {
  const lineStartPositions: Array<{ num: string; pos: number }> = [];
  const lineStartRegex = /(^|[\n\r])\s*Art\.?\s*(\d+)(?:º|°|o)?/gim;
  let match: RegExpExecArray | null;

  while ((match = lineStartRegex.exec(lawText)) !== null) {
    const artOffset = Math.max(match[0].search(/art\.?/i), 0);
    lineStartPositions.push({ num: match[2], pos: match.index + artOffset });
  }

  if (lineStartPositions.length > 0) return lineStartPositions;

  const heuristicPositions: Array<{ num: string; pos: number }> = [];
  const broadRegex = /Art\.?\s*(\d+)(?:º|°|o)?/gi;

  while ((match = broadRegex.exec(lawText)) !== null) {
    const before = lawText.slice(Math.max(0, match.index - 20), match.index);
    const after = lawText.slice(broadRegex.lastIndex, broadRegex.lastIndex + 48);
    const startsAtBoundary = match.index === 0 || /[\n\r]\s*$/.test(before) || /[.;:!?]\s*$/.test(before);
    const looksLikeInlineReference = /^\s+(?:desta|deste|dessa|desse|do|da|no|na|nos|nas|anterior|seguinte|referid[oa]s?|previst[oa]s?|mencionad[oa]s?)\b/i.test(after);
    const looksLikeHeading = /^[\s.:\-–—º°]*[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(after);

    if (startsAtBoundary || (looksLikeHeading && !looksLikeInlineReference)) {
      heuristicPositions.push({ num: match[1], pos: match.index });
    }
  }

  return heuristicPositions;
}

function parseArticleBlocks(lawText: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const positions = collectArticlePositions(lawText);
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

function getAvailableArticleNumbers(blocks: ArticleBlock[]): string[] {
  return [...new Set(blocks.map((b) => normalizeWhitespace(b.artNum)).filter(Boolean))]
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
}

function buildAvailableArticles(blocks: ArticleBlock[]): string {
  return getAvailableArticleNumbers(blocks).join(", ");
}

function getAvailableArticlesSet(availableArticles: string): Set<string> {
  return new Set(
    availableArticles
      .split(",")
      .map((article) => normalizeWhitespace(article))
      .filter(Boolean),
  );
}

function enforceAvailableArticlesWhitelist(
  comment: string,
  availableArticles: string,
  targetArticle: string | null,
): { corrected: string; invalidArticles: string[] } {
  let corrected = normalizeWhitespace(comment);
  const allowedArticles = getAvailableArticlesSet(availableArticles);
  const targetCitation = normalizeWhitespace(targetArticle || "");
  const targetArticleNum = targetCitation.match(/\d+/)?.[0] || "";
  const invalidArticles = [...new Set(
    extractAllCitedArticles(corrected).filter((num) => !allowedArticles.has(num)),
  )];

  if (invalidArticles.length === 0) {
    return { corrected, invalidArticles: [] };
  }

  console.error(
    `[VALIDAR] IA alucinou artigos fora da whitelist [${availableArticles}]: ${invalidArticles.join(", ")}`,
  );

  for (const invalidArticle of invalidArticles) {
    corrected = corrected.replace(
      new RegExp(`\\bArt\\.?\\s*${invalidArticle}(?:º|°|o)?\\b(?:\\s*,\\s*par[aá]grafo\\s+[úu]nico)?`, "gi"),
      targetCitation || (targetArticleNum ? `Art. ${targetArticleNum}` : "[artigo não confirmado]"),
    );
  }

  return { corrected: normalizeWhitespace(corrected), invalidArticles };
}

/** Gera lista de artigos válidos para incluir no prompt da IA */
function buildValidArticlesList(blocks: ArticleBlock[]): string {
  return getAvailableArticleNumbers(blocks).map((art) => `Art. ${art}`).join(", ");
}

function getArticleBlock(article: string | null | undefined, blocks: ArticleBlock[]): ArticleBlock | null {
  const artNum = normalizeWhitespace(article).match(/\d+/)?.[0];
  if (!artNum) return null;
  return blocks.find((block) => block.artNum === artNum) ?? null;
}

function getParagrafoUnicoText(block: ArticleBlock): string | null {
  const match = /par[aá]grafo\s+único[\s.:\-–—]*/i.exec(block.text);
  if (!match || typeof match.index !== "number") return null;
  return block.text.slice(match.index);
}

function textSectionContainsSnippet(section: string, snippet: string): boolean {
  const normSection = normalize(section);
  const cleanedSnippet = normalizeWhitespace(snippet);
  if (!cleanedSnippet || cleanedSnippet.length < 15) return false;

  const normSnippet = normalize(cleanedSnippet);
  if (normSnippet.length < 15) return false;
  if (normSection.includes(normSnippet)) return true;

  const words = normSnippet.split(" ").filter((word) => word.length > 2);
  for (const windowSize of [12, 10, 8, 6, 5]) {
    if (words.length < windowSize) continue;
    for (let start = 0; start <= words.length - windowSize; start++) {
      const probe = words.slice(start, start + windowSize).join(" ");
      if (normSection.includes(probe)) return true;
    }
  }

  return false;
}

function getTextOverlapScore(snippet: string, source: string): number {
  const snippetWords = new Set(normalize(snippet).split(" ").filter((word) => word.length > 3));
  if (snippetWords.size < 3) return 0;

  const sourceWords = new Set(normalize(source).split(" ").filter((word) => word.length > 3));
  let overlap = 0;
  for (const word of snippetWords) {
    if (sourceWords.has(word)) overlap++;
  }

  return overlap / snippetWords.size;
}

function snippetBelongsToParagrafoUnico(snippet: string, block: ArticleBlock): boolean {
  const paragrafoUnicoText = getParagrafoUnicoText(block);
  if (!paragrafoUnicoText) return false;
  if (textSectionContainsSnippet(paragrafoUnicoText, snippet)) return true;
  return getTextOverlapScore(snippet, paragrafoUnicoText) >= 0.45;
}

function buildDeterministicCitation(block: ArticleBlock | null, snippets: string[]): string | null {
  if (!block) return null;

  const shouldMentionParagrafoUnico = Boolean(getParagrafoUnicoText(block))
    && snippets.some((snippet) => snippetBelongsToParagrafoUnico(snippet, block));

  return shouldMentionParagrafoUnico ? `Art. ${block.artNum}, parágrafo único` : `Art. ${block.artNum}`;
}

function getCitationReferenceText(block: ArticleBlock | null, citation: string | null): string {
  if (!block) return "";
  if (/par[aá]grafo\s+[úu]nico/i.test(citation || "")) {
    return normalizeWhitespace(getParagrafoUnicoText(block) || block.text);
  }
  return normalizeWhitespace(block.text);
}

function commentContainsCitation(comment: string, citation: string | null): boolean {
  if (!citation) return true;
  return new RegExp(escapeRegExp(citation), "i").test(normalizeWhitespace(comment));
}

function findBestArticleBlockForText(snippet: string, blocks: ArticleBlock[]): ArticleBlock | null {
  const bestMatch = findBestArticleForText(snippet, blocks);
  return bestMatch ? getArticleBlock(bestMatch.article, blocks) : null;
}

function resolveTargetArticleBlock(
  correctAltText: string,
  comment: string,
  realArticle: string | null,
  evidenceArticle: string | null,
  blocks: ArticleBlock[],
): ArticleBlock | null {
  const quotedEvidenceBlock = extractCommentEvidenceSnippets(comment)
    .map((snippet) => getArticleBlock(findArticleForText(snippet, blocks), blocks) ?? findBestArticleBlockForText(snippet, blocks))
    .find((block): block is ArticleBlock => Boolean(block));

  return (
    getArticleBlock(realArticle, blocks) ??
    getArticleBlock(evidenceArticle, blocks) ??
    quotedEvidenceBlock ??
    findBestArticleBlockForText(correctAltText, blocks) ??
    findBestArticleBlockForText(comment, blocks)
  );
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
  const scrubbed = text.replace(/\bArt\.?\s*(\d+[A-Z]?)(?:º|°|o)?\b(?:\s*,\s*par[aá]grafo\s+[úu]nico)?/gi, (match, num) => {
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

  nextComment = nextComment.replace(
    /\bArt\.?\s*\d+(?:º|°|o)?\b(?:\s*,\s*par[aá]grafo\s+[úu]nico)?/gi,
    targetArticle,
  );
  nextComment = nextComment.replace(
    /\b(?:nos?\s+termos\s+do\s+)?par[aá]grafo\s+[úu]nico\b/gi,
    targetArticle,
  );
  nextComment = nextComment.replace(
    new RegExp(`(${escapeRegExp(targetArticle)})(?:\\s*,\\s*par[aá]grafo\\s+[úu]nico)+`, "gi"),
    "$1",
  );

  // If no article cited at all, prepend the target
  if (!commentContainsCitation(nextComment, targetArticle)) {
    nextComment = /^conforme\b/i.test(nextComment)
      ? nextComment.replace(/^conforme\b\s*/i, `Conforme o ${targetArticle}: `)
      : `Conforme o ${targetArticle}: ${nextComment}`;
  }

  return normalizeWhitespace(nextComment);
}

function forceDeterministicArticleInComment(comment: string, targetCitation: string | null): string {
  const normalizedComment = normalizeWhitespace(comment);
  if (!targetCitation) return normalizedComment;
  return reconcileCommentArticle(
    normalizedComment
      .replace(/\bArt\.?\s*\d+(?:º|°|o)?\b(?:\s*,\s*par[aá]grafo\s+[úu]nico)?/gi, targetCitation)
      .replace(/\b(?:nos?\s+termos\s+do\s+)?par[aá]grafo\s+[úu]nico\b/gi, targetCitation),
    targetCitation,
  );
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

/** Compute word-overlap similarity between two enunciados (Jaccard-like). */
function computeEnunciadoSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" ").filter(w => w.length > 3));
  const wordsB = new Set(normalize(b).split(" ").filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/** Find the most similar existing question above threshold. */
function findSimilarQuestion(
  newEnunciado: string,
  existingQuestions: Array<{ id: number; enunciado: string }>,
  threshold = 0.55,
): number | null {
  for (const eq of existingQuestions) {
    const sim = computeEnunciadoSimilarity(newEnunciado, eq.enunciado);
    if (sim >= threshold) return eq.id;
  }
  return null;
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

/** VERIFICAÇÃO COMPLETA: verifica TODAS as 5 alternativas contra o texto legal */
function fullAlternativesCheck(q: Record<string, any>, blocks: ArticleBlock[]): {
  allValid: boolean;
  correctValid: boolean;
  incorrectIssues: Array<{ key: string; label: string; issue: string }>;
  correctIssue: string | null;
} {
  const gabarito = clampGabarito(q.gabarito);
  const issues: Array<{ key: string; label: string; issue: string }> = [];
  let correctValid = true;
  let correctIssue: string | null = null;
  const labels = ["A", "B", "C", "D", "E"];

  for (let i = 0; i < ALT_KEYS.length; i++) {
    const altText = normalizeWhitespace(q[ALT_KEYS[i]] || "");
    if (altText.length < 5) {
      if (i === gabarito) { correctValid = false; correctIssue = "Alternativa correta vazia"; }
      else issues.push({ key: ALT_KEYS[i], label: labels[i], issue: "Alternativa vazia ou muito curta" });
      continue;
    }

    const proof = literalProofCheck(altText, blocks);
    
    if (i === gabarito) {
      if (!proof.found) {
        correctValid = false;
        correctIssue = "Alternativa correta sem base literal na lei";
      }
    } else {
      if (proof.found && proof.score >= 0.95) {
        const correctProof = literalProofCheck(normalizeWhitespace(q[ALT_KEYS[gabarito]] || ""), blocks);
        if (!correctProof.found || correctProof.score < proof.score) {
          issues.push({
            key: ALT_KEYS[i],
            label: labels[i],
            issue: `Alternativa incorreta (${labels[i]}) tem base literal MAIS FORTE que o gabarito — possível gabarito invertido`
          });
        }
      }
    }
  }

  return {
    allValid: correctValid && issues.length === 0,
    correctValid,
    incorrectIssues: issues,
    correctIssue,
  };
}

/** AUDITORIA PROFUNDA: verifica detalhes factuais específicos (números, seções, prazos, nomes)
 *  nas alternativas contra o texto legal. Detecta erros sutis como "2ª seção" vs "1ª seção". */
function deepFactualAudit(q: Record<string, any>, blocks: ArticleBlock[], lawText: string): {
  needsAudit: boolean;
  suspiciousAlts: Array<{ key: string; label: string; detail: string }>;
} {
  const labels = ["A", "B", "C", "D", "E"];
  const suspicious: Array<{ key: string; label: string; detail: string }> = [];
  const normLaw = normalize(lawText);
  
  // Patterns that indicate specific factual claims that MUST match the law exactly
  const factualPatterns = [
    // Ordinal numbers (1ª, 2ª, 3ª seção/seçao/comissão etc)
    /(\d+)[ªºa°]\s*(seção|secao|seçao|comissão|comissao|câmara|turma|divisão|grupo|batalhão|companhia|pelotão|região)/gi,
    // Specific time periods
    /(\d+)\s*(dias?|meses?|anos?|horas?)/gi,
    // Specific percentages
    /(\d+)\s*%/g,
    // "chefe da X seção" pattern
    /chefe\s+d[aeo]\s+(\d+)[ªºa°]?\s*(seção|secao|seçao)/gi,
    // Specific ranks/positions that could be wrong
    /(comandante|chefe|presidente|secretário|diretor|inspetor)\s+d[aeo]\s+([A-Za-zÀ-ú\s]+)/gi,
    // "não precisa" vs "precisa" / "dispensada" vs "exigida"
    /(dispensad[ao]|exigid[ao]|obrigatóri[ao]|facultativ[ao]|vedad[ao]|permitid[ao])/gi,
    // IPM, sindicância, laudo patterns
    /(sindicância|sindicancia|IPM|inquérito|inquerito|laudo|perícia|pericia|JMCS|junta\s+médica)/gi,
  ];

  for (let i = 0; i < ALT_KEYS.length; i++) {
    const altText = normalizeWhitespace(q[ALT_KEYS[i]] || "");
    if (altText.length < 10) continue;

    for (const pattern of factualPatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(altText)) !== null) {
        const claim = match[0];
        const normClaim = normalize(claim);
        // Check if this exact factual claim appears anywhere in the law
        if (normClaim.length >= 4 && !normLaw.includes(normClaim)) {
          // The specific claim is NOT in the law text — suspicious
          // But check if a VARIANT exists (e.g., "1ª seção" instead of "2ª seção")
          const basePattern = normClaim.replace(/\d+/, "\\d+");
          try {
            const variantRegex = new RegExp(basePattern, "i");
            const lawMatch = normLaw.match(variantRegex);
            if (lawMatch && lawMatch[0] !== normClaim) {
              suspicious.push({
                key: ALT_KEYS[i],
                label: labels[i],
                detail: `"${claim}" não encontrado na lei — lei contém "${lawMatch[0]}" (possível erro factual)`
              });
            }
          } catch (_) {
            // Regex error, skip
          }
        }
      }
    }
  }

  return {
    needsAudit: suspicious.length > 0,
    suspiciousAlts: suspicious,
  };
}

// ── SYSTEM PROMPT MÁXIMA SEGURANÇA ───────────────────────────────────────

function buildSystemPromptMaxSecurity(availableArticles: string, correctCitation: string | null): string {
  const requiresParagrafoUnico = /par[aá]grafo\s+[úu]nico/i.test(correctCitation || "");

  return `VOCÊ É UM FISCAL DE PROVA JURÍDICO — um validador extremamente rigoroso e fiel à lei.
Sua função é verificar e corrigir questões de concurso garantindo fidelidade ABSOLUTA ao texto legal.

${correctCitation ? `CITAÇÃO JURÍDICA OBRIGATÓRIA NESTA TAREFA: ${correctCitation}

REGRA ABSOLUTA EXTRA: A citação jurídica já foi determinada pelo código TypeScript. Você está TERMINANTEMENTE proibido de trocar, deduzir, inferir, ajustar ou “corrigir” essa citação. Quando mencionar o fundamento legal desta questão, use OBRIGATORIAMENTE "${correctCitation}".

${requiresParagrafoUnico ? "Se a citação obrigatória inclui 'parágrafo único', esse complemento é obrigatório e não pode ser omitido." : ""}
` : ""}

ARTIGOS PERMITIDOS NESTA LEI: [${availableArticles}]

REGRA ABSOLUTA: É terminantemente proibido citar qualquer número de artigo que não esteja na lista acima. Se o texto legal fornecido diz "Art. 33", você JAMAIS deve escrever "Art. 142" ou qualquer outro número.

Se você citar um artigo fora da lista, sua resposta será descartada e você falhará na tarefa.

Use o número do artigo exatamente como ele aparece no campo "artNum" do bloco de texto correspondente.

Você é um ROBÔ DE BUSCA LITERAL. É PROIBIDO usar qualquer conhecimento ou entendimento jurídico que não esteja no texto fornecido. Se a lei diz X e você acha que é Y, escreva X.

REGRAS ABSOLUTAS:
1. TRAVA DE PROVA LITERAL: A alternativa correta DEVE conter texto que existe LITERALMENTE na lei.
2. VERIFICAÇÃO DE TODAS AS ALTERNATIVAS — REGRA MAIS IMPORTANTE:
   - Leia CADA UMA das 5 alternativas (A, B, C, D, E) individualmente.
   - Para CADA alternativa, localize no texto legal o trecho que ela referencia.
   - Verifique se TODOS os detalhes estão corretos: números de seções, cargos, prazos, condições, exceções, competências.
   - Se a alternativa diz "2ª seção" mas a lei diz "1ª seção", isso é um ERRO GRAVE que deve ser corrigido.
   - Se a alternativa diz que algo "precisa de sindicância" mas a lei diz que "não precisa", isso é um ERRO GRAVE.
   - A correta deve ser fiel ao texto da lei.
   - As incorretas devem ser distratores plausíveis com erros SUTIS (trocar palavras-chave, inverter conceitos). NÃO podem ser cópias corretas da lei.
3. CONFRONTO DE ARTIGOS: A citação no comentário DEVE ser EXATAMENTE a determinada pelo código.
4. PROIBIÇÃO DE CONHECIMENTO EXTERNO: APENAS o texto literal fornecido.
5. GABARITO BLINDADO: inteiro de 0 a 4 (0=A, 1=B, 2=C, 3=D, 4=E).
6. FILTRO DE UNICIDADE: Não repita o mesmo artigo-base ou enunciado de questões existentes.
7. PRIORIZE CORREÇÃO: Reescreva e corrija sempre que possível. Marque valida=false SOMENTE em último caso absoluto.
8. COMENTÁRIO PEDAGÓGICO OBRIGATÓRIO (estilo professor explicando ao aluno):
   - Comece com "Conforme o Art. X da [nome da lei]:" + transcrição LITERAL do trecho que fundamenta a resposta.
   - VERIFIQUE O NÚMERO DO ARTIGO: localize o trecho literal no texto legal e use o número do artigo onde ele REALMENTE aparece. Se o texto sobre "exclusão de QA" está no Art. 33, cite Art. 33 — JAMAIS cite Art. 19 ou outro número.
   - Para CADA alternativa incorreta, explique: "A alternativa X está incorreta porque afirma '[trecho]', quando na verdade a lei dispõe que '[trecho correto]' no Art. Y."
   - NÃO PULE nenhuma alternativa incorreta — explique TODAS.
   - Feche com conclusão pedagógica.

REGRA CRÍTICA — VERIFICAÇÃO DE ARTIGOS:
- Antes de escrever "Art. X" no comentário, LOCALIZE o trecho citado no texto legal fornecido.
- Verifique em qual "Art." ele realmente aparece.
- Um comentário com artigo errado é TÃO GRAVE quanto uma alternativa incorreta.

Responda APENAS JSON válido, sem markdown, sem explicações adicionais.`;
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
    const articleBlocksCache: Record<string, Array<ArticleBlock>> = {};
    if (legalRows) {
      for (const row of legalRows) {
        legalTexts[row.disciplina] = row.content;
        articleBlocksCache[row.disciplina] = parseArticleBlocks(row.content);
      }
    }

    // 3. Fetch existing fingerprints for duplicate detection (last 1000 questions not in current batch)
    const batchIds = new Set(questions.map(q => q.id));
    const { data: existingQuestions } = await supabase
      .from("questoes").select("id, enunciado, comentario, alt_a, alt_b, alt_c, alt_d, alt_e, gabarito")
      .order("id", { ascending: false }).limit(1000);
    
    const existingFingerprints = new Map<string, number>();
    const existingSemanticFPs = new Map<string, number>();
    const existingForSimilarity: Array<{ id: number; enunciado: string }> = [];
    if (existingQuestions) {
      for (const eq of existingQuestions) {
        if (!batchIds.has(eq.id)) {
          existingFingerprints.set(buildFingerprint(eq.enunciado), eq.id);
          const correctKey = ALT_KEYS[Math.min(Math.max(eq.gabarito || 0, 0), 4)];
          const correctText = eq[correctKey] || "";
          existingSemanticFPs.set(buildSemanticFingerprint(eq.comentario || "", correctText), eq.id);
          existingForSimilarity.push({ id: eq.id, enunciado: eq.enunciado });
        }
      }
    }

    let okCount = 0;
    let fixedCount = 0;
    let deletedCount = 0;
    const details: Array<{ id: number; status: string; motivo: string }> = [];
    const batchFingerprints = new Map<string, number>();
    const batchSemanticFPs = new Map<string, number>();
    const batchForSimilarity: Array<{ id: number; enunciado: string }> = [];

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

      // ── Similarity-based duplicate check (catches rephrased questions) ──
      const similarExistingId = findSimilarQuestion(q.enunciado, existingForSimilarity, 0.55);
      if (similarExistingId) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Questão muito similar à #${similarExistingId} (overlap > 55%)` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: similar a #${similarExistingId}`);
        continue;
      }
      const similarBatchId = findSimilarQuestion(q.enunciado, batchForSimilarity, 0.55);
      if (similarBatchId !== null) {
        await supabase.from("questoes").delete().eq("id", q.id);
        deletedCount++;
        details.push({ id: q.id, status: "excluida", motivo: `Questão muito similar à #${similarBatchId} (no lote)` });
        console.log(`[VALIDAR] #${q.id} EXCLUÍDA: similar a #${similarBatchId} (lote)`);
        continue;
      }
      batchForSimilarity.push({ id: q.id, enunciado: q.enunciado });

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
      const targetArticleBlock = resolveTargetArticleBlock(
        correctAltText,
        q.comentario || "",
        realArticle,
        evidenceArticle,
        blocks,
      );
      const citationSnippets = [correctAltText, ...extractCommentEvidenceSnippets(q.comentario || "")];
      const deterministicArticle = targetArticleBlock ? `Art. ${targetArticleBlock.artNum}` : (realArticle || evidenceArticle);
      const deterministicCitation = buildDeterministicCitation(targetArticleBlock, citationSnippets) ?? deterministicArticle;
      const correctArtNum = targetArticleBlock?.artNum ?? deterministicArticle?.match(/\d+/)?.[0] ?? null;
      const targetCitationText = getCitationReferenceText(targetArticleBlock, deterministicCitation);
      const commentCitedArts = extractAllCitedArticles(q.comentario || "");

      // ── VERIFICAÇÃO COMPLETA DE TODAS AS ALTERNATIVAS ──
      const fullCheck = fullAlternativesCheck(q, blocks);

      let needsFix = false;
      let fixReason = "";

      // Check 0: LITERAL PROOF on correct answer
      if (!fullCheck.correctValid) {
        needsFix = true;
        fixReason = `PROVA LITERAL FALHOU: ${fullCheck.correctIssue || "alternativa correta sem base na lei"}`;
        console.log(`[VALIDAR] #${q.id} TRAVA LITERAL: ${fixReason}`);
      }

      // Check 0.5: Incorrect alternatives with issues (e.g. gabarito invertido)
      if (!needsFix && fullCheck.incorrectIssues.length > 0) {
        needsFix = true;
        fixReason = fullCheck.incorrectIssues[0].issue;
        console.log(`[VALIDAR] #${q.id} ALT-CHECK: ${fixReason}`);
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

      if (!needsFix && deterministicCitation && /par[aá]grafo\s+[úu]nico/i.test(deterministicCitation) && !commentContainsCitation(q.comentario || "", deterministicCitation)) {
        needsFix = true;
        fixReason = `Comentário omite a citação obrigatória ${deterministicCitation}`;
        console.log(`[VALIDAR] #${q.id} PROBLEMA: ${fixReason}`);
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

      // Check 7 (NEW): AUDITORIA FACTUAL PROFUNDA — verifica detalhes específicos
      // (números de seção, prazos, nomes de cargos) contra o texto legal
      if (!needsFix && lawText) {
        const factualAudit = deepFactualAudit(q, blocks, lawText);
        if (factualAudit.needsAudit) {
          needsFix = true;
          const firstSuspect = factualAudit.suspiciousAlts[0];
          fixReason = `ERRO FACTUAL: Alt ${firstSuspect.label}) ${firstSuspect.detail}`;
          console.log(`[VALIDAR] #${q.id} AUDITORIA FACTUAL: ${factualAudit.suspiciousAlts.map(s => `${s.label}: ${s.detail}`).join("; ")}`);
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
        let fixableArticle = deterministicArticle;
        let fixableCitation = deterministicCitation;
        
        const { corrected: snippetCorrectedComment, appliedCorrections } = applyAllSnippetCorrections(q.comentario || "", blocks);
        if (appliedCorrections.length > 0) {
          for (const corr of appliedCorrections) {
            console.log(`[VALIDAR] #${q.id} SNIPPET-CORREÇÃO: ${corr.from} → ${corr.to} (trecho pertence ao artigo correto)`);
          }
          const lastCorr = appliedCorrections[appliedCorrections.length - 1];
          const corrNum = lastCorr.to.match(/\d+/)?.[0];
          if (corrNum && articleExistsInLaw(corrNum, blocks)) {
            fixableArticle = lastCorr.to;
            fixableCitation = buildDeterministicCitation(
              getArticleBlock(fixableArticle, blocks),
              [correctAltText, ...extractCommentEvidenceSnippets(snippetCorrectedComment)],
            ) ?? fixableArticle;
          }
        }

        if (fixableCitation && (fixReason.includes("CONFRONTO") || fixReason.includes("cita") || fixReason.includes("Artigos inexistentes") || fixReason.includes("não cita") || fixReason.includes("SNIPPET") || fixReason.includes("omite"))) {
          const baseComment = appliedCorrections.length > 0
            ? snippetCorrectedComment
            : (removedRulesArts.length > 0
                ? scrubbedRulesComment.replace(/\[artigo não confirmado\]/g, fixableCitation)
                : q.comentario);
          const newComment = reconcileCommentArticle(baseComment, fixableCitation);
          const recheck = validateAllCitations(newComment, blocks);
          const postFixSnippetCheck = verifySnippetBelongsToArticle(newComment, blocks);
          
          if (recheck.valid && !hasUnconfirmedCitations(newComment) && postFixSnippetCheck.valid && commentContainsCitation(newComment, fixableCitation)) {
            // Nuclear final pass: every cited article must exist in law
            const finalCited = extractAllCitedArticles(newComment);
            const allExist = finalCited.every(a => articleExistsInLaw(a, blocks));
            if (allExist) {
              await supabase.from("questoes").update({ comentario: newComment }).eq("id", q.id);
              fixedCount++;
              details.push({ id: q.id, status: "corrigida", motivo: `Citação corrigida para ${fixableCitation}` });
              console.log(`[VALIDAR] #${q.id} CORRIGIDA: → ${fixableCitation}`);
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
      const focusArticleBlock = targetArticleBlock ?? getArticleBlock(realArticle || evidenceArticle, blocks);
      const focusArticle = focusArticleBlock ? `Art. ${focusArticleBlock.artNum}` : null;
      const focusCitation = buildDeterministicCitation(focusArticleBlock, citationSnippets) ?? focusArticle;
      if (focusArticleBlock) {
        const idx = blocks.findIndex(b => b.artNum === focusArticleBlock.artNum);
        if (idx >= 0) {
          const start = Math.max(0, idx - 2);
          const end = Math.min(blocks.length, idx + 3);
          articleContext = `\n\nARTIGOS RELEVANTES CONFIRMADOS POR BUSCA LITERAL:\n${blocks.slice(start, end).map(b => `Art. ${b.artNum}: ${b.text.substring(0, 500)}`).join("\n\n")}`;
        }
      }

      const availableArticles = buildAvailableArticles(blocks);
      const validArticlesList = buildValidArticlesList(blocks);

      const isLiteralFailure = fixReason.includes("PROVA LITERAL");
      const isFullAudit = fixReason.includes("AUDITORIA COMPLETA IA");
      const isFactualError = fixReason.includes("ERRO FACTUAL");
      const hasAltIssues = fullCheck.incorrectIssues.length > 0;
      
      // Build factual audit details if available
      let factualAuditText = "";
      if (lawText) {
        const factualAudit = deepFactualAudit(q, blocks, lawText);
        if (factualAudit.suspiciousAlts.length > 0) {
          factualAuditText = `\n\nERROS FACTUAIS DETECTADOS AUTOMATICAMENTE:\n${factualAudit.suspiciousAlts.map(s => `- Alt ${s.label}) ${s.detail}`).join("\n")}`;
        }
      }
      
      const altIssuesText = hasAltIssues
        ? `\n\nPROBLEMAS DETECTADOS NAS ALTERNATIVAS:\n${fullCheck.incorrectIssues.map(i => `- ${i.label}) ${i.issue}`).join("\n")}`
        : "";

      const prompt = `${isFullAudit
        ? `AUDITORIA COMPLETA: Você deve LER CADA UMA DAS 5 ALTERNATIVAS da questão abaixo e VERIFICAR PALAVRA POR PALAVRA se o conteúdo está correto conforme o texto legal fornecido.
        
ATENÇÃO ESPECIAL para:
- Números de seções/comissões (ex: "1ª seção" vs "2ª seção") 
- Nomes de cargos e responsabilidades (ex: quem é responsável pelo quê)
- Condições e requisitos (ex: se precisa ou não de sindicância/IPM/laudo)
- Prazos e percentuais
- Competências e atribuições (ex: quem preside, quem secretaria)
- Exceções e ressalvas legais

Se QUALQUER alternativa contiver informação que CONTRADIZ o texto legal, corrija-a imediatamente.
Se a alternativa correta estiver errada, troque o gabarito ou reescreva.
Se uma alternativa incorreta estiver acidentalmente correta segundo a lei, modifique-a para ser um distrator plausível.`
        : isLiteralFailure
          ? `ATENÇÃO: A questão abaixo FALHOU na TRAVA DE PROVA LITERAL. A alternativa correta NÃO tem base no texto legal. Você DEVE REESCREVER A QUESTÃO DO ZERO usando APENAS trechos que EXISTEM LITERALMENTE no texto legal fornecido.`
          : isFactualError
            ? `ATENÇÃO: A questão abaixo contém ERROS FACTUAIS nas alternativas. Dados específicos (números, seções, cargos, condições) NÃO correspondem ao texto legal. Verifique CADA alternativa contra a lei e corrija os dados incorretos.`
            : `A questão abaixo tem um ERRO CONFIRMADO: "${fixReason}".`
      }
${focusCitation ? `A busca literal confirmou conteúdo em ${focusCitation} do texto legal.` : "O conteúdo correto NÃO foi localizado. CRIE uma questão nova baseada em qualquer artigo do texto legal."}
${altIssuesText}${factualAuditText}

${deterministicCitation && targetCitationText ? `CITAÇÃO JURÍDICA OBRIGATÓRIA: ${deterministicCitation}

TEXTO DO DISPOSITIVO PARA REFERÊNCIA: ${targetCitationText}

INSTRUÇÃO PARA O COMENTÁRIO: Você deve gerar um comentário que valide a alternativa correta. Você é PROIBIDO de escrever qualquer outra citação legal no comentário. Use OBRIGATORIAMENTE "${deterministicCitation}" fornecida acima. Não tente "corrigir" ou mudar essa citação.` : ""}

ARTIGOS PERMITIDOS NESTA LEI: [${availableArticles}]

⚠️ LISTA COMPLETA DE ARTIGOS VÁLIDOS NESTE TEXTO LEGAL (SOMENTE estes existem — NÃO cite nenhum outro):
${validArticlesList}

REGRAS INVIOLÁVEIS:
1. A alternativa correta DEVE conter texto que existe LITERALMENTE na lei. Copie trechos reais.
2. VERIFICAÇÃO OBRIGATÓRIA DE TODAS AS 5 ALTERNATIVAS:
   - Leia CADA alternativa (A, B, C, D, E) individualmente.
   - Para CADA alternativa, localize no texto legal o trecho correspondente.
   - Verifique se TODOS os detalhes estão corretos: números, seções, cargos, prazos, condições, exceções.
   - Se um detalhe na alternativa CONTRADIZ a lei (ex: diz "2ª seção" mas a lei diz "1ª seção"), CORRIJA.
   - A alternativa CORRETA deve reproduzir fielmente o conteúdo da lei.
   - As alternativas INCORRETAS devem ser distratores PLAUSÍVEIS mas com erros sutis. NÃO podem ser cópias literais corretas da lei.
3. ${deterministicCitation ? `O comentário DEVE obrigatoriamente citar ${deterministicCitation} (definida pelo código TypeScript e confirmada por busca literal).` : (focusCitation ? `O comentário DEVE obrigatoriamente citar ${focusCitation} (confirmada por busca literal).` : "Escolha qualquer artigo da LISTA ACIMA e baseie a questão nele." )}
4. SOMENTE cite artigos da lista acima. Se um artigo NÃO está na lista, ele NÃO EXISTE no texto legal.
5. Gabarito: inteiro 0-4 (0=A, 1=B, 2=C, 3=D, 4=E). NUNCA letras.
6. NÃO use conhecimento externo. APENAS o texto fornecido.
7. O trecho entre aspas no comentário DEVE existir LITERALMENTE no artigo citado. Copie e cole do texto.
8. VERIFICAÇÃO OBRIGATÓRIA: Antes de citar "Art. X", faça a busca exata da string "Art. X" no texto legal. Se NÃO encontrar essa string exata, NÃO cite esse artigo.
9. CONSISTÊNCIA SNIPPET-ARTIGO: O trecho entre aspas DEVE pertencer ao artigo citado.
10. FIDELIDADE AO artNum CANÔNICO: O número do artigo é determinado pela posição "Art. X" no texto legal.
11. PROIBIÇÃO ABSOLUTA DE ALUCINAÇÃO.
12. PRIORIZE SEMPRE A CORREÇÃO: Reescreva e corrija a questão. Marque valida=false SOMENTE se for absolutamente impossível criar uma questão válida com o texto legal disponível.
13. COMENTÁRIO DEVE EXPLICAR CADA ALTERNATIVA: No comentário, explique por que a correta está certa (com transcrição literal da lei) e por que CADA distrator está errado (indicando qual seria o correto segundo a lei).

REGRAS PEDAGÓGICAS:
- PROIBIDO número de artigo no enunciado. Sempre CASO PRÁTICO com personagens fictícios.
- PEGADINHAS INTELIGENTES: distratores com troca de "deverá"/"poderá", inversão de prazos, "vedado"/"facultado".
- COMENTÁRIO COMPLETO: Explique por que a correta é válida, transcreva trecho literal, e explique brevemente por que cada distrator está errado.
${articleContext}

TEXTO LEGAL COMPLETO (${q.disciplina}):
${lawText.substring(0, 25000)}

QUESTÃO ${isFullAudit ? "PARA AUDITORIA COMPLETA" : "COM ERRO"}:
Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário: ${q.comentario}

${isLiteralFailure ? "REESCREVA A QUESTÃO INTEIRA DO ZERO com base literal na lei." : isFullAudit ? "VERIFIQUE CADA ALTERNATIVA CONTRA O TEXTO LEGAL. Se todas estiverem corretas, devolva a questão como está. Se encontrar QUALQUER erro factual, corrija." : "Corrija a questão INTEIRA: verifique e corrija TODAS as alternativas, o gabarito e o comentário."}
PRIORIZE A CORREÇÃO — só marque valida=false em último caso absoluto.
Responda APENAS JSON (sem markdown):
{"valida":true/false,"motivo_erro":"se invalida","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"Conforme o ${deterministicCitation || "Art. X"} da ...: '...'"}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const aiResponse = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: buildSystemPromptMaxSecurity(availableArticles, deterministicCitation) },
              { role: "user", content: prompt },
            ],
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
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw new Error(`DeepSeek ${aiResponse.status}: ${errText.substring(0, 200)}`);
        }

        const aiData = await aiResponse.json();
        let content = aiData.choices?.[0]?.message?.content || "";
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(content);

        if (result.valida === false) {
          // IA said invalid — retry once asking to FORCE correction
          console.log(`[VALIDAR] #${q.id} IA marcou inválida: "${result.motivo_erro}" — tentando retry forçando correção`);
          
          const retryPrompt = `A questão abaixo foi marcada como inválida com motivo: "${result.motivo_erro}".
NÃO ACEITO exclusão. Você DEVE criar uma questão NOVA e VÁLIDA usando o mesmo tema/disciplina e o texto legal fornecido.
Use QUALQUER artigo disponível na lista abaixo para criar uma questão correta.

ARTIGOS PERMITIDOS: [${availableArticles}]
TEXTO LEGAL (${q.disciplina}): ${lawText.substring(0, 20000)}

Responda APENAS JSON: {"valida":true,"enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"..."}`;

          try {
            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), 55000);
            const retryResp = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
              body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                  { role: "system", content: buildSystemPromptMaxSecurity(availableArticles, null) },
                  { role: "user", content: retryPrompt },
                ],
                max_tokens: 4000, temperature: 0.3,
              }),
              signal: retryController.signal,
            });
            clearTimeout(retryTimeout);

            if (retryResp.ok) {
              const retryData = await retryResp.json();
              let retryContent = retryData.choices?.[0]?.message?.content || "";
              retryContent = retryContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              const retryResult = JSON.parse(retryContent);
              
              if (retryResult.valida !== false && retryResult.enunciado) {
                const retryGab = clampGabarito(retryResult.gabarito);
                const retryCorrectText = normalizeWhitespace(retryResult[ALT_KEYS[retryGab]] || "");
                const retryLiteral = literalProofCheck(retryCorrectText, blocks);
                
                if (retryLiteral.found) {
                  const retryComment = forceDeterministicArticleInComment(
                    normalizeWhitespace(retryResult.comentario || ""),
                    retryLiteral.article
                  );
                  const { scrubbed: retryScrubbed } = scrubInvalidCitations(retryComment, blocks);
                  const retryFinal = retryScrubbed.replace(/\[artigo não confirmado\]/g, retryLiteral.article || "");
                  
                  if (!hasUnconfirmedCitations(retryFinal)) {
                    await supabase.from("questoes").update({
                      enunciado: normalizeWhitespace(retryResult.enunciado),
                      alt_a: normalizeWhitespace(retryResult.alt_a || q.alt_a),
                      alt_b: normalizeWhitespace(retryResult.alt_b || q.alt_b),
                      alt_c: normalizeWhitespace(retryResult.alt_c || q.alt_c),
                      alt_d: normalizeWhitespace(retryResult.alt_d || q.alt_d),
                      alt_e: normalizeWhitespace(retryResult.alt_e || q.alt_e),
                      gabarito: retryGab,
                      comentario: retryFinal,
                    }).eq("id", q.id);
                    fixedCount++;
                    details.push({ id: q.id, status: "corrigida", motivo: `IA reescreveu do zero (retry): ${retryLiteral.article}` });
                    console.log(`[VALIDAR] #${q.id} CORRIGIDA (retry): reescrita do zero → ${retryLiteral.article}`);
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                  }
                }
              }
            }
          } catch (retryErr) {
            console.log(`[VALIDAR] #${q.id} Retry falhou: ${String(retryErr).substring(0, 80)}`);
          }
          
          // Retry also failed — now delete as last resort
          questoesRevisaoManual.push({ id: q.id, motivo: result.motivo_erro || fixReason });
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluida", motivo: `Irrecuperável após retry: ${(result.motivo_erro || fixReason).substring(0, 120)}` });
          console.log(`[VALIDAR] #${q.id} EXCLUÍDA (último recurso): ${result.motivo_erro || fixReason}`);
        } else {
          // ── POST-AI VALIDATION: re-run literal proof on AI output ──
          const aiGabarito = clampGabarito(result.gabarito);
          const aiCorrectKey = ALT_KEYS[aiGabarito];
          const aiCorrectText = normalizeWhitespace(result[aiCorrectKey] || "");

          // TRAVA DE PROVA LITERAL on AI output
          const aiLiteralCheck = literalProofCheck(aiCorrectText, blocks);
          if (!aiLiteralCheck.found) {
            console.log(`[VALIDAR] #${q.id} IA FALHOU PROVA LITERAL — mantendo original, marcando para revisão`);
            // Keep original question instead of deleting
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (IA não melhorou prova literal)` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // POST-AI: verificação completa de TODAS as alternativas
          const aiFullCheck = fullAlternativesCheck(result, blocks);
          if (aiFullCheck.incorrectIssues.length > 0) {
            console.log(`[VALIDAR] #${q.id} PÓS-IA ALT-CHECK: ${aiFullCheck.incorrectIssues.map(i => i.issue).join("; ")}`);
          }

          if (deterministicArticle && aiLiteralCheck.article && aiLiteralCheck.article !== deterministicArticle) {
            console.log(`[VALIDAR] #${q.id} IA desviou do artigo — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (IA desviou de ${deterministicArticle})` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          const enforcedArticle = deterministicArticle || aiLiteralCheck.article;
          const enforcedCitation = deterministicCitation
            ?? buildDeterministicCitation(
              getArticleBlock(enforcedArticle, blocks),
              [aiCorrectText, ...citationSnippets, ...extractCommentEvidenceSnippets(result.comentario || "")],
            )
            ?? enforcedArticle;
          let finalComment = forceDeterministicArticleInComment(
            normalizeWhitespace(result.comentario || q.comentario),
            enforcedCitation,
          );

          const { corrected: whitelistComment, invalidArticles: whitelistInvalidArticles } = enforceAvailableArticlesWhitelist(
            finalComment,
            availableArticles,
            enforcedCitation,
          );
          finalComment = forceDeterministicArticleInComment(whitelistComment, enforcedCitation);
          if (whitelistInvalidArticles.length > 0) {
            console.error(
              `[VALIDAR] #${q.id} WHITELIST: artigos inválidos corrigidos para ${enforcedCitation || "[artigo não confirmado]"}`,
            );
          }

          // ── TRAVA DETERMINÍSTICA PÓS-IA: scrub ALL invalid citations ──
          const { scrubbed: scrubbedComment, removed: removedArts } = scrubInvalidCitations(finalComment, blocks);
          if (removedArts.length > 0) {
            console.log(`[VALIDAR] #${q.id} SCRUB PÓS-IA: removidos ${removedArts.join(", ")}`);
          }

          if (enforcedCitation) {
            finalComment = reconcileCommentArticle(
              scrubbedComment.replace(/\[artigo não confirmado\]/g, enforcedCitation),
              enforcedCitation
            );
          } else {
            finalComment = scrubbedComment;
          }

          finalComment = forceDeterministicArticleInComment(finalComment, enforcedCitation);

          // If still has unconfirmed markers — keep original instead of deleting
          if (hasUnconfirmedCitations(finalComment)) {
            console.log(`[VALIDAR] #${q.id} Alucinação pós-IA — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (IA alucionou, original preservada)` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          const whitelistRecheck = enforceAvailableArticlesWhitelist(finalComment, availableArticles, enforcedCitation);
          finalComment = forceDeterministicArticleInComment(whitelistRecheck.corrected, enforcedCitation);

          if (!commentContainsCitation(finalComment, enforcedCitation)) {
            console.log(`[VALIDAR] #${q.id} Citação ausente pós-IA — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (citação não preservada pela IA)` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Final validation: ensure ALL remaining citations exist
          const postCheck = validateAllCitations(finalComment, blocks);
          if (!postCheck.valid) {
            console.log(`[VALIDAR] #${q.id} Alucinação persistente — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (alucinação persistente na IA)` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Post-AI: apply all snippet corrections and verify
          const snippetVerify = verifySnippetBelongsToArticle(finalComment, blocks);
          if (!snippetVerify.valid) {
            // Try to apply corrections instead of deleting
            const { corrected: snippetFixed, appliedCorrections: snippetCorrs } = applyAllSnippetCorrections(finalComment, blocks);
            if (snippetCorrs.length > 0) {
              const reVerify = verifySnippetBelongsToArticle(snippetFixed, blocks);
              if (reVerify.valid) {
                finalComment = snippetFixed;
                console.log(`[VALIDAR] #${q.id} Snippet corrigido pós-IA: ${snippetCorrs.map(c => `${c.from}→${c.to}`).join(", ")}`);
              } else {
                console.log(`[VALIDAR] #${q.id} Snippet mismatch pós-IA — mantendo original`);
                okCount++;
                details.push({ id: q.id, status: "ok", motivo: `Mantida (snippet mismatch irrecuperável)` });
                await new Promise(r => setTimeout(r, 300));
                continue;
              }
            } else {
              console.log(`[VALIDAR] #${q.id} Snippet mismatch pós-IA — mantendo original`);
              okCount++;
              details.push({ id: q.id, status: "ok", motivo: `Mantida (snippet mismatch)` });
              await new Promise(r => setTimeout(r, 300));
              continue;
            }
          }

          const finalEnunciado = normalizeWhitespace(result.enunciado || q.enunciado);
          const { scrubbed: scrubbedEnunciado } = scrubInvalidCitations(finalEnunciado, blocks);
          const crossCheck = crossValidateReferences(scrubbedEnunciado, finalComment);
          if (!crossCheck.valid) {
            console.log(`[VALIDAR] #${q.id} Divergência pós-IA — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (divergência pós-IA)` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Anti-decoreba on AI output
          const decoreba = /\b(o\s+que\s+(diz|dispõe|estabelece|prevê)\s+o\s+art|qual\s+(o\s+)?artigo|segundo\s+o\s+art[\.\s]*\d|de\s+acordo\s+com\s+o\s+art[\.\s]*\d|conforme\s+o\s+art[\.\s]*\d|nos\s+termos\s+do\s+art[\.\s]*\d)/i;
          if (decoreba.test((result.enunciado || "").toLowerCase())) {
            console.log(`[VALIDAR] #${q.id} Decoreba pós-IA — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (decoreba na reescrita IA)` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          // Duplicate check on AI-rewritten question
          const newFp = buildFingerprint(result.enunciado || q.enunciado);
          const newSemFp = buildSemanticFingerprint(finalComment, aiCorrectText);
          if (existingFingerprints.has(newFp) || batchFingerprints.has(newFp)) {
            console.log(`[VALIDAR] #${q.id} Duplicata pós-IA — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (reescrita duplicou outra)` });
            continue;
          }
          if (existingSemanticFPs.has(newSemFp) || batchSemanticFPs.has(newSemFp)) {
            console.log(`[VALIDAR] #${q.id} Duplicata semântica pós-IA — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (duplicata semântica pós-IA)` });
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
        // On AI error, keep original instead of deleting
        console.log(`[VALIDAR] #${q.id} Erro IA — mantendo original: ${String(aiErr).substring(0, 100)}`);
        okCount++;
        details.push({ id: q.id, status: "ok", motivo: `Mantida (erro IA: ${String(aiErr).substring(0, 60)})` });
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
