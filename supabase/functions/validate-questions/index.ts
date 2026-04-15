import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;
type ArticleBlock = { artNum: string; text: string; normText: string };
type SanitizedLawContext = { lawText: string; blocks: ArticleBlock[] };

// ── Helpers ──────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[§º°ª.,;:!?\-–—""''\"\']/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeWhitespace(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function stripAlternativePrefix(text: string): string {
  return normalizeWhitespace(text)
    .replace(/^(?:alternativa|opção|opcao|letra)\s*[a-e]\s*[:)\-.–]?\s*/i, "")
    .replace(/^[a-e]\s*[:)\-.–]\s*/i, "");
}

function expandEnumeratedStructure(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/([:;])\s*(?=(?:[IVXLCDM]+|[a-z]|\d+)\s*[-).])/g, "$1\n")
    .replace(/([:;])\s*(?=Par[aá]grafo\s+único\b|§\s*\d+º?)/gi, "$1\n")
    .replace(/\.\s*(?=Par[aá]grafo\s+único\b|§\s*\d+º?)/gi, ".\n");
}

function stripLegislativeAnnotations(text: string): string {
  return text
    .replace(/^\*+\s*/gm, "")
    .replace(/\((?:Reda[cç][aã]o\s+(?:dada|determinada)|Acrescentad[oa]|Alterad[oa]|Revogad[oa])[^)]*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getStructuralItemKey(line: string): string | null {
  const art = line.match(/^Art\.?\s*(\d+[A-Z]?)/i);
  if (art) return `art:${art[1]}`;

  if (/^Par[aá]grafo\s+único/i.test(line)) return "paragrafo-unico";

  const paragraph = line.match(/^§\s*(\d+)º?/i);
  if (paragraph) return `par:${paragraph[1]}`;

  const inciso = line.match(/^([IVXLCDM]+)\s*[-–—]/i);
  if (inciso) return `inc:${inciso[1].toUpperCase()}`;

  const alinea = line.match(/^([a-z])\)/i);
  if (alinea) return `al:${alinea[1].toLowerCase()}`;

  const item = line.match(/^(\d+)\./);
  if (item) return `item:${item[1]}`;

  return null;
}

function sanitizeArticleBlockText(rawText: string): string {
  const preparedLines = expandEnumeratedStructure(rawText.replace(/^\*+\s*/gm, "")).split(/\n+/);
  const keptLines: string[] = [];
  const seenKeys = new Map<string, number>();

  for (const rawLine of preparedLines) {
    const normalizedRaw = normalizeWhitespace(rawLine);
    if (!normalizedRaw) continue;

    const mentionsRevocation = /revogad[oa]/i.test(rawLine);
    const cleanedLine = normalizeWhitespace(stripLegislativeAnnotations(rawLine));
    if (!cleanedLine) continue;

    const startsStructuredItem = /^(?:Art\.?\s*\d+[A-Z]?|Par[aá]grafo\s+único|§\s*\d+º?|[IVXLCDM]+\s*[-–—]|[a-z]\)|\d+\.)/i.test(cleanedLine);
    if (mentionsRevocation && (startsStructuredItem || /(?:al[ií]nea|inciso|item)\b/i.test(rawLine))) {
      continue;
    }

    const key = getStructuralItemKey(cleanedLine);
    if (key) {
      const previousIndex = seenKeys.get(key);
      if (previousIndex !== undefined) keptLines[previousIndex] = "";
      seenKeys.set(key, keptLines.length);
    }

    keptLines.push(cleanedLine);
  }

  return keptLines.filter(Boolean).join("\n");
}

function scoreArticleVariant(text: string): number {
  let score = Math.min(text.length / 120, 10);
  if (/reda[cç][aã]o\s+(?:dada|determinada)/i.test(text)) score += 100;
  if (/acrescentad[oa]/i.test(text)) score += 40;
  if (/revogad[oa]/i.test(text)) score -= 80;
  return score;
}

