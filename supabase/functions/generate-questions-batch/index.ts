import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;
type ArticleBlock = { artNum: string; text: string; normText: string };

function normalizeWhitespace(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[§º°ª.,;:!?\-–—""''\"\']/g, " ").replace(/\s+/g, " ").trim();
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

  const words = normSnippet.split(" ").filter(word => word.length > 2);
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

/** Verifica se o trecho citado entre aspas no comentário pertence ao artigo indicado */
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

    const actualArticle = findArticleForText(snippet, blocks);
    if (actualArticle) {
      const actualNum = actualArticle.match(/\d+/)?.[0];
      if (actualNum && actualNum !== citedNum) {
        mismatches.push(`Cita Art. ${citedNum} mas trecho pertence ao Art. ${actualNum}`);
        corrections.push({ citedNum, actualNum });
      }
    } else {
      const block = blocks.find(b => b.artNum === citedNum);
      if (block) {
        const snippetWords = new Set(normSnippet.split(" ").filter(w => w.length > 3));
        const blockWords = new Set(block.normText.split(" ").filter(w => w.length > 3));
        let overlap = 0;
        for (const w of snippetWords) if (blockWords.has(w)) overlap++;
        const score = snippetWords.size > 0 ? overlap / snippetWords.size : 0;
        if (score < 0.2) {
          mismatches.push(`Trecho entre aspas não encontrado no Art. ${citedNum} (overlap=${(score*100).toFixed(0)}%)`);
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

/** Apply ALL snippet-vs-article corrections found */
function applyAllSnippetCorrections(comment: string, blocks: ArticleBlock[]): { corrected: string; appliedCorrections: Array<{from: string; to: string}> } {
  let result = comment;
  const applied: Array<{from: string; to: string}> = [];
  const check = verifySnippetBelongsToArticle(result, blocks);
  
  if (check.corrections.length > 0) {
    for (const corr of check.corrections) {
      if (articleExistsInBlocks(corr.actualNum, blocks)) {
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

function extractAllCitedArticles(text: string): string[] {
  const matches = text.match(/Art\.?\s*(\d+)/gi) || [];
  return [...new Set(matches.map(m => m.match(/\d+/)?.[0] || "").filter(Boolean))];
}

/**
 * Extrai apenas citações de artigo que se referem à LEI ATUAL.
 * Citações com marcador externo ("da Lei X", "do CPP", "da CF", etc.) são consideradas
 * de OUTRO diploma e ignoradas pela validação contra `blocks`.
 */
function extractInternalCitedArticles(text: string): string[] {
  const result: string[] = [];
  const re = /Art\.?\s*(\d+)([^.;]{0,80})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = m[1];
    const tail = (m[2] || "").toLowerCase();
    const externalMarker = /\b(d[aoe]s?\s+(lei|lc|lei\s+complementar|decreto|c[óo]digo|cf|constitui[çc][ãa]o|cpp|cpm|cppm|cpc|cp|ctn|clt|estatuto|regulamento)\b)/i;
    if (externalMarker.test(tail)) continue;
    result.push(num);
  }
  return [...new Set(result)];
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

function articleExistsInBlocks(artNum: string, blocks: ArticleBlock[]): boolean {
  return blocks.some(b => b.artNum === artNum);
}

function validateAllCitations(comment: string, blocks: ArticleBlock[]): { valid: boolean; missing: string[] } {
  // Apenas citações INTERNAS são validadas; citações externas explícitas são permitidas.
  const cited = extractInternalCitedArticles(comment);
  const missing: string[] = [];
  for (const artNum of cited) {
    if (!articleExistsInBlocks(artNum, blocks)) missing.push(`Art. ${artNum}`);
  }
  return { valid: missing.length === 0, missing };
}

/** Valida citações de artigo em QUALQUER campo da questão (enunciado, alternativas, comentário). */
function validateCitationsInAllFields(q: Record<string, any>, blocks: ArticleBlock[]): { valid: boolean; missing: Array<{ field: string; arts: string[] }> } {
  const fields: Array<[string, string]> = [
    ["enunciado", String(q.enunciado || "")],
    ["alt_a", String(q.alt_a || "")],
    ["alt_b", String(q.alt_b || "")],
    ["alt_c", String(q.alt_c || "")],
    ["alt_d", String(q.alt_d || "")],
    ["alt_e", String(q.alt_e || "")],
    ["comentario", String(q.comentario || "")],
  ];
  const missing: Array<{ field: string; arts: string[] }> = [];
  for (const [name, txt] of fields) {
    const internalCited = extractInternalCitedArticles(txt);
    const bad = internalCited.filter(n => !articleExistsInBlocks(n, blocks));
    if (bad.length) missing.push({ field: name, arts: bad.map(n => `Art. ${n}`) });
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

function crossValidateReferences(enunciado: string, comment: string): { valid: boolean; reason: string } {
  const enunciadoArts = extractAllCitedArticles(enunciado);
  const commentArts = extractAllCitedArticles(comment);
  if (enunciadoArts.length > 0 && commentArts.length > 0) {
    if (!enunciadoArts.some(a => commentArts.includes(a))) {
      return { valid: false, reason: `Enunciado cita Art. ${enunciadoArts.join(",")} mas comentário cita Art. ${commentArts.join(",")}` };
    }
  }
  return { valid: true, reason: "" };
}

/** Compute how much literal support an alternative has in the law text */
function computeAltLiteralSupport(altText: string, lawNorm: string): number {
  const norm = normalize(altText);
  const words = norm.split(" ").filter(w => w.length > 3);
  if (words.length === 0) return 0;
  let matched = 0;
  for (const w of words) { if (lawNorm.includes(w)) matched++; }
  return matched / words.length;
}

/** Check if the correct alternative's key phrases exist in the specific cited article block */
function computeArticleSpecificProof(altText: string, commentText: string, blocks: ArticleBlock[]): number {
  const citedNums = extractAllCitedArticles(commentText);
  if (citedNums.length === 0) return 0;
  
  // Combine all cited article blocks
  const citedBlocksText = citedNums
    .map(num => blocks.find(b => b.artNum === num))
    .filter(Boolean)
    .map(b => b!.normText)
    .join(" ");
  
  if (!citedBlocksText) return 0;
  
  const normAlt = normalize(altText);
  const words = normAlt.split(" ").filter(w => w.length > 3);
  if (words.length === 0) return 0;
  
  let matched = 0;
  for (const w of words) { if (citedBlocksText.includes(w)) matched++; }
  return matched / words.length;
}

/** Detect ambiguity: check if any incorrect alternative has HIGH support in the SPECIFIC cited article (not the whole law) */
function detectAmbiguity(q: any, blocks: ArticleBlock[], lawNorm: string): { ambiguous: boolean; details: string } {
  const gab = typeof q.gabarito === "number" ? q.gabarito : 0;
  
  const correctKey = ALT_KEYS[Math.min(Math.max(gab, 0), 4)];
  const correctAltText = q[correctKey] || "";
  
  // ── Check 1: Gabarito inversion against WHOLE LAW ──
  // If ANY incorrect alt has MORE literal support than the correct one in the full law text, it's likely inverted
  const correctLawScore = computeAltLiteralSupport(correctAltText, lawNorm);
  for (let i = 0; i < ALT_KEYS.length; i++) {
    if (i === gab) continue;
    const altText = q[ALT_KEYS[i]] || "";
    const altLawScore = computeAltLiteralSupport(altText, lawNorm);
    // Só sinaliza inversão se a margem for SIGNIFICATIVA (>=15pp) e o gabarito tiver suporte fraco (<0.80).
    // Em textos legais curtos, qualquer alternativa bem redigida atinge 85-100% — diferenças de 1-5pp são ruído.
    if (
      altLawScore >= 0.85 &&
      correctLawScore < 0.80 &&
      (altLawScore - correctLawScore) >= 0.15
    ) {
      const letter = String.fromCharCode(65 + i);
      return {
        ambiguous: true,
        details: `Alternativa incorreta (${letter}) tem base literal MAIS FORTE que o gabarito (${(altLawScore*100).toFixed(0)}% vs ${(correctLawScore*100).toFixed(0)}%) — possível gabarito invertido`
      };
    }
  }
  
  // ── Check 2: Article-specific ambiguity ──
  const citedNums = extractAllCitedArticles(q.comentario || "");
  if (citedNums.length === 0) return { ambiguous: false, details: "" };
  
  const citedBlocksText = citedNums
    .map(num => blocks.find(b => b.artNum === num))
    .filter(Boolean)
    .map(b => b!.normText)
    .join(" ");
  
  if (!citedBlocksText || citedBlocksText.length < 20) return { ambiguous: false, details: "" };
  
  const correctScore = computeAltLiteralSupport(correctAltText, citedBlocksText);
  
  const highSupportIncorrect: string[] = [];
  for (let i = 0; i < ALT_KEYS.length; i++) {
    if (i === gab) continue;
    const altText = q[ALT_KEYS[i]] || "";
    const score = computeAltLiteralSupport(altText, citedBlocksText);
    // Flag if incorrect alt has >= 85% support in cited article AND is as good as correct
    if (score >= 0.85 && score >= correctScore * 0.9) {
      highSupportIncorrect.push(`${String.fromCharCode(65 + i)}=${(score * 100).toFixed(0)}%`);
    }
  }
  
  if (highSupportIncorrect.length >= 1) {
    return { ambiguous: true, details: `Alternativa(s) incorreta(s) com suporte igual ou superior ao gabarito no artigo citado: ${highSupportIncorrect.join(", ")}` };
  }
  return { ambiguous: false, details: "" };
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

function computeEnunciadoSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" ").filter(w => w.length > 3));
  const wordsB = new Set(normalize(b).split(" ").filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

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

// ──────────────────────────────────────────────────────────────────────────
// SEMANTIC SIGNATURES — Bloco 1: anti-repetição forte usando DeepSeek
// ──────────────────────────────────────────────────────────────────────────

type SemanticSignature = {
  artigo: string;          // "Art. 12" — dispositivo principal cobrado
  conceito: string[];      // 3-5 termos-chave do raciocínio (lower-case, sem stopwords)
  pegadinha: string;       // categoria curta da armadilha (ex: "troca-posto", "inversao-competencia", "prazo-trocado")
  sujeito: string;         // entidade/cargo/posto principal envolvido (ex: "tenente-coronel", "comandante-geral")
};

const EMPTY_SIGNATURE: SemanticSignature = { artigo: "", conceito: [], pegadinha: "", sujeito: "" };

function extractMainArticle(comentario: string): string {
  const arts = extractAllCitedArticles(comentario);
  return arts.length > 0 ? `Art. ${arts[0]}` : "";
}

function normSigToken(s: string): string {
  return normalize(String(s ?? "")).replace(/\s+/g, "-");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

/** Compara duas assinaturas com pesos: artigo=0.4, conceito=0.4, pegadinha=0.15, sujeito=0.05 */
function compareSignatures(a: SemanticSignature | null, b: SemanticSignature | null): number {
  if (!a || !b) return 0;
  const artA = normSigToken(a.artigo);
  const artB = normSigToken(b.artigo);
  const artScore = artA && artB && artA === artB ? 1 : 0;

  const conceitoScore = jaccard(
    new Set((a.conceito || []).map(normSigToken).filter(Boolean)),
    new Set((b.conceito || []).map(normSigToken).filter(Boolean)),
  );

  const pegA = normSigToken(a.pegadinha);
  const pegB = normSigToken(b.pegadinha);
  const pegScore = pegA && pegB && pegA === pegB ? 1 : 0;

  const sujA = normSigToken(a.sujeito);
  const sujB = normSigToken(b.sujeito);
  const sujScore = sujA && sujB && sujA === sujB ? 1 : 0;

  return artScore * 0.4 + conceitoScore * 0.4 + pegScore * 0.15 + sujScore * 0.05;
}

/** Chama DeepSeek (ou Lovable AI) para extrair a assinatura semântica de UMA questão. */
async function buildSemanticSignature(
  q: { enunciado: string; alt_correta: string; comentario: string },
  apiUrl: string,
  apiModel: string,
  apiKey: string,
): Promise<SemanticSignature> {
  const sigPrompt = `Você é um analista jurídico. Extraia a "assinatura semântica" da questão abaixo em JSON estrito.

QUESTÃO:
Enunciado: ${q.enunciado}
Alternativa correta: ${q.alt_correta}
Comentário: ${q.comentario.substring(0, 1500)}

Retorne EXATAMENTE este JSON (sem markdown, sem prosa):
{"artigo":"Art. N","conceito":["termo1","termo2","termo3","termo4"],"pegadinha":"categoria-curta-em-kebab-case","sujeito":"entidade-ou-cargo-principal-em-kebab-case"}

Regras:
- "artigo": o dispositivo legal CENTRAL cobrado (use "Art. N" sem inciso). Se não houver, use "".
- "conceito": 3 a 5 substantivos/verbos-chave do raciocínio cobrado, em minúsculas, sem stopwords, sem números de artigo. Exemplos: ["promocao","merecimento","interstício","oficial-superior"].
- "pegadinha": categoria curta da armadilha cobrada. Exemplos: "troca-de-posto", "inversao-competencia", "prazo-trocado", "sujeito-errado", "inclusao-indevida", "exclusao-indevida", "literalidade-direta".
- "sujeito": entidade ou cargo/posto principal envolvido. Exemplos: "comandante-geral", "tenente-coronel", "cpo", "comissao-promocao".`;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 25_000);
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: apiModel,
        messages: [{ role: "user", content: sigPrompt }],
        max_tokens: 300,
        temperature: 0.0,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) {
      console.warn(`[SIG] HTTP ${resp.status} — usando fallback`);
      return fallbackSignature(q);
    }
    const json = await resp.json();
    let content = json?.choices?.[0]?.message?.content || "";
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return fallbackSignature(q);
    const parsed = JSON.parse(match[0]);
    return {
      artigo: String(parsed.artigo ?? "").trim() || extractMainArticle(q.comentario),
      conceito: Array.isArray(parsed.conceito) ? parsed.conceito.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 6) : [],
      pegadinha: String(parsed.pegadinha ?? "").trim(),
      sujeito: String(parsed.sujeito ?? "").trim(),
    };
  } catch (err) {
    console.warn(`[SIG] erro: ${String(err)} — usando fallback`);
    return fallbackSignature(q);
  }
}

/** Fallback determinístico se a IA falhar: extrai do comentário e da alternativa correta. */
function fallbackSignature(q: { enunciado: string; alt_correta: string; comentario: string }): SemanticSignature {
  const artigo = extractMainArticle(q.comentario);
  const stop = new Set(["para","com","sem","pelo","pela","pelos","pelas","sobre","entre","esta","este","essa","esse","aquele","aquela","como","quando","onde","quem","qual","quais","ainda","mais","menos","nao","sim","apenas","tambem","todos","todas","cada","outra","outras","outro","outros","seus","suas","seu","sua","dele","dela","deles","delas","artigo","artigos","lei","leis","decreto","regulamento","conforme","segundo","previsto","previstos","previstas","disposto","dispostos","incluso","inclusos","inclusas"]);
  const tokens = normalize(q.alt_correta + " " + q.enunciado)
    .split(" ")
    .filter(w => w.length > 4 && !stop.has(w));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  const conceito = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  return { artigo, conceito, pegadinha: "", sujeito: "" };
}

const DISCIPLINES = [
  {
    disciplina: "Lei nº 2.578/2012",
    leiNome: "Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins",
    assuntos: [
      "Disposições preliminares e conceituações", "Ingresso na Corporação e requisitos",
      "Hierarquia e disciplina militar", "Cargo e função militar", "Obrigações e ética militar",
      "Transgressões disciplinares (leves, médias, graves)", "Processos administrativos disciplinares",
      "Direitos, férias e licenças", "Prerrogativas dos militares",
      "Situações especiais (agregação, reversão)", "Exclusão do serviço ativo, reserva e reforma",
      "Demissão, exoneração e tempo de contribuição",
    ],
  },
  {
    disciplina: "LC nº 128/2021",
    leiNome: "Organização Básica da Polícia Militar do Estado do Tocantins",
    assuntos: [
      "Destinação, competências e subordinação da PMTO", "Estrutura geral da organização",
      "Unidades de direção (Comando-Geral, EMG, EME)", "Unidades de apoio (Gabinete, APMT, Assessorias, Comissões)",
      "Unidades de execução (Batalhões, Companhias, Pelotões)", "Unidades especiais (Colégios Militares)",
      "Gestão profissional e quadros", "Disposições gerais e transitórias",
    ],
  },
  {
    disciplina: "Lei nº 2.575/2012",
    leiNome: "Promoções na Polícia Militar do Estado do Tocantins",
    assuntos: [
      "Disposições preliminares sobre promoção", "Abertura de vagas",
      "Comissões de promoção (CPO e CPP)", "Critérios de promoção (antiguidade, merecimento, escolha, bravura, post-mortem)",
      "Quadros de acesso (QAA, QAM, QAE)", "Interstícios para promoção",
      "Avaliação profissional e moral", "Impedimentos e exclusão dos QA",
      "Promoções especiais (tempo de contribuição, invalidez)", "Recursos e disposições finais",
    ],
  },
  {
    disciplina: "CPPM",
    leiNome: "Código de Processo Penal Militar (DL 1.002/1969) - Arts. 8º a 28 e 243 a 253",
    assuntos: [
      "Polícia judiciária militar e exercício", "Inquérito policial militar (IPM)",
      "Instauração e condução do IPM", "Delegação de competência",
      "Prazo e encerramento do IPM", "Busca e apreensão", "Medidas preventivas e assecuratórias",
    ],
  },
  {
    disciplina: "RDMETO",
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins (Decreto 4.994/2014)",
    assuntos: [
      "Disposições gerais e finalidade", "Sujeição ao RDMETO",
      "Conceitos (honra pessoal, pundonor, decoro, hierarquia, disciplina)",
      "Transgressões disciplinares and classificação", "Circunstâncias atenuantes e agravantes",
      "Punições disciplinares e tipos", "Comportamento militar e classificação",
      "Recursos disciplinares", "Processos administrativos",
    ],
  },
  {
    disciplina: "Direito Penal Militar",
    leiNome: "Código Penal Militar (DL 1.001/1969) - Parte Geral, Arts. 1 a 135",
    assuntos: [
      "Aplicação da lei penal militar (princípio de legalidade)", "Crimes militares em tempo de paz",
      "Crime (fato típico, antijuridicidade, culpabilidade)", "Tentativa e consumação",
      "Concurso de agentes e de crimes", "Penas e suas espécies",
      "Aplicação e cálculo da pena", "Suspensão condicional da pena",
      "Livramento condicional", "Medidas de segurança",
      "Efeitos da condenação e reabilitação", "Extinção da punibilidade e prescrição",
    ],
  },
  {
    disciplina: "Lei Orgânica PM",
    leiNome: "Lei Orgânica Nacional das Polícias Militares (Lei nº 14.751/2023)",
    assuntos: [
      "Disposições gerais e princípios", "Definição e natureza das PMs e CBMs",
      "Competências e atribuições", "Hierarquia e disciplina",
      "Gestão de pessoal e carreira", "Formação e capacitação",
      "Remuneração e benefícios", "Disposições finais e transitórias",
    ],
  },
];

// 10 approach types for maximum diversity — cycled based on existing question count
// Mix of direct law-text questions AND scenario-based questions
const APPROACH_TYPES = [
  "LITERALIDADE_DIRETA",
  "CASO_PRATICO",
  "PEGADINHA_DETALHE",
  "VERDADEIRO_FALSO",
  "COMBINACAO_ARTIGOS",
  "CASO_PRATICO_2",
  "EXCECAO_REGRA",
  "CONCEITO_LEGAL",
  "INTERPRETACAO_SISTEMATICA",
  "COMPLETAR_DISPOSITIVO",
] as const;

/** Truncate legal text intelligently: keep structure, trim at article boundaries */
function truncateLegalText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cutPoint = text.lastIndexOf("Art.", maxChars);
  if (cutPoint > maxChars * 0.7) return text.substring(0, cutPoint).trim();
  return text.substring(0, maxChars).trim() + "\n[...]";
}

function stripJsonFences(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function repairJsonCandidate(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractBalancedJsonPayload(text: string): string {
  const cleaned = stripJsonFences(text);
  const start = cleaned.search(/[\[{]/);
  if (start === -1) return cleaned;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const last = stack[stack.length - 1];
      const matches = (char === "}" && last === "{") || (char === "]" && last === "[");

      if (matches) {
        stack.pop();
        if (stack.length === 0) return cleaned.substring(start, i + 1);
      }
    }
  }

  return cleaned.substring(start).trim();
}

function normalizeParsedQuestionsRoot(parsed: unknown): any[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.questions)) return record.questions as any[];
  if (Array.isArray(record.items)) return record.items as any[];

  return null;
}

function extractArraySourceForSalvage(text: string): string {
  const questionsMatch = text.match(/"questions"\s*:/i);
  if (questionsMatch?.index !== undefined) {
    const arrayStart = text.indexOf("[", questionsMatch.index);
    if (arrayStart !== -1) return text.substring(arrayStart);
  }

  const arrayStart = text.indexOf("[");
  return arrayStart !== -1 ? text.substring(arrayStart) : text;
}

function salvageQuestionObjects(text: string): any[] {
  const source = extractArraySourceForSalvage(text);
  const parsed: any[] = [];

  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectStart = -1;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) objectStart = i;
      depth++;
      continue;
    }

    if (char === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && objectStart !== -1) {
        const chunk = source.substring(objectStart, i + 1);
        try {
          parsed.push(JSON.parse(repairJsonCandidate(chunk)));
        } catch {
          // ignore malformed partial chunk
        }
        objectStart = -1;
      }
    }
  }

  return parsed;
}

function parseQuestionsFromModelContent(content: string): { questions: any[]; salvaged: boolean } {
  const cleaned = stripJsonFences(content);
  const extracted = extractBalancedJsonPayload(cleaned);
  const candidates = [
    cleaned,
    extracted,
    repairJsonCandidate(cleaned),
    repairJsonCandidate(extracted),
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed = JSON.parse(candidate);
      const questions = normalizeParsedQuestionsRoot(parsed);
      if (questions) return { questions, salvaged: false };
    } catch {
      // continue to next candidate
    }
  }

  const salvagedQuestions = salvageQuestionObjects(extracted);
  if (salvagedQuestions.length > 0) {
    return { questions: salvagedQuestions, salvaged: true };
  }

  throw new Error("INVALID_JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const timestamp = new Date().toISOString();
  const questoesRevisaoManual: Array<{ id?: string; motivo: string }> = [];
  const errosEncontrados: Array<{ codigo: string; descricao: string }> = [];

  try {
    // ── Auth: somente admins podem gerar questões (consome créditos de IA) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supabaseAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await adminClient
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { disciplina_index, batch_size } = await req.json();
    const requestedBatchSize = Number(batch_size) || 2;
    // Mínimo 2 questões por lote (resiliência: se uma falha, sobra outra). Cap em 2 pelo budget de tempo.
    const batchSize = Math.max(2, Math.min(2, requestedBatchSize));
    const discIndex = disciplina_index ?? 0;

    if (discIndex < 0 || discIndex >= DISCIPLINES.length) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Índice de disciplina inválido.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_INDEX", descricao: `Índice ${discIndex} fora do range 0-${DISCIPLINES.length - 1}` }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const disc = DISCIPLINES[discIndex];
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch legal text
    const { data: legalTextRow, error: ltError } = await supabase
      .from("discipline_legal_texts").select("content").eq("disciplina", disc.disciplina).single();

    if (ltError || !legalTextRow?.content || String(legalTextRow.content).trim().length < 500) {
      return new Response(JSON.stringify({
        status: "erro",
        mensagem: `Texto legal oficial insuficiente para "${disc.disciplina}". Geração bloqueada — discipline_legal_texts.content é a ÚNICA fonte permitida.`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_LEGAL_TEXT", descricao: `Cadastre/expanda o texto legal oficial da disciplina "${disc.disciplina}" (mínimo 500 caracteres). PDFs, anexos e conhecimento geral do modelo são proibidos como fonte.` }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const leiSeca = legalTextRow.content;
    const blocks = parseArticleBlocks(leiSeca);
    const availableArticles = blocks.map(b => `Art. ${b.artNum}`).join(", ");

    // ── AI Provider: DeepSeek Reasoner (gerador primário). Maritaca/Lovable como fallback. ──
    const DEEPSEEK_API_KEY_PRIMARY = Deno.env.get("DEEPSEEK_API_KEY");
    const MARITACA_API_KEY = Deno.env.get("MARITACA_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useDeepSeekPrimary = !!DEEPSEEK_API_KEY_PRIMARY;
    const useMaritaca = !useDeepSeekPrimary && !!MARITACA_API_KEY;
    const useLovable = !useDeepSeekPrimary && !useMaritaca && !!LOVABLE_API_KEY;
    if (!DEEPSEEK_API_KEY_PRIMARY && !MARITACA_API_KEY && !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Nenhuma API key de IA configurada para o gerador.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_API_KEY", descricao: "Configure DEEPSEEK_API_KEY (preferencial — reasoner), MARITACA_API_KEY ou LOVABLE_API_KEY" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch existing questions for dedup (now also brings semantic signature + main article)
    const { data: existingQ } = await supabase
      .from("questoes").select("id, enunciado, comentario, alt_a, alt_b, alt_c, alt_d, alt_e, gabarito, assunto, assinatura_semantica, artigo_principal")
      .eq("disciplina", disc.disciplina).order("id", { ascending: false }).limit(1000);

    const existingFingerprints = new Set<string>();
    const existingSemanticFPs = new Set<string>();
    const existingForSimilarity: Array<{ id: number; enunciado: string }> = [];
    const articleCoverage = new Map<string, number>();
    const assuntoCoverage = new Map<string, number>();
    // Bloco 1: índice de assinaturas semânticas existentes (por artigo) para comparação rápida
    const existingByArticle = new Map<string, Array<{ id: number; assunto: string; signature: SemanticSignature; enunciado: string }>>();

    if (existingQ) {
      existingQ.forEach((eq: any) => {
        existingFingerprints.add(buildFingerprint(eq.enunciado));
        const correctKey = ALT_KEYS[Math.min(Math.max(eq.gabarito || 0, 0), 4)];
        const correctText = eq[correctKey] || "";
        existingSemanticFPs.add(buildSemanticFingerprint(eq.comentario || "", correctText));
        existingForSimilarity.push({ id: eq.id, enunciado: eq.enunciado });

        const arts = extractAllCitedArticles(eq.comentario || "");
        arts.forEach((a: string) => {
          articleCoverage.set(a, (articleCoverage.get(a) || 0) + 1);
        });

        const assunto = eq.assunto || "";
        if (assunto) assuntoCoverage.set(assunto, (assuntoCoverage.get(assunto) || 0) + 1);

        // Bloco 1: indexa por artigo usando assinatura armazenada ou fallback determinístico
        const storedSig = eq.assinatura_semantica && typeof eq.assinatura_semantica === "object" ? eq.assinatura_semantica as any : null;
        const sig: SemanticSignature = storedSig
          ? {
              artigo: String(storedSig.artigo ?? "") || (eq.artigo_principal || extractMainArticle(eq.comentario || "")),
              conceito: Array.isArray(storedSig.conceito) ? storedSig.conceito : [],
              pegadinha: String(storedSig.pegadinha ?? ""),
              sujeito: String(storedSig.sujeito ?? ""),
            }
          : {
              artigo: eq.artigo_principal || extractMainArticle(eq.comentario || ""),
              conceito: fallbackSignature({ enunciado: eq.enunciado, alt_correta: correctText, comentario: eq.comentario || "" }).conceito,
              pegadinha: "",
              sujeito: "",
            };
        const artKey = normSigToken(sig.artigo) || "__sem_artigo__";
        if (!existingByArticle.has(artKey)) existingByArticle.set(artKey, []);
        existingByArticle.get(artKey)!.push({ id: eq.id, assunto: eq.assunto || "", signature: sig, enunciado: eq.enunciado });
      });
    }

    // Extract recent question OPENINGS (first 8 words) so we can ask the AI to vary phrasing.
    const recentOpenings = (existingQ || [])
      .slice(0, 40)
      .map((eq) => normalizeWhitespace(eq.enunciado).split(/\s+/).slice(0, 8).join(" "))
      .filter(Boolean);
    const openingsToAvoid = [...new Set(recentOpenings)].slice(0, 12);

    // Score and rank articles by coverage (prioritize under-explored)
    const scoredBlocks = blocks
      .map((block) => ({
        block,
        coverage: articleCoverage.get(block.artNum) || 0,
      }))
      .sort((a, b) => a.coverage - b.coverage || Number(a.block.artNum) - Number(b.block.artNum));

    // Broader candidate pool — select from wider range for diversity
    const poolSize = Math.min(scoredBlocks.length, Math.max(batchSize * 8, 30));
    const candidatePool = scoredBlocks.slice(0, poolSize);
    
    // Shuffle candidates
    const shuffledTargets = [...candidatePool];
    for (let i = shuffledTargets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledTargets[i], shuffledTargets[j]] = [shuffledTargets[j], shuffledTargets[i]];
    }

    // Select targets — spread across different parts of the law
    const selectedTargets: typeof shuffledTargets = [];
    const usedArtNums = new Set<string>();
    for (const target of shuffledTargets) {
      if (selectedTargets.length >= batchSize) break;
      // Avoid consecutive articles for variety
      const artNum = Number(target.block.artNum);
      const tooClose = [...usedArtNums].some(n => Math.abs(Number(n) - artNum) <= 1);
      if (tooClose && shuffledTargets.length > batchSize * 2) continue;
      selectedTargets.push(target);
      usedArtNums.add(target.block.artNum);
    }
    // Fill remaining if spacing was too strict
    if (selectedTargets.length < batchSize) {
      for (const target of shuffledTargets) {
        if (selectedTargets.length >= batchSize) break;
        if (!usedArtNums.has(target.block.artNum)) {
          selectedTargets.push(target);
          usedArtNums.add(target.block.artNum);
        }
      }
    }

    selectedTargets.sort((a, b) => a.coverage - b.coverage || Number(a.block.artNum) - Number(b.block.artNum));

    if (selectedTargets.length === 0) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: `Nenhum artigo elegível encontrado para "${disc.disciplina}".`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_TARGET_ARTICLES", descricao: "Não foi possível selecionar artigos-alvo para o lote" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const targetArticleNumbers = selectedTargets.map(({ block }) => block.artNum);

    // Build context: target articles + surrounding context for systemic understanding
    const targetArticlesBlock = selectedTargets
      .map(({ block, coverage }, idx) => {
        // Include neighboring articles for context (1 before, 1 after)
        const blockIdx = blocks.findIndex(b => b.artNum === block.artNum);
        const contextParts: string[] = [];
        if (blockIdx > 0) {
          contextParts.push(`[Contexto anterior - Art. ${blocks[blockIdx - 1].artNum}]\n${blocks[blockIdx - 1].text.substring(0, 300)}`);
        }
        contextParts.push(`[ARTIGO-ALVO ${idx + 1} — Art. ${block.artNum}] (cobertura: ${coverage} questões)\n${block.text}`);
        if (blockIdx < blocks.length - 1) {
          contextParts.push(`[Contexto posterior - Art. ${blocks[blockIdx + 1].artNum}]\n${blocks[blockIdx + 1].text.substring(0, 300)}`);
        }
        return contextParts.join("\n");
      })
      .join("\n\n---\n\n");

    const mostCoveredArticles = [...articleCoverage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([article, count]) => `Art. ${article} (${count})`)
      .join(", ");

    // Under-explored subjects
    const leastCoveredAssuntos = disc.assuntos
      .map(a => ({ assunto: a, count: assuntoCoverage.get(a) || 0 }))
      .sort((a, b) => a.count - b.count)
      .slice(0, 4)
      .map(a => `"${a.assunto}" (${a.count})`)
      .join(", ");

    console.log(
      `[GERAR] Iniciando: "${disc.disciplina}", batch=${batchSize}, artigos=${blocks.length}, existentes=${existingQ?.length || 0}, alvos=${targetArticleNumbers.map(a => `Art. ${a}`).join(", ")}`,
    );

    // Cycle approaches for maximum diversity
    const approachOffset = (existingQ?.length || 0) % APPROACH_TYPES.length;
    const approachAssignments: string[] = [];
    for (let i = 0; i < batchSize; i++) {
      approachAssignments.push(APPROACH_TYPES[(approachOffset + i) % APPROACH_TYPES.length]);
    }

    const coverageGuidanceBlock = mostCoveredArticles
      ? `\nARTIGOS JÁ MUITO EXPLORADOS (EVITE): ${mostCoveredArticles}`
      : "";

    const openingsAvoidBlock = openingsToAvoid.length > 0
      ? `\nABERTURAS DE ENUNCIADO JÁ MUITO USADAS (NÃO COMECE NENHUMA QUESTÃO COM PALAVRAS PARECIDAS):\n${openingsToAvoid.map((o, i) => `${i + 1}) "${o}..."`).join("\n")}\n\nUse aberturas variadas: "Constitui hipótese de...", "É vedado ao militar...", "A respeito de...", "No que se refere a...", "Em relação ao instituto da...", "Sobre as competências de...", "Caso um [posto] [verbo]...", "Determinado militar...", "Suponha que...", etc.`
      : "";

    const approachInstructions = approachAssignments
      .map((a, i) => {
        const num = i + 1;
        switch (a) {
          case "LITERALIDADE_DIRETA":
            return `Questão ${num}: LITERALIDADE DIRETA — Pergunte diretamente sobre o conteúdo da lei SEM criar cenário fictício. Exemplos de enunciado: "Constitui(em) requisito(s) para promoção por merecimento:", "É correto afirmar que a legislação prevê:", "Sobre as disposições relativas a [tema], assinale a alternativa correta:", "NÃO se inclui entre as hipóteses de...". A alternativa correta é uma PARÁFRASE FIEL do texto legal. As incorretas alteram sutilmente termos, prazos, condições ou competências.`;
          case "CASO_PRATICO":
            return `Questão ${num}: CASO PRÁTICO COMPLEXO (estilo CESPE/FGV) — Crie um cenário DETALHADO (4-6 linhas) com MÚLTIPLOS ELEMENTOS relevantes: personagem com posto/graduação coerente, circunstância temporal, condição específica e um dilema jurídico. O candidato deve analisar TODOS os elementos para chegar à resposta. Inclua detalhes que funcionem como ARMADILHAS.`;
          case "PEGADINHA_DETALHE":
            return `Questão ${num}: PEGADINHA SOFISTICADA (estilo CESPE) — Construa alternativas que diferem em apenas UMA PALAVRA juridicamente decisiva: "deverá/poderá", "vedado/facultado", "cumulativamente/alternativamente", "suspensão/demissão". Pode ser cenário OU pergunta direta — varie.`;
          case "VERDADEIRO_FALSO":
            return `Questão ${num}: ASSERÇÕES SOBRE A LEI — Apresente 5 alternativas com afirmações sobre o texto legal e peça para identificar a CORRETA (ou a INCORRETA, usando "assinale a alternativa INCORRETA"). Cada alternativa deve ser uma afirmação autônoma sobre um dispositivo da lei. NÃO crie cenário fictício. Exemplos: "Com relação ao regime disciplinar, assinale a alternativa correta:", "Sobre o processo administrativo disciplinar, é INCORRETO afirmar:".`;
          case "COMBINACAO_ARTIGOS":
            return `Questão ${num}: COMBINAÇÃO DE DISPOSITIVOS (estilo FGV) — Elabore questão que exija conhecimento de DOIS ou mais dispositivos da lei. Pode ser pergunta direta ("A regra geral prevista para... admite exceção quando...") OU cenário aplicado.`;
          case "CASO_PRATICO_2":
            return `Questão ${num}: CASO PRÁTICO COM CONSEQUÊNCIAS — Apresente uma situação com personagem fictício e pergunte sobre a CONSEQUÊNCIA JURÍDICA prevista na lei. Ex: "Nessa hipótese, qual a medida administrativa cabível?" O cenário deve ter 3-5 linhas e envolver elementos que exijam raciocínio em cadeia.`;
          case "EXCECAO_REGRA":
            return `Questão ${num}: EXCEÇÃO À REGRA — Pergunte diretamente sobre exceções, ressalvas ou condições especiais previstas na lei. Exemplos: "Constitui exceção ao regime de...", "NÃO se aplica a regra geral quando...", "A ressalva prevista refere-se a...". Sem cenário fictício — foco no texto legal.`;
          case "CONCEITO_LEGAL":
            return `Questão ${num}: DEFINIÇÃO E CONCEITO LEGAL — Pergunte sobre definições, classificações ou enumerações previstas na lei. Ex: "São modalidades de punição disciplinar:", "Compete ao Comandante-Geral:", "São requisitos para...". A alternativa correta reproduz fielmente a enumeração ou definição da lei; as incorretas adicionam, omitem ou trocam itens.`;
          case "INTERPRETACAO_SISTEMATICA":
            return `Questão ${num}: INTERPRETAÇÃO SISTEMÁTICA — Elabore questão que exija compreensão da FINALIDADE do instituto jurídico e sua relação com outros dispositivos. Pode ser pergunta direta ou cenário breve. O candidato deve demonstrar que entende o PORQUÊ da norma.`;
          case "COMPLETAR_DISPOSITIVO":
            return `Questão ${num}: COMPLETAR LACUNA — Apresente um trecho PARAFRASEADO da lei com uma lacuna e peça para completar. Ex: "A promoção por merecimento exige, entre outros requisitos, ________." As alternativas completam a frase com diferentes termos; apenas uma corresponde ao texto legal. NÃO transcreva o artigo literalmente — parafraseie.`;
        }
      })
      .join("\n\n");

    // System prompt: define the AI persona as an elite exam board
    const systemPrompt = `Você é uma BANCA EXAMINADORA JURÍDICA DE ALTÍSSIMO NÍVEL, especializada em concursos militares internos da Polícia Militar do Estado do Tocantins, especialmente no padrão exigido para o CHOA/PMTO. Sua missão é elaborar questões objetivas de múltipla escolha com cinco alternativas, sendo apenas uma correta, com rigor técnico equivalente ao de bancas difíceis como CEBRASPE, FGV e VUNESP.

Você NÃO é um assistente genérico. Você atua como elaborador jurídico, auditor normativo, professor de direito militar e validador de qualidade. Cada questão deve parecer produzida por uma banca experiente, com enunciado bem construído, distratores plausíveis, comentário didático e fundamentação diretamente comprovável no texto legal fornecido.

============================================================
1. FONTE ÚNICA, EXCLUSIVA E OBRIGATÓRIA
============================================================
A única fonte normativa autorizada é o TEXTO LEGAL OFICIAL fornecido na mensagem do usuário, extraído manualmente do banco de dados da plataforma, especificamente de discipline_legal_texts.content.

É absolutamente proibido usar, citar, pressupor, comparar ou complementar a questão com qualquer fonte externa, incluindo, mas não se limitando a: Constituição Federal, Código Penal Militar, Código de Processo Penal Militar, Estatuto, RDMETO, PDFs enviados anteriormente, anexos, editais, internet, sites oficiais, doutrina, jurisprudência, legislação conhecida pelo modelo, memória interna, conhecimento jurídico geral ou analogias normativas, salvo se esse conteúdo estiver literalmente incluído no TEXTO LEGAL OFICIAL desta chamada.

Se uma informação não estiver no TEXTO LEGAL OFICIAL, ela simplesmente NÃO EXISTE para fins desta geração. Não tente completar lacunas. Não faça analogias. Não use "conhecimento jurídico comum". Não mencione fundamentos externos para explicar a alternativa correta ou incorreta.

Antes de citar qualquer artigo, parágrafo, inciso, alínea, órgão, função, autoridade, competência, prazo, vedação, permissão ou consequência jurídica, confirme que esse elemento aparece expressamente no TEXTO LEGAL OFICIAL.

É proibido afirmar que determinado artigo não existe sem antes procurar de forma robusta no texto fornecido, considerando variações como "Art. 34.", "Art. 34", "ART. 34", "art. 34", quebras de linha, espaços duplicados e separações entre caput, parágrafos e incisos. Se o artigo constar no texto legal, use-o corretamente. Se não for possível confirmar a presença exata do artigo, não gere questão sobre esse ponto.

============================================================
3. OBJETIVO DA QUESTÃO
============================================================
Gere questões difíceis, juridicamente precisas e pedagogicamente úteis. O objetivo não é testar memorização rasa, mas avaliar se o candidato compreende o texto legal, suas exceções, seus sujeitos, suas competências, seus prazos, seus requisitos e suas consequências.

Cada questão deve conter: enunciado claro; cinco alternativas autônomas, paralelas e plausíveis; apenas uma alternativa correta; quatro distratores juridicamente verossímeis; gabarito inequívoco; comentário didático; fundamentação expressa no texto legal; matriz interna de prova jurídica demonstrando que a questão foi extraída exclusivamente do texto cadastrado.

============================================================
4. NÍVEL DE DIFICULDADE E ESTILO DE BANCA
============================================================
As questões devem ser de nível alto. Evite questões óbvias, infantis, puramente literais ou resolvíveis por eliminação grosseira. Um aluno que apenas leu rapidamente a lei não deve conseguir acertar com facilidade.

Use, quando cabível, pelo menos três das técnicas abaixo em cada questão: combinação entre caput, parágrafo, inciso e exceção; distinção entre regra geral e hipótese especial; troca sutil de autoridade competente; alteração discreta de prazo, requisito, ordem procedimental ou consequência; confusão plausível entre órgão, função, posto, graduação ou competência; situação hipotética militar realista; comparação entre conduta proibida, permitida, condicionada ou excepcional; alternativa com verdade parcial e conclusão errada; inversão entre dever, faculdade, vedação, autorização e competência; omissão de condição essencial prevista no texto legal.

Não transforme todas as questões em casos práticos. Varie os formatos entre literalidade direta, caso prático, exceção à regra, conceito legal, combinação de dispositivos, consequência jurídica, asserções e completar lacuna.

============================================================
5. REGRAS ABSOLUTAS SOBRE HIERARQUIA, ÓRGÃOS E FUNÇÕES
============================================================
Sempre respeite a estrutura hierárquica, os órgãos, as funções e as competências exatamente como constam no TEXTO LEGAL OFICIAL. Não presuma que determinado posto ou órgão tem competência apenas por lógica, costume ou conhecimento geral.

Antes de finalizar qualquer questão que envolva cargo, posto, graduação, autoridade, órgão, atribuição, promoção, punição, exclusão, licenciamento, sindicância, procedimento, autorização, nomeação, competência ou hierarquia, faça a seguinte checagem interna: identifique no texto legal quem é o sujeito competente; confirme se o cargo, posto, órgão ou função aparece no texto legal; confirme se a competência atribuída no enunciado ou alternativa corresponde exatamente ao texto legal; respeite diferenças entre Comandante-Geral, Comandante, Conselho, Diretoria, Estado-Maior, órgão de direção, órgão de apoio, órgão de execução ou estruturas equivalentes; se a lei não atribuir a competência de forma clara, não invente nem conclua por analogia.

ESTRUTURA HIERÁRQUICA DE REFERÊNCIA (PMTO — sempre confira no texto legal antes de usar): Coronel, Tenente-Coronel, Major (oficiais superiores); Capitão (intermediário); 1º e 2º Tenente (subalternos); Aspirante-a-Oficial, Cadete, Aluno-Oficial (praças especiais); Subtenente, 1º/2º/3º Sargento, Cabo, Soldado (praças). NUNCA misture nomenclatura de outras forças (Aviador, Almirante, Marechal, Brigadeiro).

A alternativa correta deve ser completamente fiel à hierarquia legal. As alternativas incorretas podem usar troca de autoridade, órgão ou competência como armadilha, desde que o comentário explique o erro com base no texto legal fornecido.

============================================================
6. CONSTRUÇÃO DO ENUNCIADO
============================================================
O enunciado deve ser preciso, natural e adequado a uma prova de concurso. Não cite número de artigo no enunciado, salvo quando o comando da questão exigir análise de dispositivo específico e isso não denunciar a resposta. Em regra, o candidato deve demonstrar compreensão da norma, não apenas localizar o artigo.

Evite começar várias questões com a mesma estrutura. Não repita excessivamente expressões como "De acordo com...", "Nos termos da lei..." ou "Assinale a alternativa correta...". Use aberturas variadas, como "No que se refere a...", "A respeito das competências relativas a...", "Em determinada unidade da PMTO...", "Considere a seguinte situação hipotética...", "Sobre o regime jurídico previsto para...", "Constitui hipótese legal de...", "É incompatível com o texto legal afirmar que...", "Diante da situação narrada, a providência juridicamente adequada é...".

Quando criar situação hipotética, ela deve ser realista e compatível com o ambiente militar estadual. Use personagens fictícios, mas sem exageros narrativos. O caso deve conter elementos juridicamente relevantes e alguns elementos acessórios plausíveis, sem entregar a resposta.

============================================================
7. CONSTRUÇÃO DAS ALTERNATIVAS
============================================================
Cada questão deve ter exatamente cinco alternativas, identificadas internamente como A, B, C, D e E, mas o texto das alternativas não deve começar com "A)", "B)", "Alt A", "Alternativa A" ou qualquer prefixo semelhante.

A alternativa correta deve ser uma paráfrase fiel, aplicação correta ou consequência juridicamente necessária do texto legal. Ela não precisa copiar literalmente a lei, mas deve ter suporte direto e demonstrável no TEXTO LEGAL OFICIAL.

As quatro alternativas incorretas devem ser distratores fortes. Cada distrator deve conter algum elemento de verdade parcial, mas apresentar um erro jurídico específico. Não use alternativas absurdas, evidentemente falsas, desconectadas do tema ou fáceis de eliminar.

Os distratores devem variar o tipo de erro. Em uma mesma questão, não repita quatro vezes a mesma técnica. Use combinações como troca de autoridade competente, troca de órgão ou função, inversão entre regra e exceção, alteração de prazo, omissão de requisito cumulativo, inclusão de hipótese não prevista, generalização de uma exceção, aplicação de regra a sujeito diferente, troca entre "poderá", "deverá", "é vedado", "é permitido", "depende de", e confusão entre consequência administrativa, disciplinar, funcional ou procedimental.

É proibido usar "todas as alternativas anteriores", "nenhuma das alternativas anteriores" ou alternativas equivalentes. Também é proibido criar alternativa correta muito mais longa, técnica ou completa que as demais.

============================================================
8. CONTROLE CONTRA "ALTERNATIVA CERTA ÓBVIA"
============================================================
Antes de finalizar cada questão, compare o tamanho e o estilo das cinco alternativas. A alternativa correta não pode ser a mais longa nem a mais curta. As alternativas devem ter extensão semelhante, com diferença preferencial máxima de 20% a 30% entre a mais curta e a mais longa.

Se a correta estiver mais detalhada, mais técnica, mais bonita ou mais completa que as demais, reescreva tudo. Um candidato não pode acertar olhando apenas para o tamanho, a sofisticação ou a redação da alternativa.

As cinco alternativas devem ter estrutura gramatical paralela. Se a correta começa com verbo no infinitivo, as demais também devem seguir padrão parecido. Se a correta descreve uma hipótese, as demais também devem descrever hipóteses comparáveis. Se a correta menciona autoridade, prazo e consequência, os distratores também devem mencionar elementos equivalentes.

============================================================
9. CONTROLE CONTRA MÚLTIPLAS CORRETAS E AMBIGUIDADE
============================================================
A questão só é válida se exatamente uma alternativa for correta. Antes de finalizar, avalie cada alternativa separadamente contra o TEXTO LEGAL OFICIAL.

Para cada alternativa, pergunte internamente: esta alternativa está integralmente amparada no texto legal? Ela é correta em algum cenário previsto pela lei? Ela poderia ser defendida como correta por outro dispositivo do mesmo texto legal? Ela se torna correta se interpretada de forma literal, sistemática ou excepcional? O comentário consegue apontar claramente por que ela está errada?

Se duas ou mais alternativas puderem ser consideradas corretas, a questão deve ser refeita. Se uma alternativa incorreta tiver suporte legal igual ou maior que a alternativa marcada como correta, a questão deve ser refeita. Se a diferença entre correta e incorreta depender de interpretação subjetiva não comprovável no texto legal, a questão deve ser refeita.

Cada distrator deve conter um erro objetivo, localizável e explicável. O erro deve ser verificável no texto legal, não na opinião do modelo.

============================================================
10. CONTROLE DE ARTIGOS E CITAÇÕES
============================================================
É proibido citar artigo inexistente no TEXTO LEGAL OFICIAL. É proibido citar artigo certo com conteúdo errado. É proibido citar conteúdo certo atribuindo-o a artigo errado.

Antes de citar "Art. X", confirme que o Art. X aparece no texto legal oficial; o trecho citado realmente pertence ao Art. X; o caput, parágrafo, inciso ou alínea usados estão associados ao artigo correto; a explicação do comentário não mistura conteúdo de outro artigo; se houver referência cruzada, todos os dispositivos citados existem no texto fornecido.

Não diga que um artigo não está no texto se ele estiver presente com variações de formatação. Busque com tolerância a maiúsculas/minúsculas, quebras de linha, múltiplos espaços e pontuação.

Se a questão exigir fundamento em artigo que não consta no TEXTO LEGAL OFICIAL, abandone esse ângulo e escolha outro dispositivo existente. Nunca complete com Constituição, doutrina, jurisprudência ou conhecimento geral.

============================================================
11. EVITAR REPETIÇÃO E QUESTÕES DUPLICADAS
============================================================
Não repita enunciados, temas, pegadinhas, estruturas ou assinaturas semânticas já existentes. Use o resumo de questões anteriores para evitar duplicidade.

Uma questão é considerada repetida quando possui mesmo artigo principal, mesmo sujeito jurídico, mesma pegadinha, mesmo tipo de erro nos distratores, enunciado com estrutura muito parecida ou alternativa correta semanticamente equivalente a questão anterior.

Se o artigo já foi muito explorado, procure outro ângulo: parágrafo, inciso, exceção, consequência, competência, sujeito passivo, requisito cumulativo, hipótese negativa ou interação com artigo próximo. Se não houver ângulo novo suficiente, não force repetição.

============================================================
12. COMENTÁRIO DIDÁTICO OBRIGATÓRIO
============================================================
O comentário deve soar como um professor explicando a questão ao aluno. Ele deve ser claro, didático, direto e juridicamente preciso. Máximo de 1500 caracteres. Proibida formatação robótica ("a) IDENTIFICAÇÃO:") e cópia de blocos enormes da lei.

O comentário deve seguir obrigatoriamente quatro movimentos:
1. Comece com: "A alternativa correta é a [letra], pois..." e explique o fundamento, citando trecho curto e literal do texto legal.
2. Em seguida, escreva: "A pegadinha desta questão está em..." e identifique a técnica usada, como troca de autoridade, inversão de regra, omissão de requisito, alteração de prazo ou generalização indevida.
3. Analise cada alternativa incorreta individualmente. Use o padrão: "A alternativa [letra] está incorreta porque...". Não escreva "as demais estão erradas".
4. Termine com: "Lembre-se: segundo o [artigo/parágrafo/inciso da lei informada], ..." e apresente uma frase curta de fixação.

O comentário não deve citar fontes externas. Não mencione Constituição Federal, jurisprudência, doutrina ou outros diplomas se eles não estiverem no TEXTO LEGAL OFICIAL. Não copie blocos enormes da lei; use citação curta e suficiente.

============================================================
13. MATRIZ INTERNA DE PROVA JURÍDICA
============================================================
Para cada questão, construa internamente uma matriz de validação que demonstre por que a correta é correta e por que cada distrator é incorreto: artigo principal; dispositivos auxiliares, se houver; trecho literal curto que sustenta a alternativa correta; razão de erro de cada alternativa incorreta; tipo de pegadinha usada em cada distrator; confirmação de que nenhuma fonte externa foi usada; confirmação de que todos os artigos citados existem no texto legal fornecido; confirmação de que há exatamente uma alternativa correta; confirmação de que a alternativa correta não é a mais longa nem a mais curta.

Se qualquer item da matriz falhar, reescreva a questão antes de responder.

============================================================
5b. REGRA PARA LEIS EXTERNAS (CITAÇÃO CRUZADA)
============================================================
A lei principal desta questão é "${disc.leiNome}". Só cite outro diploma se ele estiver LITERALMENTE incluído no TEXTO LEGAL OFICIAL. Nesse caso, mencione o diploma POR EXTENSO no enunciado/alternativa/comentário e nunca cite apenas "Art. X" sem qualificar quando o artigo não pertence à lei principal.

============================================================
16. CHECKLIST FINAL ANTES DE RESPONDER
============================================================
Antes de devolver o JSON, revise silenciosamente cada questão. Somente entregue a questão se todas as respostas abaixo forem "sim": todo conteúdo saiu exclusivamente do TEXTO LEGAL OFICIAL; nenhuma fonte externa foi usada, nem por analogia; nenhum artigo inexistente foi citado; o artigo citado contém o conteúdo atribuído a ele; há exatamente cinco alternativas; há exatamente uma alternativa correta; as quatro incorretas são plausíveis e têm erro objetivo; nenhuma alternativa incorreta pode ser defendida como correta por outro trecho do texto legal; a correta não é a alternativa mais longa nem a mais curta; as alternativas têm tamanho, estrutura e densidade técnica semelhantes; o enunciado não entrega a resposta; a hierarquia, os órgãos, as funções e as competências foram respeitados; o comentário explica individualmente todas as alternativas; o comentário cita apenas dispositivo existente no texto fornecido; a questão não repete assinatura semântica de questão já existente; a questão tem dificuldade real de banca de alto nível.

Se qualquer resposta for "não", reescreva a questão antes de responder.

Responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown e sem texto fora do JSON, no formato {"questions":[...]}. Configure sua "temperatura interna" para o MÍNIMO — auditoria objetiva baseada APENAS nos fatos do texto legal, sem criatividade indesejada.`;

    // Build the full legal context — send up to 18KB of law text for systemic understanding
    const legalContextBudget = batchSize === 1 ? 14000 : 11000;
    const legalContextTruncated = truncateLegalText(leiSeca, legalContextBudget);

    const prompt = `============================================================
2. DADOS DA GERAÇÃO
============================================================
Disciplina: ${disc.disciplina}
Diploma legal principal: ${disc.leiNome}
Quantidade exata de questões a gerar: ${batchSize}
Artigos disponíveis no texto legal: ${availableArticles}
Artigos-alvo prioritários: ${targetArticleNumbers.map(a => `Art. ${a}`).join(", ")}
Assuntos menos explorados: ${leastCoveredAssuntos}
Distribuição desejada de gabaritos no lote: varie entre A(0), B(1), C(2), D(3) e E(4) — não concentre na mesma letra.

ARTIGOS-ALVO PRIORITÁRIOS (use como base principal de cada questão, mas pode referenciar outros artigos da mesma lei quando necessário para contexto):
${selectedTargets.map(({ block }, idx) => `${idx + 1}) Questão ${idx + 1}: base no Art. ${block.artNum}`).join("\n")}

TEXTO LEGAL OFICIAL — FONTE ÚNICA (artigos-alvo com contexto):
${targetArticlesBlock}

TEXTO LEGAL OFICIAL — COMPLETO PARA CONSULTA (coerência sistêmica; mesma fonte única, nada externo):
${legalContextTruncated}
${coverageGuidanceBlock}
${openingsAvoidBlock}

ASSUNTOS MENOS EXPLORADOS (priorize): ${leastCoveredAssuntos}

ABORDAGEM OBRIGATÓRIA POR QUESTÃO:
${approachInstructions}

MÉTODO DE CRIAÇÃO:
1) Cada questão DEVE ter como BASE PRINCIPAL o artigo-alvo, mas PODE e DEVE referenciar outros artigos quando a situação exigir interpretação conjunta.
2) Explore DIFERENTES ASPECTOS do artigo: caput, incisos, parágrafos, exceções, condições, prazos, competências, sujeitos.
3) VARIE o formato entre: perguntas diretas sobre a lei ("Assinale a correta sobre..."), cenários fictícios aplicados, completar lacunas, identificar exceções, e asserções verdadeiro/falso. NÃO faça todas as questões no mesmo formato.
4) NEM TODA QUESTÃO PRECISA DE CENÁRIO FICTÍCIO. Questões diretas sobre o texto legal ("São requisitos para...", "Constitui hipótese de...", "É correto afirmar que...") são igualmente válidas e desejadas.
4) Crie 5 alternativas (A-E) sem prefixo de letra:
   - A CORRETA reflete LITERALMENTE o que a lei dispõe — deve ser possível encontrar o trecho exato no artigo citado.
   - As INCORRETAS devem conter ERROS CLAROS E VERIFICÁVEIS contra o texto da lei. Cada alternativa incorreta deve contradizer explicitamente um dispositivo legal específico:
     * TROQUE um elemento concreto: prazo (30→60 dias), autoridade (Comandante-Geral→Chefe do EMG), condição (cumulativa→alternativa), verbo (deverá→poderá, vedado→facultado).
     * A incorreção deve ser DETECTÁVEL por quem lê o artigo — não basta ser "plausível", deve ser DEMONSTRAVELMENTE FALSA.
     * NUNCA crie alternativa incorreta que reproduza FIELMENTE outro dispositivo da mesma lei — isso gera ambiguidade.
   - CADA alternativa incorreta deve ter um erro DIFERENTE e referir-se a um aspecto DIFERENTE.
   - TESTE MENTAL: para cada alternativa incorreta, pergunte-se "consigo apontar QUAL trecho da lei ela contradiz?" Se não, reescreva.
5) DISTRIBUA o gabarito: não concentre todas as respostas na mesma letra.
6) O COMENTÁRIO segue a estrutura obrigatória definida no sistema.

PROIBIÇÕES ABSOLUTAS NO ENUNCIADO:
- "O que diz o Art. X?", "Qual artigo trata de...", "Segundo o Art. X, ...", "De acordo com o Art. X, ..."
- Qualquer menção direta ao número de artigo no enunciado.

PROIBIÇÕES ABSOLUTAS NAS ALTERNATIVAS:
- NUNCA crie alternativas que sejam apenas números de artigos ou de leis (ex: "Art. 15", "Lei nº 2.578/2012").
- Cada alternativa DEVE conter uma AFIRMAÇÃO SUBSTANTIVA sobre o conteúdo da lei, NUNCA uma mera referência numérica.
- Alternativas como "Art. 10", "Art. 15 da Lei 2.578", "Lei Complementar 128" são PROIBIDAS — o candidato deve demonstrar COMPREENSÃO do conteúdo, não memorização de números.

DIVERSIDADE OBRIGATÓRIA:
- Cada questão do lote DEVE abordar um ASPECTO DIFERENTE da lei. NÃO repita o mesmo tema, situação ou estrutura.
- VARIE o tipo de raciocínio exigido: análise de caso, identificação de exceção, definição legal, combinação de dispositivos.
- NÃO crie questões que apenas reformulem o mesmo cenário com palavras diferentes — cada questão deve testar um CONHECIMENTO DISTINTO.

REGRAS TÉCNICAS:
- Artigos existentes na lei: ${availableArticles}
- Cite SOMENTE artigos que existam na lei acima.
- gabarito = inteiro: 0=A, 1=B, 2=C, 3=D, 4=E.
- Distribua dificuldade: ~5% Fácil, ~30% Médio, ~65% Difícil. O LOTE DEVE ser dominado por questões Difíceis de nível banca elite. Questões Fáceis só são aceitáveis se ainda exigirem leitura atenta de inciso/parágrafo (nada óbvio).

ANTI-DUPLICAÇÃO (REGRA CRÍTICA — leia ANTES de gerar):
- Os enunciados, aberturas e cenários listados acima ("ASSUNTOS MENOS EXPLORADOS", coverage e openings a evitar) representam o que JÁ EXISTE no banco. É TERMINANTEMENTE PROIBIDO produzir questão cujo enunciado, cenário ou estrutura repita o que já está coberto.
- Cada questão do lote deve abordar um ARTIGO/INCISO/PARÁGRAFO DIFERENTE entre si E diferente do que já foi explorado no banco.
- Antes de finalizar cada questão, faça o teste: "se eu resumir essa questão em uma frase de 10 palavras, ela coincide com alguma das aberturas/assuntos listados como já cobertos?" — se sim, MUDE de ângulo (outro inciso, outra exceção, outra autoridade competente, outro prazo, outro requisito).
- Varie radicalmente o verbo de comando, a estrutura do cenário e o foco do dispositivo entre as questões do mesmo lote.

FIDELIDADE EXCLUSIVA AO TEXTO LEGAL DO BANCO (REFORÇO):
- O TEXTO LEGAL DE REFERÊNCIA e o TEXTO LEGAL COMPLETO PARA CONSULTA acima são a ÚNICA base válida. Não use conhecimento externo, jurisprudência, doutrina ou interpretações que não estejam no texto fornecido.
- Toda alternativa correta deve ter um trecho LITERAL rastreável no texto fornecido. Toda alternativa incorreta deve contradizer um trecho LITERAL identificável no texto fornecido.
- Assuntos possíveis: ${disc.assuntos.join(", ")}

OBJETO JSON OBRIGATÓRIO (sem markdown e sem qualquer texto fora do objeto):
{"questions":[{"disciplina":"${disc.disciplina}","assunto":"...","dificuldade":"Fácil|Médio|Difícil","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"..."}]}`;

    // API call with retry logic
    // Lovable AI Gateway with google/gemini-2.5-flash is dramatically faster
    // than DeepSeek (typically 8-25s vs 50-90s for the same prompt).
    const MAX_API_RETRIES = 2;
    const PRIMARY_TIMEOUT_MS = useLovable ? (batchSize === 1 ? 35000 : 50000) : (batchSize === 1 ? 50000 : 58000);
    const RETRY_TIMEOUT_MS = useLovable ? (batchSize === 1 ? 30000 : 42000) : (batchSize === 1 ? 42000 : 50000);
    let aiStatus: number | null = null;
    let aiResponseText = "";
    let lastFetchError: any = null;

    // Output token budget — Gemini Flash handles slightly larger budgets faster
    const maxTokens = batchSize === 1 ? 1800 : 3000;

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

    let currentProvider: "deepseek" | "maritaca" | "lovable" =
      useDeepSeekPrimary ? "deepseek" : useMaritaca ? "maritaca" : "lovable";
    let apiUrl =
      currentProvider === "deepseek" ? "https://api.deepseek.com/v1/chat/completions"
      : currentProvider === "maritaca" ? "https://chat.maritaca.ai/api/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiModel =
      currentProvider === "deepseek" ? "deepseek-reasoner"
      : currentProvider === "maritaca" ? "sabia-4"
      : "google/gemini-2.5-flash";
    let apiKey =
      currentProvider === "deepseek" ? DEEPSEEK_API_KEY!
      : currentProvider === "maritaca" ? MARITACA_API_KEY!
      : LOVABLE_API_KEY!;
    let providerSwitched = false;

    console.log(`[GERAR] Provider: ${currentProvider} (${apiModel}), batch=${batchSize}, maxTokens=${maxTokens}`);

    const looksLikeNoCredits = (status: number, body: string) => {
      if (status === 402) return true;
      const b = (body || "").toLowerCase();
      return /insufficient|no credits|saldo|sem cr[eé]dito|quota|billing|exhaust|insufficient_quota/.test(b);
    };

    // Fallback chain: deepseek → maritaca → lovable (skip steps without key)
    const switchToFallback = (): boolean => {
      if (currentProvider === "deepseek" && MARITACA_API_KEY) {
        currentProvider = "maritaca";
        apiUrl = "https://chat.maritaca.ai/api/chat/completions";
        apiModel = "sabia-4";
        apiKey = MARITACA_API_KEY;
        providerSwitched = true;
        console.log(`[GERAR] DeepSeek indisponível. Fallback: Maritaca (sabia-4)`);
        return true;
      }
      if ((currentProvider === "deepseek" || currentProvider === "maritaca") && LOVABLE_API_KEY) {
        currentProvider = "lovable";
        apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        apiModel = "google/gemini-2.5-flash";
        apiKey = LOVABLE_API_KEY;
        providerSwitched = true;
        console.log(`[GERAR] Fallback: Lovable AI (gemini-2.5-flash)`);
        return true;
      }
      if (currentProvider === "maritaca" && DEEPSEEK_API_KEY) {
        currentProvider = "deepseek";
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        apiModel = "deepseek-reasoner";
        apiKey = DEEPSEEK_API_KEY;
        providerSwitched = true;
        console.log(`[GERAR] Maritaca sem créditos. Fallback: DeepSeek Reasoner`);
        return true;
      }
      return false;
    };

    for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
      const controller = new AbortController();
      const perAttemptTimeout = attempt === 0 ? PRIMARY_TIMEOUT_MS : RETRY_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), perAttemptTimeout);

      try {
        const isReasoner = apiModel === "deepseek-reasoner";
        const requestBody: Record<string, unknown> = {
          model: apiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          // Reasoner usa orçamento maior por gerar cadeia de raciocínio.
          max_tokens: isReasoner ? Math.max(maxTokens, 4096) : maxTokens,
          stream: false,
        };
        // deepseek-reasoner NÃO aceita temperature/top_p/response_format. Demais providers aceitam.
        if (!isReasoner) {
          requestBody.temperature = 0.25;
          if (currentProvider !== "maritaca") requestBody.response_format = { type: "json_object" };
          if (currentProvider === "maritaca") requestBody.top_p = 0.92;
        }

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        aiStatus = response.status;
        console.log(`[GERAR] AI status: ${aiStatus}, attempt ${attempt + 1}, provider=${currentProvider}/${apiModel}`);
        aiResponseText = await response.text();

        // Provider sem créditos → tenta próximo fallback
        if (!providerSwitched && looksLikeNoCredits(aiStatus, aiResponseText)) {
          if (switchToFallback()) {
            aiResponseText = "";
            aiStatus = 0;
            continue;
          }
        }

        if (aiStatus === 429 && attempt < MAX_API_RETRIES - 1) {
          const retryDelay = 2500;
          console.log(`[GERAR] Rate limit 429, retry em ${retryDelay}ms`);
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }

        if (aiStatus && aiStatus >= 500 && attempt < MAX_API_RETRIES - 1) {
          const retryDelay = 2000;
          console.log(`[GERAR] Server error ${aiStatus}, retry em ${retryDelay}ms`);
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }

        break;
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        lastFetchError = fetchErr;
        const isTimeout = fetchErr.name === "AbortError";

        if (attempt < MAX_API_RETRIES - 1) {
          const retryDelay = isTimeout ? 0 : 1500;
          console.log(`[GERAR] ${isTimeout ? "Timeout" : "Fetch error"}, retry em ${retryDelay}ms: ${String(fetchErr)}`);
          if (retryDelay > 0) await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }
      }
    }

    if (!aiResponseText) {
      const isTimeout = lastFetchError?.name === "AbortError";
      console.error(`[GERAR] Todas as tentativas falharam:`, String(lastFetchError));
      return new Response(JSON.stringify({
        status: "erro", mensagem: isTimeout ? "A IA demorou demais para responder." : `Erro de conexão: ${lastFetchError?.message}`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: isTimeout ? "TIMEOUT" : "FETCH_ERROR", descricao: String(lastFetchError) }] },
        error: String(lastFetchError), timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (aiStatus === 429) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Rate limit da IA.", paused: true,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "RATE_LIMIT", descricao: "Aguarde 1 minuto" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (aiStatus === 402 || (aiStatus >= 400 && looksLikeNoCredits(aiStatus, aiResponseText))) {
      let creditMessage = currentProvider === "maritaca"
        ? "Créditos insuficientes na Maritaca (e fallback DeepSeek indisponível). Configure DEEPSEEK_API_KEY."
        : currentProvider === "deepseek"
        ? "Créditos insuficientes no DeepSeek (fallback da Maritaca)."
        : "Créditos insuficientes no Lovable AI. Adicione créditos em Settings → Workspace.";
      try {
        const parsed = JSON.parse(aiResponseText);
        creditMessage = parsed?.error?.message || creditMessage;
      } catch { /* ignore */ }
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Provedor de IA sem saldo/limite disponível.", paused: true,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "AI_402", descricao: creditMessage }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    if (!aiStatus || aiStatus < 200 || aiStatus >= 300) {
      console.error(`[GERAR] AI error: ${aiStatus} ${aiResponseText.substring(0, 300)}`);
      return new Response(JSON.stringify({
        status: "erro", mensagem: `Erro da IA (${aiStatus ?? "desconhecido"})`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "API_ERROR", descricao: aiResponseText.substring(0, 200) }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let aiData: any;
    try {
      aiData = JSON.parse(aiResponseText);
    } catch {
      console.error("[GERAR] JSON externo inválido:", aiResponseText.substring(0, 200));
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Resposta inválida do DeepSeek.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "DEEPSEEK_INVALID_JSON", descricao: "JSON externo inválido" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const finishReason = aiData.choices?.[0]?.finish_reason || "unknown";
    console.log(`[GERAR] Finish reason: ${finishReason}`);

    const content = aiData.choices?.[0]?.message?.content || '{"questions":[]}';

    let rawQuestions: any[];
    try {
      const parsed = parseQuestionsFromModelContent(content);
      rawQuestions = parsed.questions;
      if (parsed.salvaged) {
        console.log(`[GERAR] JSON parcial recuperado: ${rawQuestions.length} questão(ões) válidas extraídas`);
      }
    } catch {
      console.error("[GERAR] JSON parse failed:", content.substring(0, 200));
      return new Response(JSON.stringify({
        status: "erro", mensagem: "IA retornou JSON inválido.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_JSON", descricao: `JSON inválido (finish_reason=${finishReason})` }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!Array.isArray(rawQuestions)) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "IA retornou estrutura inválida.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_ARRAY", descricao: "Era esperado um JSON array" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validQuestions = [];
    let discarded = 0;
    const batchFingerprints = new Set<string>();
    const batchSemanticFPs = new Set<string>();
    const batchForSimilarity: Array<{ id: number; enunciado: string }> = [];

    for (let idx = 0; idx < rawQuestions.length; idx++) {
      const raw = rawQuestions[idx];
      const q: Record<string, any> = {
        disciplina: disc.disciplina,
        assunto: normalizeWhitespace(raw.assunto),
        dificuldade: normalizeWhitespace(raw.dificuldade) || "Médio",
        enunciado: normalizeWhitespace(raw.enunciado),
        comentario: normalizeWhitespace(raw.comentario),
        gabarito: Math.min(Math.max(Number(raw.gabarito) || 0, 0), 4),
      };

      for (const k of ALT_KEYS) q[k] = stripAlternativePrefix(raw[k]);

      // ── Structural validation ──
      const alts = ALT_KEYS.map(k => q[k] as string);
      if (!q.enunciado || q.enunciado.length < 25) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: enunciado curto`); continue;
      }
      if (alts.some(a => !a || a.length < 2)) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: alternativa vazia`); continue;
      }
      if (hasDuplicateAlts(alts)) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: alternativas duplicadas`); continue;
      }

      // ── Paridade de comprimento das alternativas (anti-padrão "correta = mais longa") ──
      const gabIdx = Number(q.gabarito);
      if (Number.isInteger(gabIdx) && gabIdx >= 0 && gabIdx <= 4) {
        const lens = alts.map(a => (a || "").trim().length);
        const minLen = Math.min(...lens);
        const maxLen = Math.max(...lens);
        const correctLen = lens[gabIdx];
        const otherLens = lens.filter((_, i) => i !== gabIdx);
        const otherAvg = otherLens.reduce((s, n) => s + n, 0) / Math.max(1, otherLens.length);
        const spreadRatio = minLen > 0 ? (maxLen - minLen) / minLen : 99;
        const correctIsLongest = correctLen === maxLen && correctLen > minLen;
        const correctIsShortest = correctLen === minLen && correctLen < maxLen;
        const correctTooLong = correctLen > otherAvg * 1.35;
        const correctTooShort = correctLen < otherAvg * 0.65;
        if (spreadRatio > 0.45 || (correctIsLongest && correctTooLong) || (correctIsShortest && correctTooShort)) {
          discarded++;
          console.log(`[GERAR] Q${idx+1} descartada: paridade de comprimento (lens=${lens.join(",")}, gab=${gabIdx}, spread=${spreadRatio.toFixed(2)})`);
          continue;
        }
      }


      // ── Anti-decoreba ──
      const decoreba = /\b(o\s+que\s+(diz|dispõe|estabelece|prevê)\s+o\s+art|qual\s+(o\s+)?artigo|segundo\s+o\s+art[\.\s]*\d|de\s+acordo\s+com\s+o\s+art[\.\s]*\d|conforme\s+o\s+art[\.\s]*\d|nos\s+termos\s+do\s+art[\.\s]*\d)/i;
      if (decoreba.test(q.enunciado.toLowerCase())) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: decoreba`); continue;
      }

      // ── Anti-citação-seca nas alternativas ──
      // Rejeita questões onde alternativas são apenas "Art. X", "Art. X da Lei Y", números de lei secos
      const dryAltPattern = /^\s*(art\.?\s*\d+[a-z]?(\s*(,|e)\s*art\.?\s*\d+[a-z]?)*\s*(d[aoe]\s+lei.*|d[aoe]\s+decreto.*|d[aoe]\s+lc.*)?\.?\s*|lei\s*(n[°º]?\s*)?\d[\d\.\/]*\s*\.?\s*|decreto\s*(n[°º]?\s*)?\d[\d\.\/]*\s*\.?\s*|lc\s*(n[°º]?\s*)?\d[\d\.\/]*\s*\.?\s*)$/i;
      const dryAltCount = alts.filter(a => dryAltPattern.test(a)).length;
      if (dryAltCount >= 2) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: ${dryAltCount} alternativas são apenas citação seca de artigo/lei`); continue;
      }
      // Also reject if ANY alt is just a bare article number with no substance
      const bareArtPattern = /^\s*art\.?\s*\d+[a-z]?\s*\.?\s*$/i;
      if (alts.some(a => bareArtPattern.test(a))) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: alternativa é apenas número de artigo`); continue;
      }

      // ── Fingerprint dedup (80 normalized chars, no spaces) ──
      const fp = buildFingerprint(q.enunciado);
      if (existingFingerprints.has(fp) || batchFingerprints.has(fp)) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: duplicata textual`); continue;
      }
      batchFingerprints.add(fp);

      // ── Semantic dedup ──
      const correctAltKey = ALT_KEYS[q.gabarito];
      const correctAltText = q[correctAltKey] as string;
      const semFP = buildSemanticFingerprint(q.comentario, correctAltText);
      if (existingSemanticFPs.has(semFP) || batchSemanticFPs.has(semFP)) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: duplicata semântica`); continue;
      }
      batchSemanticFPs.add(semFP);

      // ── Similarity dedup (Jaccard de enunciado): limiar 0.65 evita falsos positivos em leis curtas ──
      const similarId = findSimilarQuestion(q.enunciado, existingForSimilarity, 0.55);
      if (similarId) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: similar à #${similarId}`); continue;
      }
      const batchSimilarId = findSimilarQuestion(q.enunciado, batchForSimilarity, 0.55);
      if (batchSimilarId !== null) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: similar a outra no lote`); continue;
      }
      batchForSimilarity.push({ id: idx, enunciado: q.enunciado });

      // ── Citation validation ──
      const literalArticle = findArticleForText(correctAltText, blocks);
      const evidenceArticle = detectCommentEvidenceArticle(q.comentario, blocks);
      const resolvedArticle = evidenceArticle || literalArticle;
      const citationCheck = validateAllCitations(q.comentario, blocks);

      if (!citationCheck.valid) {
        if (resolvedArticle) {
          q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
          const recheck = validateAllCitations(q.comentario, blocks);
          if (!recheck.valid) {
            discarded++;
            questoesRevisaoManual.push({ motivo: `Artigos inexistentes: ${recheck.missing.join(", ")}` });
            console.log(`[GERAR] Q${idx+1} descartada: artigos inexistentes após correção`);
            continue;
          }
          console.log(`[GERAR] Q${idx+1} AUTO-FIX: artigo corrigido para ${resolvedArticle}`);
        } else {
          discarded++;
          questoesRevisaoManual.push({ motivo: `Artigos inexistentes: ${citationCheck.missing.join(", ")}` });
          console.log(`[GERAR] Q${idx+1} descartada: ${citationCheck.missing.join(", ")}`);
          continue;
        }
      }

      // ── Ensure at least one citation ──
      const citedArts = extractAllCitedArticles(q.comentario);
      if (citedArts.length === 0 && resolvedArticle) {
        q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
      }

      const finalCitedArts = extractAllCitedArticles(q.comentario);
      if (finalCitedArts.length === 0) {
        discarded++;
        questoesRevisaoManual.push({ motivo: "Comentário sem citação de artigo" });
        console.log(`[GERAR] Q${idx+1} descartada: sem artigo no comentário`);
        continue;
      }

      // ── Snippet-article verification — discard instead of keeping ──
      const snippetCheck = verifySnippetBelongsToArticle(q.comentario, blocks);
      if (!snippetCheck.valid) {
        const { corrected: snippetFixed, appliedCorrections: snippetCorrs } = applyAllSnippetCorrections(q.comentario, blocks);
        if (snippetCorrs.length > 0) {
          const reCheck = validateAllCitations(snippetFixed, blocks);
          if (reCheck.valid) {
            q.comentario = snippetFixed;
            console.log(`[GERAR] Q${idx+1} AUTO-FIX snippet: ${snippetCorrs.map(c => `${c.from}→${c.to}`).join(", ")}`);
          } else {
            discarded++;
            questoesRevisaoManual.push({ motivo: `Snippet-artigo mismatch não resolvido` });
            console.log(`[GERAR] Q${idx+1} descartada: snippet-artigo mismatch irrecuperável`);
            continue;
          }
        } else {
          discarded++;
          questoesRevisaoManual.push({ motivo: `Snippet-artigo mismatch: ${snippetCheck.mismatches[0]}` });
          console.log(`[GERAR] Q${idx+1} descartada: ${snippetCheck.mismatches[0]}`);
          continue;
        }
      }

      // ── Validação ANTI-ALUCINAÇÃO em TODOS os campos (enunciado + alternativas + comentário) ──
      // Citações com marcador externo ("da Lei X", "do CPP" etc.) são permitidas;
      // apenas citações INTERNAS ("Art. N" sem qualificador) precisam existir em `blocks`.
      const allFieldsCheck = validateCitationsInAllFields(q, blocks);
      if (!allFieldsCheck.valid) {
        discarded++;
        const detalhe = allFieldsCheck.missing.map(m => `${m.field}: ${m.arts.join(", ")}`).join(" | ");
        questoesRevisaoManual.push({ motivo: `Citação de artigo inexistente na lei alvo (${detalhe})` });
        console.log(`[GERAR] Q${idx+1} descartada: artigos inexistentes em campos — ${detalhe}`);
        continue;
      }

      // ── Cross-validation ──
      const crossCheck = crossValidateReferences(q.enunciado, q.comentario);
      if (!crossCheck.valid) {
        discarded++;
        questoesRevisaoManual.push({ motivo: crossCheck.reason });
        console.log(`[GERAR] Q${idx+1} descartada: ${crossCheck.reason}`);
        continue;
      }

      // ── Ancoragem legal (aceita questões interpretativas) ──
      // Questões que parafraseiam ou interpretam a norma são VÁLIDAS desde que haja
      // alguma ancoragem (literal OU específica do artigo citado). Só descartamos
      // quando AMBAS as ancoragens são fracas — evita alucinação sem podar interpretação.
      const lawNorm = normalize(leiSeca);
      const literalProofScore = computeAltLiteralSupport(correctAltText, lawNorm);
      const articleSpecificScore = computeArticleSpecificProof(correctAltText, q.comentario, blocks);
      if (literalProofScore < 0.25 && articleSpecificScore < 0.15) {
        discarded++;
        questoesRevisaoManual.push({ motivo: `Ancoragem legal insuficiente (literal=${literalProofScore.toFixed(2)}, artigo=${articleSpecificScore.toFixed(2)})` });
        console.log(`[GERAR] Q${idx+1} descartada: sem ancoragem (literal ${literalProofScore.toFixed(2)} / artigo ${articleSpecificScore.toFixed(2)})`);
        continue;
      }

      // ── Article confrontation: verify comment cites the article where the correct alt text is actually found ──
      const commentCitedArticles = extractAllCitedArticles(q.comentario);
      if (literalArticle && commentCitedArticles.length > 0) {
        const literalArtNum = literalArticle.match(/\d+/)?.[0];
        if (literalArtNum && !commentCitedArticles.includes(literalArtNum)) {
          q.comentario = reconcileCommentArticle(q.comentario, literalArticle);
          const fixedCited = extractAllCitedArticles(q.comentario);
          if (!fixedCited.includes(literalArtNum)) {
            discarded++;
            questoesRevisaoManual.push({ motivo: `CONFRONTO DE ARTIGOS: comentário cita Art. ${commentCitedArticles[0]} mas alternativa correta encontrada no ${literalArticle}` });
            console.log(`[GERAR] Q${idx+1} descartada: confronto de artigos (comentário Art. ${commentCitedArticles[0]} vs literal ${literalArticle})`);
            continue;
          }
          console.log(`[GERAR] Q${idx+1} AUTO-FIX confronto: artigo corrigido para ${literalArticle}`);
        }
      }

      // ── Ambiguity detection: reject if incorrect alts have high literal support ──
      const ambiguityCheck = detectAmbiguity(q, blocks, lawNorm);
      if (ambiguityCheck.ambiguous) {
        discarded++;
        questoesRevisaoManual.push({ motivo: ambiguityCheck.details });
        console.log(`[GERAR] Q${idx+1} descartada: ambiguidade — ${ambiguityCheck.details}`);
        continue;
      }

      // ── Repetitive/looping comment detection ──
      const artMentionsGen = (q.comentario || "").match(/Art\.?\s*\d+[A-Z]?/gi) || [];
      if (artMentionsGen.length >= 6) {
        const freqGen = new Map<string, number>();
        for (const m of artMentionsGen) {
          const key = normalize(m);
          freqGen.set(key, (freqGen.get(key) || 0) + 1);
        }
        const maxFreqGen = Math.max(...freqGen.values());
        if (maxFreqGen >= 5) {
          discarded++;
          questoesRevisaoManual.push({ motivo: `Comentário com texto repetitivo/loop (Art. citado ${maxFreqGen}x)` });
          console.log(`[GERAR] Q${idx+1} descartada: comentário repetitivo`);
          continue;
        }
      }

      // ── Final reconciliation ──
      if (resolvedArticle) {
        const resolvedNum = resolvedArticle.match(/\d+/)?.[0];
        const commentCitedArts = extractAllCitedArticles(q.comentario);
        if (resolvedNum && commentCitedArts.length > 0 && !commentCitedArts.includes(resolvedNum)) {
          q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
        }
      }

      // ── Bloco 1: Dedup semântica forte (DeepSeek signature + Jaccard ponderada) ──
      // Constrói assinatura via IA (com fallback determinístico) e compara com questões
      // do mesmo artigo. Limiares: ≥0.80 descarta; 0.60–0.80 descarta com flag de reescrita; <0.60 aceita.
      const newSig = await buildSemanticSignature(
        { enunciado: q.enunciado, alt_correta: correctAltText, comentario: q.comentario },
        apiUrl, apiModel, apiKey,
      );
      const artigoPrincipal = newSig.artigo || extractMainArticle(q.comentario);
      const artKey = normSigToken(artigoPrincipal) || "__sem_artigo__";
      const candidates = [
        ...(existingByArticle.get(artKey) || []),
        ...(existingByArticle.get("__sem_artigo__") || []), // também compara contra os sem artigo
      ];

      let highestSim = 0;
      let highestId: number | null = null;
      for (const cand of candidates) {
        // pré-filtro barato: se assunto difere muito, comparar mesmo assim só se artigo bate exatamente
        const sim = compareSignatures(newSig, cand.signature);
        if (sim > highestSim) { highestSim = sim; highestId = cand.id; }
        if (sim >= 0.80) break; // já basta para descartar
      }

      if (highestSim >= 0.80) {
        discarded++;
        questoesRevisaoManual.push({ motivo: `Duplicidade semântica forte (sim=${highestSim.toFixed(2)}) com Q#${highestId}` });
        console.log(`[GERAR] Q${idx+1} descartada: dup semântica ${highestSim.toFixed(2)} vs #${highestId}`);
        continue;
      }
      if (highestSim >= 0.72) {
        // zona cinza alta: descarta deste lote mas marca para reescrita futura com novo enfoque
        discarded++;
        questoesRevisaoManual.push({ motivo: `Similaridade média (${highestSim.toFixed(2)}) com Q#${highestId} — reescrever com novo ângulo` });
        console.log(`[GERAR] Q${idx+1} descartada: sim média ${highestSim.toFixed(2)} vs #${highestId} (reescrever)`);
        continue;
      }

      // Persiste assinatura + artigo principal junto com a questão
      q.assinatura_semantica = newSig;
      q.artigo_principal = artigoPrincipal || null;

      // Adiciona ao índice em memória para que próximas questões DESTE lote já comparem contra esta
      if (!existingByArticle.has(artKey)) existingByArticle.set(artKey, []);
      existingByArticle.get(artKey)!.push({ id: -1 - idx, assunto: q.assunto, signature: newSig, enunciado: q.enunciado });

      const approvedArts = extractAllCitedArticles(q.comentario);
      validQuestions.push(q);
      console.log(`[GERAR] Q${idx+1} APROVADA: ${approvedArts.map(a => `Art. ${a}`).join(", ")} | sig.artigo=${newSig.artigo} sig.peg=${newSig.pegadinha} maxSim=${highestSim.toFixed(2)}`);
    }

    // ===== AUDITORIA CRUZADA PÓS-GERAÇÃO =====
    // Para cada questão aprovada na dedup, roda mini-auditoria cética em paralelo.
    // - issue high → descarta + revisão manual
    // - confidence ≥ 0.9 + risco low + patch → aplica patch e mantém
    // - caso contrário → mantém como está
    let autoCorrigidas = 0;
    try {
    if (validQuestions.length > 0) {
      console.log(`[AUDIT-XGEN] Iniciando auditoria cruzada de ${validQuestions.length} questões (sequencial p/ estabilidade)...`);

      // Snippet FOCADO nos artigos citados pela questão → impede falsos descartes "artigo inexistente".
      const buildFocusedLawSnippet = (q: any): string => {
        const allText = [q.enunciado, q.comentario, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e]
          .filter(Boolean).join("\n");
        const citedNums = new Set<string>(extractAllCitedArticles(allText));
        const pieces: string[] = [];
        for (const num of citedNums) {
          const block = blocks.find(b => b.artNum === num);
          if (block) pieces.push(block.text.slice(0, 2400));
        }
        let snippet = pieces.join("\n\n").trim();
        if (snippet.length < 1500) {
          snippet = (snippet + "\n\n" + String(leiSeca || "").slice(0, 12000)).trim();
        }
        return snippet.slice(0, 14000);
      };

      const buildAuditPrompt = (q: any) => {
        const altsTxt = ["A","B","C","D","E"].map(l => `${l}) ${q[`alt_${l.toLowerCase()}`]}`).join("\n");
        const correta = ["A","B","C","D","E"][q.gabarito] ?? "?";
        const lawSnippet = buildFocusedLawSnippet(q);
        return `Você audita questões objetivas de concurso jurídico-militar (PMTO). Seja CÉTICO mas JUSTO.

TEXTO LEGAL DE REFERÊNCIA (RECORTE focado nos artigos citados pela questão):
"""${lawSnippet}"""

QUESTÃO:
${q.enunciado}

${altsTxt}

Gabarito declarado: ${correta}
Comentário: ${q.comentario}

REGRA CRÍTICA DE AUDITORIA:
- O texto acima é apenas um RECORTE da lei completa. Se um artigo citado parecer não estar no recorte,
  NÃO conclua que ele é inexistente nem marque 'high' por isso — registre apenas issue 'low' "fora do recorte".
- Só use severidade 'high' quando houver ERRO FACTUAL DEMONSTRÁVEL dentro do recorte fornecido
  (ex.: gabarito contradiz literalmente o artigo que ESTÁ no recorte, alternativa correta inexiste etc.).

Verifique:
1. Gabarito está correto pela letra do texto legal (quando o artigo aparece no recorte)?
2. Existe outra alternativa também correta? Ou nenhuma correta?
3. Algum distrator é absurdo / óbvio / vazio?
4. Comentário cita base legal coerente com o gabarito?
5. Há afirmação claramente inventada (não apenas ausente do recorte)?

Responda APENAS JSON:
{
  "confidence": 0.0-1.0,
  "risk_level": "low" | "medium" | "high",
  "issues": [{"type":"...","severity":"low|medium|high","description":"..."}],
  "proposed_patch": null | {"gabarito"?:0-4,"comentario"?:"...","alt_a"?:"...","alt_b"?:"...","alt_c"?:"...","alt_d"?:"...","alt_e"?:"..."},
  "ai_summary": "1 frase"
}`;
      };

      const callAuditor = async (prompt: string, timeoutMs: number): Promise<any | null> => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("DEEPSEEK_API_KEY")}` },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: "Você é um auditor cético de questões. Responda apenas JSON válido." },
                { role: "user", content: prompt },
              ],
              temperature: 0.1, max_tokens: 1200,
              response_format: { type: "json_object" },
            }),
            signal: ctrl.signal,
          });
          if (!res.ok) return null;
          const data = await res.json();
          let raw = String(data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
          try { return JSON.parse(raw); } catch {
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) { try { return JSON.parse(m[0]); } catch {} }
          }
          return null;
        } catch {
          return null;
        } finally {
          clearTimeout(t);
        }
      };

      const auditOne = async (q: any, i: number) => {
        const prompt = buildAuditPrompt(q);
        // 1ª tentativa: 15s. Se falhar, retry rápido de 12s.
        let parsed = await callAuditor(prompt, 15000);
        if (!parsed) {
          await new Promise(r => setTimeout(r, 400));
          parsed = await callAuditor(prompt, 12000);
        }
        if (!parsed) {
          console.log(`[AUDIT-XGEN] Q${i+1} sem resposta do auditor após retry — fail-open, mantém`);
          return { idx: i, ok: true, patch: null, summary: "auditor indisponível", issues: [], conf: 0, risk: "medium" };
        }

        const conf = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
        const risk = ["low","medium","high"].includes(parsed.risk_level) ? parsed.risk_level : "medium";
        const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

        // ── Guarda anti-falso-descarte: se o auditor reclama de "artigo inexistente / não consta /
        //    não está presente / fora do recorte", mas os artigos citados pela questão EXISTEM no
        //    texto legal completo (blocks), reclassificamos essas issues como 'low' (fail-open).
        const allQText = [q.enunciado, q.comentario, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e].filter(Boolean).join(" ");
        const citedNums = extractAllCitedArticles(allQText);
        const allCitedExist = citedNums.length > 0 && citedNums.every(n => blocks.some(b => b.artNum === n));
        const isOutOfSnippetComplaint = (desc: string) => /n[ãa]o\s+(consta|est[áa]\s+presente|cont[ée]m|aparece|encontra(?:do|da)?|inclui)|inexistente|n[ãa]o\s+presente|fora\s+do\s+recorte|n[ãa]o\s+fornec/i.test(desc);
        let downgraded = 0;
        for (const it of issues) {
          const sev = String(it?.severity || "").toLowerCase();
          const desc = String(it?.description || "");
          if (sev === "high" && allCitedExist && isOutOfSnippetComplaint(desc)) {
            it.severity = "low";
            it.description = `[downgrade: artigo existe no texto completo] ${desc}`;
            downgraded++;
          }
        }
        if (downgraded > 0) console.log(`[AUDIT-XGEN] Q${i+1}: ${downgraded} issue(s) 'high' reclassificadas (artigo existe no texto completo)`);

        const hasHigh = issues.some((it: any) => String(it?.severity).toLowerCase() === "high");
        let patch: any = parsed.proposed_patch && typeof parsed.proposed_patch === "object" ? parsed.proposed_patch : null;
        if (patch) {
          const allowed = ["gabarito","comentario","alt_a","alt_b","alt_c","alt_d","alt_e"];
          const clean: any = {};
          for (const k of allowed) if (k in patch) clean[k] = patch[k];
          if ("gabarito" in clean) {
            const g = Number(clean.gabarito);
            if (!Number.isInteger(g) || g < 0 || g > 4) delete clean.gabarito;
          }
          patch = Object.keys(clean).length ? clean : null;
        }
        return {
          idx: i, ok: !hasHigh,
          patch: (conf >= 0.9 && risk === "low" && patch) ? patch : null,
          summary: String(parsed.ai_summary ?? ""),
          issues, conf, risk,
        };
      };

      // Processa SEQUENCIALMENTE (max 2 questões → ~30s, dentro do budget) para não saturar a API
      const auditResults: any[] = [];
      for (let i = 0; i < validQuestions.length; i++) {
        try {
          auditResults.push(await auditOne(validQuestions[i], i));
        } catch (e) {
          console.log(`[AUDIT-XGEN] Erro inesperado Q${i+1}: ${e instanceof Error ? e.message : String(e)} — fail-open`);
          auditResults.push({ idx: i, ok: true, patch: null, summary: "erro absorvido", issues: [], conf: 0, risk: "medium" });
        }
      }

      const finalQuestions: any[] = [];
      for (const r of auditResults) {
        const q = validQuestions[r.idx];
        if (!r.ok) {
          discarded++;
          questoesRevisaoManual.push({ motivo: `Auditor IA detectou issue grave: ${r.summary || "ver issues"}` });
          console.log(`[AUDIT-XGEN] Q${r.idx+1} DESCARTADA por auditor cruzado: ${r.summary}`);
          continue;
        }
        if (r.patch) {
          Object.assign(q, r.patch);
          autoCorrigidas++;
          console.log(`[AUDIT-XGEN] Q${r.idx+1} AUTO-CORRIGIDA: ${Object.keys(r.patch).join(",")}`);
        }
        finalQuestions.push(q);
      }
      validQuestions.length = 0;
      validQuestions.push(...finalQuestions);
    }
    } catch (auditErr) {
      // Falha catastrófica do auditor cruzado: NÃO bloqueia INSERT — apenas loga
      console.error(`[AUDIT-XGEN] Falha catastrófica absorvida: ${auditErr instanceof Error ? auditErr.message : String(auditErr)} — prosseguindo com INSERT sem auto-correção`);
    }

    // Insert valid questions
    let insertedCount = 0;
    if (validQuestions.length > 0) {
      const { error: insertError } = await supabase.from("questoes").insert(validQuestions);
      if (insertError) {
        console.error("[GERAR] Insert error:", insertError.message);
        errosEncontrados.push({ codigo: "INSERT_ERROR", descricao: insertError.message });
      } else {
        insertedCount = validQuestions.length;
      }
    }

    const statusResult = errosEncontrados.length > 0 ? "parcial" : (insertedCount > 0 ? "sucesso" : "parcial");
    const mensagem = `${insertedCount} questões criadas, ${discarded} descartadas de ${rawQuestions.length} geradas para "${disc.disciplina}".`;

    console.log(`[GERAR] RESULTADO: ${mensagem}`);

    return new Response(JSON.stringify({
      status: statusResult, mensagem,
      detalhes: {
        total_processado: rawQuestions.length,
        questoes_criadas: insertedCount,
        questoes_corrigidas: autoCorrigidas,
        questoes_revisao_manual: questoesRevisaoManual,
        erros_encontrados: errosEncontrados,
      },
      success: true, count: insertedCount, inserted: insertedCount, generated: insertedCount,
      discarded, total_generated: rawQuestions.length, timestamp,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[GERAR] Unexpected error:", String(err));
    return new Response(JSON.stringify({
      status: "erro", mensagem: String(err),
      detalhes: {
        total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0,
        questoes_revisao_manual: questoesRevisaoManual,
        erros_encontrados: [{ codigo: "UNEXPECTED", descricao: String(err) }],
      },
      error: String(err), timestamp,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