function buildSanitizedLawContext(rawLawText: string): SanitizedLawContext {
  const cleanedRawText = rawLawText.replace(/^\*+\s*/gm, "");
  const rawBlocks = parseArticleBlocks(cleanedRawText);

  if (rawBlocks.length === 0) {
    const normalized = normalizeWhitespace(stripLegislativeAnnotations(cleanedRawText));
    return { lawText: normalized, blocks: normalized ? [{ artNum: "0", text: normalized, normText: normalize(normalized) }] : [] };
  }

  const orderedArticles: string[] = [];
  const variantsByArticle = new Map<string, ArticleBlock[]>();

  for (const block of rawBlocks) {
    if (!variantsByArticle.has(block.artNum)) orderedArticles.push(block.artNum);
    const existing = variantsByArticle.get(block.artNum) ?? [];
    existing.push(block);
    variantsByArticle.set(block.artNum, existing);
  }

  const blocks = orderedArticles
    .map((artNum) => {
      const variants = variantsByArticle.get(artNum) ?? [];
      const preferred = variants.reduce((best, current) => (
        scoreArticleVariant(current.text) > scoreArticleVariant(best.text) ? current : best
      ), variants[0]);
      const sanitizedText = sanitizeArticleBlockText(preferred.text);
      if (!sanitizedText) return null;
      return { artNum, text: sanitizedText, normText: normalize(sanitizedText) };
    })
    .filter((block): block is ArticleBlock => Boolean(block));

  return {
    lawText: blocks.map((block) => block.text).join("\n\n"),
    blocks,
  };
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

function splitAlternativeFragments(text: string): string[] {
  const normalized = stripAlternativePrefix(text)
    .replace(/\bal[ée]m de\b/gi, ", ")
    .replace(/\bassim como\b/gi, ", ");

  const coarseParts = normalized.split(/\s*[,;]\s*/);
  return coarseParts
    .flatMap((part) => /\s+e\s+/i.test(part) ? part.split(/\s+e\s+/i) : [part])
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length >= 4);
}

function computeAlternativeSupportScore(text: string, blocks: ArticleBlock[]): { score: number; total: number; supported: number } {
  const fragments = splitAlternativeFragments(text);
  if (fragments.length < 3) return { score: 0, total: fragments.length, supported: 0 };

  let supported = 0;
  for (const fragment of fragments) {
    const normFragment = normalize(fragment);
    if (!normFragment || normFragment.length < 4) continue;

    const directMatch = blocks.some((block) => block.normText.includes(normFragment));
    const fuzzyMatch = directMatch ? null : findBestArticleForText(fragment, blocks);
    if (directMatch || (fuzzyMatch && fuzzyMatch.score >= 0.55)) supported++;
  }

  return {
    score: fragments.length > 0 ? supported / fragments.length : 0,
    total: fragments.length,
    supported,
  };
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

function truncateSmart(text: string, maxLength: number): string {
  const normalizedText = normalizeWhitespace(text);
  if (normalizedText.length <= maxLength) return normalizedText;

  const truncated = normalizedText.slice(0, maxLength + 1);
  const boundary = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("; "),
    truncated.lastIndexOf(", "),
    truncated.lastIndexOf(" "),
  );

  const cutAt = boundary > maxLength * 0.6 ? boundary : maxLength;
  return `${truncated.slice(0, cutAt).trim()}…`;
}

function stripArticleHeading(text: string): string {
  return normalizeWhitespace(text).replace(
    /^Art\.?\s*\d+[A-Z]?(?:º|°|o)?(?:\s*,\s*par[aá]grafo\s+[úu]nico)?\s*[-:–—.]?\s*/i,
    "",
  );
}

type CommentQualityAudit = {
  valid: boolean;
  isLooping: boolean;
  reason: string;
  debug: string;
};

function analyzeCommentQuality(comment: string): CommentQualityAudit {
  const normalizedComment = normalizeWhitespace(comment);
  if (!normalizedComment) {
    return { valid: false, isLooping: false, reason: "Comentário vazio", debug: "comentário vazio" };
  }

  const artMentions = normalizedComment.match(/Art\.?\s*\d+[A-Z]?(?:º|°|o)?/gi) || [];
  const freq = new Map<string, number>();

  for (const mention of artMentions) {
    const key = normalize(mention);
    freq.set(key, (freq.get(key) || 0) + 1);
  }

  const maxFreq = freq.size > 0 ? Math.max(...freq.values()) : 0;
  if (maxFreq >= 3) {
    return {
      valid: false,
      isLooping: true,
      reason: `Comentário cita artigo excessivamente (Art. mencionado ${maxFreq}x — máximo permitido: 2)`,
      debug: `artigo repetido demais — ${Array.from(freq.entries()).map(([key, value]) => `${key}:${value}x`).join(", ")}`,
    };
  }

  if (artMentions.length > 2) {
    return {
      valid: false,
      isLooping: true,
      reason: `Comentário com excesso de citações de artigos (${artMentions.length} menções — estilo robótico)`,
      debug: `${artMentions.length} menções de artigos no comentário`,
    };
  }

  if (normalizedComment.length > 100) {
    const repeatedChunk = normalizedComment.match(/(.{20,80}?)\1{2,}/i);
    if (repeatedChunk) {
      return {
        valid: false,
        isLooping: true,
        reason: "Comentário com padrão de texto repetido (glitch de geração)",
        debug: "padrão repetido no comentário",
      };
    }
  }

  if (normalizedComment.length > 1500) {
    return {
      valid: false,
      isLooping: true,
      reason: `Comentário excessivamente longo (${normalizedComment.length} chars — provável glitch ou estilo não pedagógico)`,
      debug: `comentário com ${normalizedComment.length} chars`,
    };
  }

  return { valid: true, isLooping: false, reason: "", debug: "" };
}

function buildAlternativeSnapshot(source: Record<string, any>, gabarito: number): Array<{ label: string; text: string; isCorrect: boolean }> {
  return ALT_KEYS.map((key, index) => ({
    label: String.fromCharCode(65 + index),
    text: normalizeWhitespace(source[key] || ""),
    isCorrect: index === gabarito,
  }));
}

function buildProfessorFallbackComment(params: {
  citation: string | null;
  referenceText: string;
  correctLabel: string;
  correctAltText: string;
  alternatives: Array<{ label: string; text: string; isCorrect: boolean }>;
}): string {
  const citation = normalizeWhitespace(params.citation || "Art. X");
  const quotedBase = stripArticleHeading(params.referenceText) || stripAlternativePrefix(params.correctAltText);
  const quotedSnippet = truncateSmart(quotedBase.replace(/^["“”']+|["“”']+$/g, ""), 260);
  const correctCore = truncateSmart(stripAlternativePrefix(params.correctAltText), 220);

  const distractorTemplates = [
    "altera um requisito que o dispositivo não autoriza",
    "atribui à norma um alcance que o texto não traz",
    "troca condição, competência ou consequência prevista no dispositivo",
    "acrescenta informação sem apoio no texto legal aplicado",
  ];

  const distractorLines = params.alternatives
    .filter((alternative) => !alternative.isCorrect)
    .map((alternative, index) => `A alternativa ${alternative.label} está errada porque ${distractorTemplates[index % distractorTemplates.length]}.`)
    .join(" ");

  return truncateSmart(
    `Conforme o ${citation}: "${quotedSnippet}". A alternativa ${params.correctLabel} está correta porque reproduz o núcleo da regra aplicável: ${correctCore}. ${distractorLines} Dica: foque em quem pratica o ato, em quais condições ele ocorre e qual consequência a norma estabelece.`,
    1450,
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
  const fragmentSupportScores = ALT_KEYS.map((key) => computeAlternativeSupportScore(q[key] || "", blocks));

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

  const correctSupport = fragmentSupportScores[gabarito];
  if (correctSupport.total >= 4) {
    const ambiguousAlternative = fragmentSupportScores
      .map((support, index) => ({ ...support, index }))
      .find(({ index, total, score }) => (
        index !== gabarito
        && total >= 4
        && score >= Math.max(0.75, correctSupport.score - 0.1)
      ));

    if (ambiguousAlternative) {
      issues.push({
        key: ALT_KEYS[ambiguousAlternative.index],
        label: labels[ambiguousAlternative.index],
        issue: `Mais de uma alternativa tem forte respaldo no texto legal (${labels[gabarito]}=${(correctSupport.score * 100).toFixed(0)}%, ${labels[ambiguousAlternative.index]}=${(ambiguousAlternative.score * 100).toFixed(0)}%)`,
      });
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

  return `Você é um Auditor Jurídico Implacável e um Professor Didático Experiente de direito militar.
Sua missão é analisar com a máxima profundidade e fidelidade uma questão de concurso existente (enunciado, alternativas e comentário) e confrontá-la exclusivamente com o texto legal fornecido.

OBJETIVOS:
1. VALIDAR A FIDELIDADE LEGAL: Cada parte da questão (enunciado, cada alternativa individualmente e o comentário) deve estar 100% fiel e embasada no texto legal. Qualquer desvio, alucinação ou informação não contida no texto deve ser identificada e corrigida.
2. APRIMORAR O COMENTÁRIO DIDÁTICO: O comentário deve se assemelhar à explicação de um professor, detalhando por que a alternativa correta está certa e por que as demais estão erradas, ratificando com o texto da lei. Evite citação repetitiva de artigos — quando citado, deve estar correto e contextualmente relevante.
3. FILTRAR QUESTÕES DE BAIXA QUALIDADE: Questões sem embasamento legal, do tipo "decoreba" ou com cenários militares inverossímeis devem ser reprovadas.

${correctCitation ? `CITAÇÃO JURÍDICA OBRIGATÓRIA: ${correctCitation}
REGRA: Use OBRIGATORIAMENTE "${correctCitation}" no comentário. Não tente trocar ou corrigir essa citação.
${requiresParagrafoUnico ? "Se a citação obrigatória inclui 'parágrafo único', esse complemento é obrigatório." : ""}
` : ""}

ARTIGOS PERMITIDOS NESTA LEI: [${availableArticles}]
REGRA: Só cite artigos que estejam nesta lista. Se um artigo não está aqui, ele NÃO existe no texto legal.

REGRAS ABSOLUTAS:
1. FONTE ÚNICA DE VERDADE: O texto legal fornecido é a ÚNICA fonte de informação válida. Qualquer afirmação sem respaldo direto no texto legal deve ser marcada como erro.
2. ANÁLISE INTEGRAL: Examine o enunciado, CADA alternativa individualmente e o comentário. Nenhuma parte pode conter alucinações, imprecisões ou desvios.
3. TRAVA DE PROVA LITERAL: A alternativa correta DEVE conter texto que existe LITERALMENTE na lei.
4. VERIFICAÇÃO DE TODAS AS ALTERNATIVAS:
   - Leia cada alternativa e localize o trecho correspondente no texto legal.
   - Verifique números, cargos, prazos, condições, exceções e competências.
   - A correta deve ser fiel ao texto da lei. As incorretas devem ser distratores plausíveis com erros sutis.
5. CONFRONTO DE ARTIGOS: A citação no comentário DEVE corresponder ao artigo determinado pelo código.
6. PROIBIÇÃO DE CONHECIMENTO EXTERNO: APENAS o texto literal fornecido.
7. GABARITO: inteiro de 0 a 4 (0=A, 1=B, 2=C, 3=D, 4=E).
8. PRIORIZE CORREÇÃO: Reescreva e corrija sempre que possível. Use status "REPROVADA_PARA_EXCLUSAO" SOMENTE em último caso.

9. COMENTÁRIO DIDÁTICO DE PROFESSOR (REGRA MAIS IMPORTANTE):
   O comentário deve soar como um professor explicando ao aluno em sala de aula, NÃO um documento jurídico robótico.
   
   FORMATO OBRIGATÓRIO DO COMENTÁRIO:
   - PARÁGRAFO 1: Cite o artigo UMA ÚNICA VEZ no início ("Conforme o ${correctCitation || "Art. X"} do [nome da lei]") e transcreva o trecho relevante entre aspas. NUNCA repita o número do artigo novamente.
   - PARÁGRAFO 2: Explique COM SUAS PALAVRAS por que a alternativa correta está certa, conectando o texto legal ao cenário da questão.
   - PARÁGRAFO 3: Para cada alternativa incorreta, explique BREVEMENTE o erro (ex: "A alternativa B erra ao afirmar que... quando na verdade..."). Linguagem natural, sem repetir "Art. X".
   - PARÁGRAFO 4: Conclusão pedagógica curta (dica de estudo ou ponto-chave).
   
   PROIBIÇÕES NO COMENTÁRIO:
   - PROIBIDO repetir o número do artigo mais de 2 vezes no comentário inteiro.
   - PROIBIDO formato robótico como "a) IDENTIFICAÇÃO:", "b) EXPLICAÇÃO:", "c) ANÁLISE INDIVIDUALIZADA".
   - PROIBIDO copiar trechos enormes da lei. Uma citação literal curta basta.
   - Máximo 1500 caracteres.
   - PROIBIDO incluir informações externas, opiniões pessoais ou interpretações não derivadas estritamente do texto legal.

10. EXCLUSÃO DE QUESTÕES DE BAIXA QUALIDADE: Marque como REPROVADA_PARA_EXCLUSAO questões que:
    - Não possuem embasamento claro e direto no texto legal fornecido.
    - Citam apenas números de artigos no enunciado exigindo memorização pura, sem contextualização.
    - Contêm cenários militares que violam hierarquia, procedimentos ou consequências da lei.

11. SITUAÇÕES FICTÍCIAS MILITARES: Verifique se a hierarquia, procedimentos e consequências estão em total conformidade com os padrões da lei.

FORMATO DE RESPOSTA — JSON OBRIGATÓRIO:
{
  "status": "APROVADA" | "REPROVADA_PARA_EXCLUSAO" | "REPROVADA_COM_CORRECOES",
  "motivos_reprovacao": ["motivo 1", "motivo 2"],
  "questao_versao_aprimorada": {
    "enunciado": "...",
    "alt_a": "...", "alt_b": "...", "alt_c": "...", "alt_d": "...", "alt_e": "...",
    "gabarito": 0,
    "comentario": "..."
  }
}

- Se "APROVADA": motivos_reprovacao vazio, questao_versao_aprimorada contém a versão aprimorada (comentário melhorado no estilo professor).
- Se "REPROVADA_COM_CORRECOES": motivos_reprovacao lista os problemas, questao_versao_aprimorada contém a versão corrigida.
- Se "REPROVADA_PARA_EXCLUSAO": motivos_reprovacao lista os problemas, questao_versao_aprimorada pode ser null.

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

    const questionIds = questions.map((question) => question.id);
    const { data: pendingReports } = await supabase
      .from("question_reports")
      .select("questao_id, motivo, status, created_at")
      .in("questao_id", questionIds)
      .neq("status", "resolvido")
      .order("created_at", { ascending: false });

    const reportsByQuestionId = new Map<number, string[]>();
    for (const report of pendingReports ?? []) {
      const existing = reportsByQuestionId.get(report.questao_id) ?? [];
      existing.push(normalizeWhitespace(report.motivo || ""));
      reportsByQuestionId.set(report.questao_id, existing);
    }

    // 2. Fetch legal texts and parse into article blocks
    const { data: legalRows } = await supabase.from("discipline_legal_texts").select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    const articleBlocksCache: Record<string, Array<ArticleBlock>> = {};
    if (legalRows) {
      for (const row of legalRows) {
        const sanitizedLaw = buildSanitizedLawContext(row.content);
        legalTexts[row.disciplina] = sanitizedLaw.lawText;
        articleBlocksCache[row.disciplina] = sanitizedLaw.blocks;
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
      const pendingReportMotives = reportsByQuestionId.get(q.id) ?? [];

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

      const commentQuality = analyzeCommentQuality(q.comentario || "");
      let needsFix = false;
      let fixReason = "";
      const isLoopingComment = commentQuality.isLooping;

      // Check 0.5: LITERAL PROOF on correct answer
      if (!needsFix && !fullCheck.correctValid) {
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

      // (Check 5.5 moved to Check 0 — looping comments detected first)

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

      const reportSuggestsCriticalIssue = pendingReportMotives.some((motivo) => /nenhuma alternativa correta|revogad|alterad|coment[aá]rio|cita|artigo|gabarito|incorret|errad/i.test(motivo));
      if (!needsFix && mode === "ai" && reportSuggestsCriticalIssue) {
        needsFix = true;
        fixReason = `REPORTE DO USUÁRIO: ${pendingReportMotives.join(" | ").substring(0, 220)}`;
        console.log(`[VALIDAR] #${q.id} REPORTE PENDENTE: ${fixReason}`);
      }

      if (!needsFix && !commentQuality.valid) {
        const currentGabarito = clampGabarito(q.gabarito);
        const professorComment = buildProfessorFallbackComment({
          citation: deterministicCitation,
          referenceText: targetCitationText || correctAltText,
          correctLabel: String.fromCharCode(65 + currentGabarito),
          correctAltText,
          alternatives: buildAlternativeSnapshot(q, currentGabarito),
        });
        const professorAudit = analyzeCommentQuality(professorComment);
        const professorCitationCheck = validateAllCitations(professorComment, blocks);

        if (deterministicCitation && professorAudit.valid && professorCitationCheck.valid && commentContainsCitation(professorComment, deterministicCitation)) {
          await supabase.from("questoes").update({ comentario: professorComment }).eq("id", q.id);
          fixedCount++;
          details.push({ id: q.id, status: "corrigida", motivo: `Comentário reescrito no estilo de professor (${deterministicCitation})` });
          console.log(`[VALIDAR] #${q.id} CORRIGIDA: comentário reescrito no estilo de professor → ${deterministicCitation}`);
          continue;
        }

        needsFix = true;
        fixReason = commentQuality.reason;
        console.log(`[VALIDAR] #${q.id} PROBLEMA: ${commentQuality.debug}`);
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
          const rulesGabarito = clampGabarito(q.gabarito);
          const baseComment = appliedCorrections.length > 0
            ? snippetCorrectedComment
            : (removedRulesArts.length > 0
                ? scrubbedRulesComment.replace(/\[artigo não confirmado\]/g, fixableCitation)
                : q.comentario);
          const rebuiltRulesComment = buildProfessorFallbackComment({
            citation: fixableCitation,
            referenceText: getCitationReferenceText(getArticleBlock(fixableArticle, blocks), fixableCitation) || correctAltText,
            correctLabel: String.fromCharCode(65 + rulesGabarito),
            correctAltText,
            alternatives: buildAlternativeSnapshot(q, rulesGabarito),
          });
          const newComment = analyzeCommentQuality(baseComment).valid
            ? reconcileCommentArticle(baseComment, fixableCitation)
            : rebuiltRulesComment;
          const recheck = validateAllCitations(newComment, blocks);
          const postFixSnippetCheck = verifySnippetBelongsToArticle(newComment, blocks);
          const rulesCommentAudit = analyzeCommentQuality(newComment);
          
          if (recheck.valid && !hasUnconfirmedCitations(newComment) && postFixSnippetCheck.valid && commentContainsCitation(newComment, fixableCitation) && rulesCommentAudit.valid) {
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
          } else if (!rulesCommentAudit.valid) {
            console.log(`[VALIDAR] #${q.id} PÓS-FIX COMENTÁRIO INVÁLIDO: ${rulesCommentAudit.debug}`);
          } else if (!postFixSnippetCheck.valid) {
            console.log(`[VALIDAR] #${q.id} PÓS-FIX SNIPPET FALHOU: ${postFixSnippetCheck.mismatches[0]}`);
            // Retry applying all snippet corrections on the fixed comment
            const { corrected: retryCorrected, appliedCorrections: retryCorrs } = applyAllSnippetCorrections(newComment, blocks);
            if (retryCorrs.length > 0) {
              const retryCheck = validateAllCitations(retryCorrected, blocks);
              const retrySnippet = verifySnippetBelongsToArticle(retryCorrected, blocks);
              const retryCommentAudit = analyzeCommentQuality(retryCorrected);
              if (retryCheck.valid && retrySnippet.valid && !hasUnconfirmedCitations(retryCorrected) && retryCommentAudit.valid) {
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
      const isUserReported = fixReason.includes("REPORTE DO USUÁRIO");
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

      const reportContextText = pendingReportMotives.length > 0
        ? `\n\nREPORTES PENDENTES DOS USUÁRIOS SOBRE ESTA QUESTÃO:\n${pendingReportMotives.map((motivo, index) => `${index + 1}. ${motivo}`).join("\n")}\nTrate cada reporte como hipótese concreta e confronte integralmente com o texto legal vigente antes de responder.`
        : "";

      const prompt = `${isFullAudit || isUserReported
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
      ${altIssuesText}${factualAuditText}${reportContextText}

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
8. VERIFICAÇÃO OBRIGATÓRIA DE ARTIGO: Antes de citar "Art. X", localize o trecho no texto legal. Use o número do artigo onde o trecho REALMENTE aparece. Se o conteúdo sobre "exclusão de QA" está no Art. 33, cite Art. 33 — JAMAIS cite Art. 19 ou outro.
9. CONSISTÊNCIA SNIPPET-ARTIGO: O trecho entre aspas DEVE pertencer ao artigo citado.
10. FIDELIDADE AO artNum CANÔNICO: O número do artigo é determinado pela posição "Art. X" no texto legal.
11. PROIBIÇÃO ABSOLUTA DE ALUCINAÇÃO.
12. PRIORIZE SEMPRE A CORREÇÃO: Reescreva e corrija a questão. Marque valida=false SOMENTE se for absolutamente impossível criar uma questão válida com o texto legal disponível.
13. COMENTÁRIO DE PROFESSOR (NÃO ROBÓTICO):
    - Cite o artigo UMA VEZ no início com o trecho literal relevante entre aspas.
    - Explique com suas palavras por que a correta está certa.
    - Para cada alternativa incorreta, explique BREVEMENTE o erro em linguagem natural.
    - Feche com uma dica pedagógica curta.
    - PROIBIDO repetir "Art. X" mais de 2 vezes no comentário inteiro.
    - PROIBIDO formato "a) IDENTIFICAÇÃO... b) EXPLICAÇÃO... c) ANÁLISE..."
    - Máximo 1500 caracteres no comentário.

REGRAS PEDAGÓGICAS:
- PROIBIDO número de artigo no enunciado. Sempre CASO PRÁTICO com personagens fictícios.
- PEGADINHAS INTELIGENTES: distratores com troca de "deverá"/"poderá", inversão de prazos, "vedado"/"facultado".
${articleContext}

TEXTO LEGAL COMPLETO (${q.disciplina}):
${lawText.substring(0, 25000)}

QUESTÃO ${isFullAudit ? "PARA AUDITORIA COMPLETA" : "COM ERRO"}:
Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário: ${isLoopingComment ? "[COMENTÁRIO CORROMPIDO OU REPETITIVO — IGNORAR E REESCREVER DO ZERO NO ESTILO DE PROFESSOR]" : (q.comentario || "").substring(0, 1500)}

${isLoopingComment ? "O COMENTÁRIO ORIGINAL ESTÁ CORROMPIDO ou repete o número do artigo de forma excessiva e robótica. REESCREVA O COMENTÁRIO DO ZERO como se fosse um professor explicando ao aluno. Cite o artigo UMA VEZ, explique por que a correta está certa, explique brevemente o erro de cada distrator, e termine com uma dica de estudo. Verifique todas as alternativas contra o texto legal." : isLiteralFailure ? "REESCREVA A QUESTÃO INTEIRA DO ZERO com base literal na lei." : (isFullAudit || isUserReported) ? "VERIFIQUE CADA ALTERNATIVA CONTRA O TEXTO LEGAL. Se todas estiverem corretas, devolva a questão como está. Se encontrar QUALQUER erro, corrija. REESCREVA o comentário no estilo de professor." : "Corrija a questão INTEIRA: verifique e corrija TODAS as alternativas, o gabarito e o comentário no estilo de professor."}
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
            temperature: 0.1,
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

        // ── Normalize new structured format to flat format for downstream processing ──
        const isNewFormat = result.status && result.questao_versao_aprimorada;
        const isExclusion = result.status === "REPROVADA_PARA_EXCLUSAO";
        const isOldInvalid = result.valida === false;
        
        // Extract the improved question from the new format
        const improved = isNewFormat ? result.questao_versao_aprimorada : result;
        const motivos = result.motivos_reprovacao || [];

        if (isExclusion || (isOldInvalid && !isNewFormat)) {
          const motivoTexto = motivos.length > 0 ? motivos.join("; ") : (result.motivo_erro || fixReason);
          console.log(`[VALIDAR] #${q.id} IA marcou para exclusão: "${motivoTexto}" — tentando retry forçando correção`);
          
          const retryPrompt = `A questão abaixo foi marcada como REPROVADA_PARA_EXCLUSAO com motivos: "${motivoTexto}".
NÃO ACEITO exclusão. Você DEVE criar uma questão NOVA e VÁLIDA usando o mesmo tema/disciplina e o texto legal fornecido.
Use QUALQUER artigo disponível na lista abaixo para criar uma questão correta.

ARTIGOS PERMITIDOS: [${availableArticles}]
TEXTO LEGAL (${q.disciplina}): ${lawText.substring(0, 20000)}

Responda APENAS JSON no formato:
{"status":"REPROVADA_COM_CORRECOES","motivos_reprovacao":[],"questao_versao_aprimorada":{"enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"..."}}`;

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
                max_tokens: 4000, temperature: 0.1,
              }),
              signal: retryController.signal,
            });
            clearTimeout(retryTimeout);

            if (retryResp.ok) {
              const retryData = await retryResp.json();
              let retryContent = retryData.choices?.[0]?.message?.content || "";
              retryContent = retryContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              const retryResult = JSON.parse(retryContent);
              
              // Extract from new format or flat
              const retryImproved = retryResult.questao_versao_aprimorada || retryResult;
              const retryNotExclusion = retryResult.status !== "REPROVADA_PARA_EXCLUSAO" && retryResult.valida !== false;
              
              if (retryNotExclusion && retryImproved.enunciado) {
                const retryGab = clampGabarito(retryImproved.gabarito);
                const retryCorrectText = normalizeWhitespace(retryImproved[ALT_KEYS[retryGab]] || "");
                const retryLiteral = literalProofCheck(retryCorrectText, blocks);
                
                if (retryLiteral.found) {
                  const retryAlternatives = buildAlternativeSnapshot(retryImproved, retryGab);
                  const retryComment = forceDeterministicArticleInComment(
                    normalizeWhitespace(retryImproved.comentario || ""),
                    retryLiteral.article
                  );
                  const { scrubbed: retryScrubbed } = scrubInvalidCitations(retryComment, blocks);
                  let retryFinal = retryScrubbed.replace(/\[artigo não confirmado\]/g, retryLiteral.article || "");
                  let retryCommentAudit = analyzeCommentQuality(retryFinal);
                  if (!retryCommentAudit.valid) {
                    retryFinal = buildProfessorFallbackComment({
                      citation: retryLiteral.article,
                      referenceText: getCitationReferenceText(getArticleBlock(retryLiteral.article, blocks), retryLiteral.article) || retryCorrectText,
                      correctLabel: String.fromCharCode(65 + retryGab),
                      correctAltText: retryCorrectText,
                      alternatives: retryAlternatives,
                    });
                    retryCommentAudit = analyzeCommentQuality(retryFinal);
                  }
                  
                  if (!hasUnconfirmedCitations(retryFinal) && retryCommentAudit.valid && validateAllCitations(retryFinal, blocks).valid && commentContainsCitation(retryFinal, retryLiteral.article)) {
                    await supabase.from("questoes").update({
                      enunciado: normalizeWhitespace(retryImproved.enunciado),
                      alt_a: normalizeWhitespace(retryImproved.alt_a || q.alt_a),
                      alt_b: normalizeWhitespace(retryImproved.alt_b || q.alt_b),
                      alt_c: normalizeWhitespace(retryImproved.alt_c || q.alt_c),
                      alt_d: normalizeWhitespace(retryImproved.alt_d || q.alt_d),
                      alt_e: normalizeWhitespace(retryImproved.alt_e || q.alt_e),
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
          questoesRevisaoManual.push({ id: q.id, motivo: motivoTexto });
          await supabase.from("questoes").delete().eq("id", q.id);
          deletedCount++;
          details.push({ id: q.id, status: "excluida", motivo: `Irrecuperável após retry: ${motivoTexto.substring(0, 120)}` });
          console.log(`[VALIDAR] #${q.id} EXCLUÍDA (último recurso): ${motivoTexto}`);
        } else {
          // APROVADA or REPROVADA_COM_CORRECOES — apply the improved version
          // ── POST-AI VALIDATION: re-run literal proof on AI output ──
          const aiGabarito = clampGabarito(improved.gabarito);
          const aiCorrectKey = ALT_KEYS[aiGabarito];
          const aiCorrectText = normalizeWhitespace(improved[aiCorrectKey] || "");

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
          const aiFullCheck = fullAlternativesCheck(improved, blocks);
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
          // When comment is looping, NEVER fall back to original q.comentario
          const baseComment = isLoopingComment
            ? (result.comentario || `Conforme o ${enforcedCitation || "texto legal"}.`)
            : (result.comentario || q.comentario);
          let finalComment = forceDeterministicArticleInComment(
            normalizeWhitespace(baseComment),
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

          let finalCommentAudit = analyzeCommentQuality(finalComment);
          if (!finalCommentAudit.valid) {
            finalComment = buildProfessorFallbackComment({
              citation: enforcedCitation,
              referenceText: getCitationReferenceText(getArticleBlock(enforcedArticle, blocks), enforcedCitation) || aiCorrectText,
              correctLabel: String.fromCharCode(65 + aiGabarito),
              correctAltText: aiCorrectText,
              alternatives: buildAlternativeSnapshot(result, aiGabarito),
            });
            finalCommentAudit = analyzeCommentQuality(finalComment);
          }

          if (!finalCommentAudit.valid) {
            console.log(`[VALIDAR] #${q.id} Comentário pós-IA ainda inválido — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (comentário pós-IA inválido)` });
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

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
          // For looping comments, skip strict snippet check — the AI wrote from scratch
          if (!isLoopingComment) {
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
          } else {
            console.log(`[VALIDAR] #${q.id} Comentário loop — snippet check relaxado para reescrita IA`);
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

          // Duplicate check on AI-rewritten question (skip if fixing looping comment — same enunciado is expected)
          const newFp = buildFingerprint(result.enunciado || q.enunciado);
          const newSemFp = buildSemanticFingerprint(finalComment, aiCorrectText);
          if (!isLoopingComment && (existingFingerprints.has(newFp) || batchFingerprints.has(newFp))) {
            console.log(`[VALIDAR] #${q.id} Duplicata pós-IA — mantendo original`);
            okCount++;
            details.push({ id: q.id, status: "ok", motivo: `Mantida (reescrita duplicou outra)` });
            continue;
          }
          if (!isLoopingComment && (existingSemanticFPs.has(newSemFp) || batchSemanticFPs.has(newSemFp))) {
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
