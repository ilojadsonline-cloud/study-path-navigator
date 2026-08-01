import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { runAiStage, type ChatMessage } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;
type ArticleBlock = { artNum: string; text: string; normText: string };

// ============================================================
// PROMPT MESTRE OFICIAL DA BANCA (aplicado a TODAS as disciplinas)
// Diretriz fornecida pela coordenação — tem precedência sobre o restante.
// A SAÍDA permanece em JSON (não markdown), conforme o schema definido adiante.
// ============================================================
const MASTER_BANCA_DIRECTIVE = `============================================================
DIRETRIZ OFICIAL DA BANCA — PROMPT MESTRE (PRECEDÊNCIA MÁXIMA)
============================================================
Você é uma banca examinadora de alto nível jurídico-militar responsável por elaborar questões para o Processo Seletivo Interno CHOA/2026 da PMTO.

Crie questões objetivas comentadas da disciplina indicada, conforme o Edital nº 001/2026, utilizando EXCLUSIVAMENTE o conteúdo existente na base interna da plataforma (texto oficial fornecido nesta chamada).

REGRAS OBRIGATÓRIAS:
1. Cada questão deve ter 5 alternativas, de A a E.
2. Apenas uma alternativa deve estar correta.
3. As alternativas incorretas devem ser plausíveis, técnicas e coerentes.
4. É proibido criar questão com conteúdo inexistente na base.
5. É proibido usar conteúdo fora do edital.
6. É proibido usar dispositivo revogado, rasurado ou substituído como se estivesse vigente.
7. É proibido repetir questão já existente na plataforma.
8. Evite distratores fracos, absurdos ou obviamente errados.
9. Evite que a alternativa correta seja sempre a mais longa ou a mais completa.
10. Evite questões com dupla interpretação.
11. Evite enunciados excessivamente longos ou confusos.
12. Mantenha linguagem impessoal, técnica, institucional e compatível com concurso militar.
13. Respeite rigorosamente a nomenclatura legal de cargos, funções, postos, graduações, quadros, órgãos, documentos e procedimentos.
14. O comentário deve explicar o motivo do gabarito e analisar TODAS as alternativas (A, B, C, D e E individualmente).
15. Inclua uma DICA DE PROVA ao final do comentário de cada questão, no formato "Dica de prova: ...".
16. Informe a base normativa ou o item do material utilizado ao final do comentário.

OBSERVAÇÃO DE FORMATO: embora a estrutura conceitual acima (Disciplina, Assunto, Nível, Competência avaliada, Enunciado, Gabarito, Comentário do professor, Análise das alternativas, Dica de prova, Base normativa) seja a referência pedagógica, a RESPOSTA FINAL deve ser entregue APENAS como JSON válido no schema definido mais abaixo — NÃO use markdown. Mapeie: Assunto→"assunto"; Nível→"dificuldade"; Competência avaliada→"cognitive_skill"; o comentário do professor + análise das alternativas + dica de prova + base normativa devem ser consolidados no campo "comentario".
`;

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

/** Extrai a assinatura semântica de UMA questão (tarefa auxiliar de baixo risco → source_selection). */
async function buildSemanticSignature(
  q: { enunciado: string; alt_correta: string; comentario: string },
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
    const { content: rawContent } = await runAiStage(
      "source_selection",
      [{ role: "user", content: sigPrompt }],
      { jsonResponse: true, maxOutputTokensOverride: 300, temperatureOverride: 0.0, timeoutMs: 25_000 },
    );
    const match = rawContent.match(/\{[\s\S]*\}/);
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

// tipo:
//  "lei"        → disciplina baseada em texto legal com artigos (pipeline jurídico padrão)
//  "texto"      → interpretação de texto (a IA cria o texto-base e a pergunta; sem fonte legal obrigatória)
//  "conceitual" → conceitos de documentos (Redação Oficial: definição/finalidade/hipóteses; fonte = manual cadastrado)
const DISCIPLINES = [
  {
    disciplina: "Lei nº 2.578/2012",
    leiNome: "Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins",
    tipo: "lei",
    assuntos: [
      "Disposições preliminares e conceituações legais", "Ingresso na Corporação e requisitos",
      "Hierarquia, disciplina, círculos hierárquicos e precedência", "Cargo e função militar",
      "Obrigações, valor militar, ética e vedações (sindicalização, greve, filiação partidária, comércio)",
      "Violação de obrigações e deveres (crime x transgressão; responsabilidades)",
      "Direitos, remuneração, vantagens, estabilidade, férias, licenças e afastamentos",
      "Movimentação, agregação, reversão, licenciamento, demissão e exoneração",
      "Reserva e reforma — hipóteses e consequências funcionais",
      "Pontos sensíveis ao Subtenente (precedência do aluno do CHOA, acesso na carreira)",
    ],
    diretrizes: "CUIDADOS: não confundir Polícia Militar com Corpo de Bombeiros quando o dispositivo distinguir; não inventar postos/graduações; não usar denominações revogadas como vigentes; não tratar regras de promoção da Lei 2.575/2012 como se fossem do Estatuto (salvo remissão expressa); cada questão deve cobrar um recorte preciso, não o Estatuto inteiro. ESTILO: comparação entre conceitos (cargo x função, ativa x inatividade, posto x graduação, classificação x transferência), literalidade qualificada de requisitos e vedações, casos práticos de hierarquia/disciplina/direitos, exceções e hipóteses específicas.",
  },
  {
    disciplina: "LC nº 128/2021",
    leiNome: "Organização Básica da Polícia Militar do Estado do Tocantins",
    tipo: "lei",
    assuntos: [
      "Destinação, competências e subordinação da PMTO (força auxiliar e reserva do Exército)",
      "Estrutura geral: unidades de direção, apoio, execução e especiais (atividade-meio x atividade-fim)",
      "Comando-Geral e unidades de direção (Comandante-Geral, Chefe e Subchefe do EM, Corregedor, EMG e EME)",
      "Estado Maior Geral e seções (PM/1 a PM/7) e suas competências",
      "Diretorias e unidades de apoio (DAL, DEIP, DGP, DOF, DSPS, DPS, APMT, Gabinete, Ajudância, Assessorias, CPO/CPP/CPM)",
      "Unidades de execução e especiais (Batalhões, Companhias Independentes, comandos regionais)",
      "Quadros e efetivo (QOPM, QOS, QOE, QOAS, QOM, QPPM, QPE, QPS; oficiais x praças; QOD)",
      "Disposições gerais, transitórias e finais (criação/extinção de unidades; Boletins)",
    ],
    diretrizes: "CUIDADOS: não confundir a LC 128/2021 com a Lei 2.578/2012; não atribuir competência de um órgão a outro; não inventar unidade administrativa; conferir alterações da LC 149/2023 quando presentes na base; não tratar estrutura revogada como vigente; não confundir unidades de direção/apoio/execução/especiais nem quadros de oficiais com quadros de praças. ESTILO: associação entre órgão e competência, classificação de unidades, subordinação e cadeia institucional, comparação EMG x EME, quadros da PMTO e atribuições.",
  },
  {
    disciplina: "Lei nº 2.575/2012",
    leiNome: "Promoções na Polícia Militar do Estado do Tocantins",
    tipo: "lei",
    assuntos: [
      "Disposições preliminares (conceito, finalidade, forma seletiva/gradual/sucessiva, comportamento mínimo)",
      "Abertura de vagas, data de abertura, excedente e efeitos da promoção",
      "Comissões de promoção (CPO x CPP): composição, membros, presidência, deliberação, homologação",
      "Critérios de promoção (antiguidade, merecimento, escolha, bravura, post mortem, tempo de serviço, invalidez, ressarcimento de preterição)",
      "Quadros de Acesso (QAA, QAM, QAE): requisitos, organização, impedimentos, exclusão, inclusão sob condição",
      "Interstício, cursos exigidos e serviço arregimentado (inclusive segunda época)",
      "Avaliação profissional e moral (pontos positivos/negativos, Conceito Profissional e Moral, pontuação mínima)",
      "Promoções especiais e requisitos do CHOA (Subtenente QPPM, CAS, seleção interna, graduação superior, vagas a partir de 01/01/2026)",
    ],
    diretrizes: "CUIDADOS: usar apenas a redação vigente; não misturar tempo de serviço com tempo de contribuição; não confundir CPO com CPP nem QAA/QAM/QAE; não criar requisitos do CHOA fora da lei/edital; não afirmar que antiguidade substitui a seleção interna do CHOA/2026. ESTILO: 'é correto afirmar' diferenciando critérios, casos práticos de militar impedido de entrar no QA, comparação CPO x CPP, pontuação positiva/negativa, requisitos do CHOA e seleção interna, pegadinhas entre bravura, post mortem, invalidez e ressarcimento de preterição.",
  },
  {
    disciplina: "CPPM",
    leiNome: "Código de Processo Penal Militar (DL 1.002/1969) — exclusivamente Arts. 8º a 28 e 243 a 253",
    tipo: "lei",
    assuntos: [
      "Polícia Judiciária Militar: competência, autoridades, atribuições, requisições e delegação",
      "Inquérito Policial Militar: finalidade, instauração, portaria, encarregado, diligências",
      "IPM: oitivas, perícias, acareações, reconhecimento, apreensão, prazos (indiciado preso/solto), prorrogação, relatório e solução",
      "Limites da autoridade de PJM (arquivamento, remessa à Justiça Militar/MPM conforme a base)",
      "Prisão em flagrante: hipóteses, quem pode/deve prender, apresentação do preso",
      "Lavratura do APF: formalidades, condutor, testemunhas, interrogatório, nota de culpa, comunicação, recolhimento",
      "Direitos do preso e relaxamento de prisão ilegal",
    ],
    diretrizes: "ESCOPO ESTRITO: cobrar SOMENTE os arts. 8º a 28 (PJM e IPM) e 243 a 253 (prisão em flagrante e APF). CUIDADOS: nunca cobrar artigos fora desse intervalo; não inserir regras do CPP comum; não confundir IPM com sindicância disciplinar nem flagrante com prisão preventiva; não criar prazo inexistente nem inventar autoridade; o encarregado do IPM não é juiz nem MP; só afirmar que a autoridade de PJM pode arquivar IPM se a base permitir. ESTILO: casos práticos de crime militar em tese, providência correta da autoridade, competência/atribuições, prazos e formalidades do IPM, formalidades do APF e direitos do preso.",
  },
  {
    disciplina: "RDMETO",
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins (Decreto 4.994/2014 e Anexo Único)",
    tipo: "lei",
    assuntos: [
      "Disposições gerais, finalidade e sujeição ao RDMETO (ativa, reserva, reformados, alunos, cedidos)",
      "Conceitos fundamentais (honra pessoal, pundonor militar, decoro da classe, hierarquia, disciplina, transgressão)",
      "Deontologia militar e direitos humanos (uso da força; legalidade, necessidade e proporcionalidade)",
      "Manifestações essenciais da disciplina e ordens (responsabilidade do superior, dever do subordinado, excesso)",
      "Parte disciplinar (comunicação de fato transgressivo, elementos obrigatórios, prazo quando verbal)",
      "Sindicância (conceito, competência, instrução, defesa, relatório e solução) e garantias do contraditório",
      "Conselhos de Disciplina e de Justificação (cabimento, ritos e garantias)",
      "Sanções disciplinares (advertência, repreensão, detenção, prisão, reforma, demissão; gradação; agravantes/atenuantes)",
      "Comportamento das praças (excepcional, ótimo, bom, insuficiente, mau; reclassificação; cancelamento de punição)",
      "Anexo Único (tabela de referência das punições e natureza das transgressões)",
    ],
    diretrizes: "CUIDADOS: não confundir RDMETO com o Estatuto; não criar sanções não previstas; não substituir o rito do RDMETO por PAD civil comum; não confundir sindicância disciplinar com IPM; não tratar transgressão como crime militar (salvo quando a norma relacionar); jamais ignorar contraditório e ampla defesa; conferir prazos antes de usar; não aplicar a tabela de punições sem verificar a natureza da transgressão. ESTILO: casos práticos de conduta transgressiva, conceitos (honra/pundonor/decoro), ordem legal e excesso, sindicância e garantias, comportamento da praça e equivalência de punições.",
  },
  {
    disciplina: "Língua Portuguesa",
    leiNome: "Língua Portuguesa — Interpretação e Compreensão de Texto",
    tipo: "texto",
    assuntos: [
      "Compreensão textual (informação explícita, localização, ideia central, tema, finalidade, tese e argumentos)",
      "Interpretação (inferência, pressupostos, subentendidos, conclusão possível, ponto de vista, efeito de sentido)",
      "Coesão e coerência (referência pronominal, retomada, conectivos, progressão; causa, consequência, oposição, conclusão, explicação, finalidade)",
      "Vocabulário em contexto (sentido de palavras/expressões, substituição sem prejuízo de sentido, ambiguidade)",
      "Tipologia e gênero textual (informativo, argumentativo, institucional, normativo, comunicado oficial, notícia adaptada)",
    ],
    diretrizes: "ESCOPO: SOMENTE interpretação e compreensão de texto. CUIDADOS: não cobrar gramática isolada (concordância, regência, crase, pontuação, ortografia) como fim em si; não usar textos longos demais; nada de tema sensível tratado de forma opinativa/panfletária; a resposta NUNCA depende de conhecimento externo ao texto — tudo deve ser sustentável pelo próprio texto-base; sem pegadinhas artificiais; alternativas não podem ser ambíguas. TEMAS recomendados para o texto-base: segurança pública, hierarquia e disciplina, gestão pública, ética profissional, tecnologia na atividade policial, ordem pública, comunicação institucional, liderança militar, cidadania e direitos humanos. ESTILO: texto curto/médio (criado por você) seguido de UMA pergunta interpretativa; enunciados como 'de acordo com o texto', 'infere-se que', 'a finalidade principal', 'o termo destacado retoma'; apenas uma alternativa sustentada pelo texto.",
  },
  {
    disciplina: "Redação Oficial",
    leiNome: "Manual de Redação Oficial da PMTO — Item 6, subitens 6.1 a 6.8",
    tipo: "conceitual",
    assuntos: [
      "6.1 Atos de correspondência (Ofício, Ofício Circular, Parte, Memorando, Mensagem eletrônica, Requerimento)",
      "6.2 Atos normativos (Diretriz, Instrução Normativa, Regulamento, Regimento Interno, Edital)",
      "6.3 Atos ordinatórios (Portaria, Despacho, Ordem de Operação, Ordem de Serviço, Plano de Curso, Nota de Instrução)",
      "6.4 Atos enunciativos (Parecer, Relatório, Estudo de caso, Projeto)",
      "6.5 Atos negociais (Termo de contrato, Termo de convênio)",
      "6.6 Atos comprobatórios (Ata, Atestado, Certidão, Declaração)",
      "6.7 Atos de divulgação (Boletim, Item para Boletim)",
      "6.8 Atos de serviço (Escala de Serviço, Solicitação de Troca de Serviço, Parte Diária)",
    ],
    diretrizes: "ESCOPO ESTRITO: cobrar APENAS aspectos conceituais — definição, finalidade e hipóteses de utilização de cada documento. EXPRESSAMENTE EXCLUÍDO: estrutura, formatação, partes constitutivas, cabeçalho, fonte, margens, espaçamento, epígrafe, assinatura, modelos e pronomes de tratamento. CUIDADOS: não perguntar 'quais as partes do ofício' ou 'como se estrutura a portaria'; não transformar redação oficial em gramática normativa; o foco é reconhecer o documento adequado a uma finalidade. ESTILO: identificar o documento adequado ao caso concreto; associar tipo de ato à finalidade; comparar Ofício x Memorando x Parte x Requerimento; comparar Parecer x Relatório x Estudo de Caso x Projeto; classificar por categoria (correspondência, normativo, ordinatório, enunciativo, negocial, comprobatório, divulgação, serviço).",
  },
  // ATENÇÃO: POP deve permanecer SEMPRE no FINAL do array (índice 7) para não deslocar
  // os índices das demais disciplinas (disciplina_index é posicional). Conteúdo sigiloso.
  {
    disciplina: "POP",
    leiNome: "Procedimento Operacional Padrão (POP) da PMTO — Uso Seletivo da Força e Abordagens Policiais",
    tipo: "lei",
    assuntos: [
      "Processo 108 — uso seletivo da força: conceito operacional e finalidade",
      "Princípios do uso da força (legalidade, necessidade, proporcionalidade, moderação, conveniência, responsabilização)",
      "Níveis de resistência do abordado e correspondência com os níveis de resposta policial",
      "Presença policial, verbalização, controle de contato e técnicas de menor potencial ofensivo",
      "Força potencialmente letal: hipóteses, limites e responsabilização",
      "Avaliação de risco, progressão e regressão no uso da força",
      "Abordagens policiais: procedimentos, segurança, técnicas e hipóteses de utilização no cotidiano da Corporação",
    ],
    diretrizes: "ESCOPO ESTRITO: cobrar SOMENTE o que consta no texto oficial do POP fornecido na base interna. CUIDADOS: não inventar níveis, técnicas ou procedimentos não previstos no texto; não confundir uso da força do POP com sanções disciplinares do RDMETO nem com tipos penais do CPM/CPPM; não criar hipóteses, prazos ou autoridades inexistentes; manter rigor literal e técnico. ESTILO: casos práticos de escolha do nível de resposta adequado ao nível de resistência, aplicação dos princípios do uso da força, providência correta na abordagem, progressão/regressão da força e identificação de conduta conforme/desconforme ao procedimento.",
  },
] as const;


// ============================================================
// CHOA BM 2026 (CBMTO) — Edital nº 1/2026/GABCOM.
// Prova com 4 alternativas (a–d). Fonte única: discipline_legal_texts do curso.
// ============================================================
const CBMTO_DIRETRIZES_PADRAO =
  "ESCOPO ESTRITO: cobrar SOMENTE o que consta no texto oficial/manual fornecido na base interna desta disciplina. " +
  "CUIDADOS: não inventar procedimentos, equipamentos, protocolos, prazos, competências ou nomenclaturas ausentes do texto; " +
  "não misturar conteúdo de outras disciplinas do certame; manter rigor técnico e terminologia oficial do CBMTO. " +
  "ESTILO: casos práticos de emprego operacional, identificação do procedimento correto, sequência de ações, " +
  "critérios de decisão e identificação de conduta conforme/desconforme ao manual.";

const DISCIPLINES_CBMTO = [
  { disciplina: "Direito Penal Militar e Processual Penal Militar", assuntos: ["Crimes militares em espécie", "Aplicação da lei penal militar", "Inquérito Policial Militar", "Prisão em flagrante e providências"] },
  { disciplina: "Redação Oficial", assuntos: ["Atos de correspondência", "Atos normativos", "Atos ordinatórios", "Atos enunciativos", "Atos comprobatórios"] },
  { disciplina: "Combate a Incêndio Urbano", assuntos: ["Teoria do fogo", "Agentes extintores", "Técnicas e táticas de combate", "Ventilação tática", "Equipamentos de proteção respiratória"] },
  { disciplina: "NPCE", assuntos: ["Exigências de segurança contra incêndio", "Saídas de emergência", "Sistemas preventivos", "Análise de projetos", "Vistorias"] },
  { disciplina: "Sistema de Comando de Incidentes", assuntos: ["Princípios e características do SCI", "Estrutura organizacional", "Funções do comando", "Plano de ação do incidente"] },
  { disciplina: "Atendimento Pré-Hospitalar", assuntos: ["Avaliação da vítima", "Suporte básico de vida", "Hemorragias e choque", "Trauma e imobilizações", "Emergências clínicas"] },
  { disciplina: "Salvamento em Altura", assuntos: ["Equipamentos e EPIs", "Nós e ancoragens", "Sistemas de descida e içamento", "Segurança operacional"] },
  { disciplina: "Salvamento Aquático", assuntos: ["Técnicas de abordagem", "Equipamentos de flutuação", "Salvamento em enchentes", "Segurança do socorrista"] },
  { disciplina: "Salvamento Terrestre", assuntos: ["Desencarceramento veicular", "Estabilização de veículos", "Ferramentas de salvamento", "Espaços confinados"] },
  { disciplina: "Legislação Específica", assuntos: ["Lei de organização do CBMTO", "Estatuto dos militares", "Regulamento disciplinar", "Promoções de praças"] },
].map((d) => ({
  disciplina: d.disciplina,
  leiNome: `Texto oficial de "${d.disciplina}" (CHOA BM 2026 — Edital nº 1/2026/GABCOM)`,
  tipo: "manual" as const,
  assuntos: d.assuntos,
  diretrizes: CBMTO_DIRETRIZES_PADRAO,
  alternativas: 4 as const,
}));

function getDisciplinesByCurso(cursoSlug?: string | null) {
  return (cursoSlug || "pmto").toLowerCase() === "cbmto" ? DISCIPLINES_CBMTO : DISCIPLINES;
}

/**
 * Redação Oficial: o edital (Item 6, 6.1–6.8) cobra APENAS aspectos conceituais
 * (definição, finalidade e hipóteses de uso). Questões geradas que escorregarem para
 * estrutura/formatação/partes constitutivas/cabeçalho/margem/fonte/etc. devem ser
 * DESCARTADAS antes da inserção.
 */
function isRedacaoOficialDisc(disciplina: string | null | undefined): boolean {
  const d = String(disciplina ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return d.includes("redacao");
}

function redacaoForaDeEscopo(disciplina: string, enunciado: string, alts: string[]): boolean {
  if (!isRedacaoOficialDisc(disciplina)) return false;
  const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const haystack = `${norm(enunciado)} \u2022 ${alts.map(norm).join(" \u2022 ")}`;
  const formatRes: RegExp[] = [
    /\bpartes?\s+(?:constitutivas?|integrantes?|componentes?|que\s+comp[oõ]em|do\s+(?:oficio|memorando|documento|ato|texto|expediente))/,
    /\bestrutura\s+(?:do|da|de|correta|formal|interna|basica|de\s+um|de\s+uma)/,
    /\bcomo\s+(?:se\s+)?(?:estrutura|estruturar|formata|formatar|diagrama|organiza\s+graficamente)\b/,
    /\bordem\s+(?:correta\s+)?(?:das\s+partes|dos\s+elementos|de\s+apresentacao)\b/,
    /\bformatac/, /\bdiagramac/, /\bcabecalho\b/, /\bespacamento\b/, /\bentrelinhas?\b/,
    /\bepigrafe\b/, /\bvocativo\b/, /\bementa\b/, /\bfecho\b/, /\bmargens?\b/, /\brodape\b/,
    /\balinhamento\b/, /\bnumeracao\s+(?:de\s+paragrafos?|das?\s+pagina|dos?\s+itens)\b/,
    /\b(?:tipo|tamanho|corpo)\s+(?:de\s+)?(?:da\s+)?fonte\b/,
    /\bfonte\s+(?:arial|times|calibri|tipografica|sem\s+serifa)\b/,
    /\bpronomes?\s+de\s+tratamento\b/, /\bdisposicao\s+grafica\b/,
    /\b(?:modelo|leiaute|layout|padrao\s+grafico)\s+(?:do|de|correto)\b/,
  ];
  return formatRes.some((re) => re.test(haystack));
}



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

// ──────────────────────────────────────────────────────────────────────────
// FLUXO PRÓPRIO — disciplinas NÃO jurídicas (Língua Portuguesa / Redação Oficial)
// Não dependem de artigos de lei: validação estrutural + dedup + auditoria cética genérica.
// ──────────────────────────────────────────────────────────────────────────
async function generateNonLegalBatch(ctx: {
  supabase: any;
  disc: any;
  sourceContent: string;
  batchSize: number;
  existingFingerprints: Set<string>;
  existingSemanticFPs: Set<string>;
  existingForSimilarity: Array<{ id: number; enunciado: string }>;
  assuntoCoverage: Map<string, number>;
  openingsToAvoid: string[];
  timestamp: string;
  questoesRevisaoManual: Array<{ id?: string; motivo: string }>;
  errosEncontrados: Array<{ codigo: string; descricao: string }>;
  useLovable: boolean;
  cursoId?: string | null;
}): Promise<Response> {
  const {
    supabase, disc, sourceContent, batchSize,
    existingFingerprints, existingSemanticFPs, existingForSimilarity,
    assuntoCoverage, openingsToAvoid, timestamp, questoesRevisaoManual, errosEncontrados, useLovable, cursoId,
  } = ctx;

  const isTexto = disc.tipo === "texto"; // Língua Portuguesa
  const isManual = (disc as any).tipo === "manual"; // CBMTO — manuais operacionais
  const numAlts: number = (disc as any).alternativas === 4 ? 4 : 5;
  const LETRAS_ALT = ["A", "B", "C", "D", "E"].slice(0, numAlts);
  const faixaGab = LETRAS_ALT.map((l, i) => `${l}(${i})`).join(", ");
  const altFields = LETRAS_ALT.map((l) => `"alt_${l.toLowerCase()}"`).join(", ");
  const leastCoveredAssuntos = disc.assuntos
    .map((a: string) => ({ assunto: a, count: assuntoCoverage.get(a) || 0 }))
    .sort((a: any, b: any) => a.count - b.count)
    .slice(0, 4)
    .map((a: any) => `"${a.assunto}"`)
    .join(", ");

  const openingsBlock = openingsToAvoid.length > 0
    ? `\nABERTURAS JÁ MUITO USADAS (varie, não comece igual):\n${openingsToAvoid.map((o, i) => `${i + 1}) "${o}..."`).join("\n")}`
    : "";

  const manualSystemPrompt = `${MASTER_BANCA_DIRECTIVE}

Você é uma BANCA EXAMINADORA TÉCNICA DE ALTÍSSIMO NÍVEL do Corpo de Bombeiros Militar do Estado do Tocantins (CHOA BM 2026 — Edital nº 1/2026/GABCOM). Sua missão é elaborar questões objetivas da disciplina "${disc.disciplina}", com ${numAlts} alternativas (${LETRAS_ALT.join(", ")}) e apenas uma correta.

REGRAS OBRIGATÓRIAS:
1. FONTE ÚNICA: use exclusivamente o TEXTO OFICIAL fornecido na mensagem do usuário. Nada de conhecimento externo, outros manuais, normas de outros estados ou analogias.
2. Cada questão deve ter EXATAMENTE ${numAlts} alternativas (${LETRAS_ALT.join(", ")}), com apenas uma correta.
3. As ${numAlts - 1} alternativas incorretas devem ser plausíveis e tecnicamente coerentes (troca de etapa, inversão de sequência, parâmetro alterado, competência trocada), nunca absurdas.
4. Terminologia oficial do CBMTO, linguagem impessoal e técnica.
5. A correta não pode ser a mais longa nem a mais curta; todas com estrutura semelhante.
6. PADRÃO ELITE: questões de aplicação operacional real, não decoreba superficial.`;

  const systemPrompt = isManual ? manualSystemPrompt : isTexto
    ? `${MASTER_BANCA_DIRECTIVE}

Você é uma BANCA EXAMINADORA DE LÍNGUA PORTUGUESA DE ALTÍSSIMO NÍVEL para o concurso interno CHOA/2026 da PMTO, no padrão de bancas como CEBRASPE, FGV e FCC. Sua missão é elaborar questões objetivas de INTERPRETAÇÃO E COMPREENSÃO DE TEXTO, com 5 alternativas e apenas uma correta.

REGRAS OBRIGATÓRIAS:
1. Para CADA questão, CRIE você mesmo um TEXTO-BASE inédito, curto ou médio (6 a 14 linhas), coeso e bem escrito, sobre temas institucionais (segurança pública, hierarquia e disciplina, gestão pública, ética profissional, tecnologia na atividade policial, ordem pública, comunicação institucional, liderança militar, cidadania e direitos humanos). O texto-base deve fazer parte do campo "enunciado", separado da pergunta por uma linha em branco.
2. A pergunta deve exigir compreensão/interpretação: ideia central, finalidade, inferência, pressuposto, efeito de sentido, referência/retomada, conectivos, relações lógico-discursivas, sentido de palavra/expressão no contexto.
3. A resposta correta deve ser INTEGRALMENTE sustentável pelo PRÓPRIO TEXTO-BASE. NUNCA dependa de conhecimento externo ao texto.
4. NÃO cobre gramática isolada (concordância, regência, crase, pontuação, ortografia) como fim em si — só quando vinculada à interpretação.
5. As 4 alternativas incorretas devem ser plausíveis (extrapolação indevida, contradição sutil, generalização, troca de causa/consequência), nunca absurdas nem ambíguas.
6. Exatamente UMA alternativa correta; as cinco com comprimento e estrutura semelhantes (a correta não pode ser a mais longa nem a mais curta).
7. Distinga compreender (o que o texto diz) de extrapolar (o que o texto NÃO autoriza concluir).
8. PADRÃO ELITE: questões com real dificuldade interpretativa; nada óbvio ou resolvível sem ler o texto.`
    : `${MASTER_BANCA_DIRECTIVE}

Você é uma BANCA EXAMINADORA DE REDAÇÃO OFICIAL MILITAR DE ALTÍSSIMO NÍVEL para o concurso interno CHOA/2026 da PMTO. Sua missão é elaborar questões objetivas sobre o MANUAL DE REDAÇÃO OFICIAL DA PMTO — Item 6, subitens 6.1 a 6.8 — com 5 alternativas e apenas uma correta.

ESCOPO ESTRITO (Edital nº 001/2026): cobre APENAS os ASPECTOS CONCEITUAIS de cada documento — DEFINIÇÃO, FINALIDADE e HIPÓTESES DE UTILIZAÇÃO. É EXPRESSAMENTE PROIBIDO cobrar estrutura, formatação, partes constitutivas, cabeçalho, fonte, margens, espaçamento, epígrafe, assinatura, modelos e pronomes de tratamento.

REGRAS OBRIGATÓRIAS:
1. FONTE ÚNICA: use exclusivamente o TEXTO OFICIAL fornecido na mensagem do usuário (Manual de Redação Oficial da PMTO). Nada de conhecimento externo, outros manuais ou analogias.
2. O foco é RECONHECER o documento adequado a uma finalidade, ou ASSOCIAR tipo de ato à sua finalidade/categoria (correspondência, normativo, ordinatório, enunciativo, negocial, comprobatório, divulgação, serviço).
3. NÃO pergunte "quais as partes do ofício" nem "como se estrutura a portaria". Nada de gramática normativa.
4. As 4 alternativas incorretas devem ser plausíveis (troca de documento adequado, finalidade trocada, categoria errada), nunca absurdas nem ambíguas.
5. Exatamente UMA alternativa correta; as cinco com comprimento e estrutura semelhantes (a correta não pode ser a mais longa nem a mais curta).
6. PADRÃO ELITE: questões que diferenciem documentos próximos (Ofício x Memorando x Parte x Requerimento; Parecer x Relatório x Estudo de Caso x Projeto).`;

  const fonteBlock = isManual
    ? `TEXTO OFICIAL — FONTE ÚNICA (${disc.leiNome}):\n"""${(sourceContent || "").slice(0, 14000)}"""`
    : isTexto
    ? `Você cria o próprio TEXTO-BASE de cada questão (não há fonte externa). Cada texto-base deve ser inédito e diferente dos demais do lote.`
    : `TEXTO OFICIAL — FONTE ÚNICA (Manual de Redação Oficial da PMTO, Item 6):\n"""${(sourceContent || "").slice(0, 14000)}"""`;

  const prompt = `DADOS DA GERAÇÃO
Disciplina: ${disc.disciplina}
Quantidade exata de questões a gerar: ${batchSize}
Assuntos a priorizar (menos explorados): ${leastCoveredAssuntos}
Assuntos possíveis: ${disc.assuntos.join(", ")}

DIRETRIZES ESPECÍFICAS DA DISCIPLINA (${isManual ? "Edital nº 1/2026/GABCOM — CHOA BM 2026 CBMTO" : "Edital nº 001/2026 — CHOA/2026 PMTO"}) — obrigatórias:
${disc.diretrizes}

${fonteBlock}
${openingsBlock}

REGRAS DE QUALIDADE:
- Cada questão do lote deve abordar um ASPECTO/${isTexto ? "TEXTO" : "DOCUMENTO"} DIFERENTE. Não repita tema, estrutura ou pegadinha.
- Distribua o gabarito entre ${faixaGab} — não concentre na mesma letra.
- O comentário é a parte MAIS importante e deve funcionar como uma AULA CURTA (tom de professor altamente didático, entre 900 e 2400 caracteres). Consolide no campo "comentario", nesta ordem e com estes rótulos em negrito markdown: **Comentário do professor:** (por que a correta está certa, com referência ao trecho do texto-base/${isTexto ? "texto" : "documento"} e à pegadinha); **Análise das alternativas:** (CADA alternativa ${LETRAS_ALT[0]}–${LETRAS_ALT[LETRAS_ALT.length - 1]} comentada individualmente, uma por linha, no padrão "**A)** ...", explicando por que está correta ou incorreta — nunca escreva "as demais estão erradas"); **Dica de prova:** (resumo estratégico/alerta de pegadinha curto); **Base normativa:** (${isManual ? "item/seção do manual oficial que fundamenta a resposta" : isTexto ? "elemento do texto-base que fundamenta a resposta" : "subitem do Manual — ex.: 6.1, 6.5 — que fundamenta a resposta"}). Proibido comentário raso ou que apenas repita o gabarito.

REGRAS DE SAÍDA — responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown e sem texto fora do objeto, no formato {"questions":[...]}.
Campos obrigatórios por questão: "disciplina", "assunto", "dificuldade" ("Fácil|Médio|Difícil"), "enunciado"${isTexto ? " (inclui o TEXTO-BASE + linha em branco + a pergunta)" : ""}, ${altFields} (sem prefixo de letra), "gabarito" (${LETRAS_ALT.map((l, i) => `${i}=${l}`).join(",")}), "comentario", "cognitive_skill", "trap_type".
{"questions":[{"disciplina":"${disc.disciplina}","assunto":"...","dificuldade":"Médio","enunciado":"...",${LETRAS_ALT.map((l) => `"alt_${l.toLowerCase()}":"..."`).join(",")},"gabarito":0,"comentario":"...","cognitive_skill":"interpretação","trap_type":"..."}]}

Se NÃO for possível gerar nenhuma questão válida dentro do escopo, retorne {"questions":[],"erro":"NAO_FOI_POSSIVEL_GERAR"}.`;

  // DeepSeek Reasoner (R1) gasta grande parte do orçamento em raciocínio interno;
  // com cap baixo o JSON sai truncado (finish_reason=length) → lote "+0". Margem ampla.
  const maxTokens = 5200;
  const PRIMARY_TIMEOUT_MS = useLovable ? 55000 : 90000;

  let content = '{"questions":[]}';
  try {
    const genMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];
    const aiResult = await runAiStage("question_generation", genMessages, {
      jsonResponse: true,
      maxOutputTokensOverride: maxTokens,
      temperatureOverride: 0.4,
      timeoutMs: PRIMARY_TIMEOUT_MS,
      // Complexidade → modelo Maritaca: texto (Língua Portuguesa) = medium (sabiazinho-4);
      // conceitual (Redação Oficial, normativo) = high (sabia-4).
      complexity: isTexto ? "medium" : "high",
      metadata: { batchSize, disciplina: disc.disciplina, tipo: disc.tipo },
      // Se o provedor primário devolver lote vazio, cai p/ DeepSeek em vez de retornar +0
      contentValidator: (c: string) => {
        try { return parseQuestionsFromModelContent(c).questions.length > 0; }
        catch { return false; }
      },
    });
    content = aiResult.content || '{"questions":[]}';
    const finishReason = aiResult.raw?.choices?.[0]?.finish_reason ?? aiResult.raw?.choices?.[0]?.stop_reason ?? "?";
    console.log(`[GERAR-NL] OK via ${aiResult.provider}/${aiResult.model} (${disc.disciplina}) finish=${finishReason} len=${content.length} preview=${content.slice(0, 300).replace(/\n/g, " ")}`);
  } catch (genErr: any) {
    const msg = String(genErr?.message ?? genErr);
    const isCredit = /HTTP 402|insufficient|no credits|saldo|quota|billing|exhaust/i.test(msg);
    const isRate = /HTTP 429|rate limit|too many requests/i.test(msg);
    const isTimeout = /abort|timeout/i.test(msg);
    return new Response(JSON.stringify({
      status: "erro",
      mensagem: isCredit ? "Provedor de IA sem saldo/limite." : isRate ? "Rate limit da IA." : isTimeout ? "A IA demorou demais." : "Erro da IA na geração.",
      paused: isCredit || isRate,
      detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: isCredit ? "AI_402" : isRate ? "RATE_LIMIT" : isTimeout ? "TIMEOUT" : "API_ERROR", descricao: msg.slice(0, 200) }] },
      timestamp,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let rawQuestions: any[];
  try {
    rawQuestions = parseQuestionsFromModelContent(content).questions;
  } catch {
    return new Response(JSON.stringify({
      status: "erro", mensagem: "IA retornou JSON inválido.",
      detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_JSON", descricao: "JSON inválido" }] },
      timestamp,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!Array.isArray(rawQuestions)) rawQuestions = [];

  const validQuestions: any[] = [];
  let discarded = 0;
  const discardReasons = new Map<string, number>();
  const discard = (reason: string, detail?: string) => {
    discarded++;
    discardReasons.set(reason, (discardReasons.get(reason) || 0) + 1);
    console.log(`[GERAR-NL] Q descartada (${disc.disciplina}): ${reason}${detail ? ` — ${detail}` : ""}`);
  };
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
      gabarito: Math.min(Math.max(Number(raw.gabarito) || 0, 0), numAlts - 1),
      cognitive_skill: normalizeWhitespace(raw.cognitive_skill) || null,
      trap_type: normalizeWhitespace(raw.trap_type) || null,
      artigo_principal: null,
    };
    for (const k of ALT_KEYS) q[k] = stripAlternativePrefix(raw[k]);
    // Provas de 4 alternativas (CBMTO): alt_e fica vazia e não é exibida ao aluno.
    if (numAlts === 4) q["alt_e"] = "";

    const alts = ALT_KEYS.slice(0, numAlts).map(k => q[k] as string);
    const minEnun = isTexto ? 120 : 25; // texto-base exige enunciado mais longo
    // FLUXO OFICIAL: só descartamos por integridade estrutural (questão inutilizável).
    // Qualidade/duplicidade fica para a auditoria manual na lista de pendentes.
    if (!q.enunciado || q.enunciado.length < minEnun) { discard("enunciado_curto", `${q.enunciado?.length || 0} chars`); continue; }
    if (alts.some(a => !a || a.length < 2)) { discard("alternativa_vazia"); continue; }
    if (hasDuplicateAlts(alts)) { discard("alternativas_duplicadas"); continue; }
    if (!q.comentario || q.comentario.length < 30) { discard("comentario_curto", `${q.comentario?.length || 0} chars`); continue; }

    validQuestions.push(q);

  }

  // Inserção
  let insertedCount = 0;
  if (validQuestions.length > 0) {
    if (cursoId) for (const q of validQuestions) q.curso_id = cursoId;
    const { error: insertError } = await supabase.from("questoes").insert(validQuestions);
    if (insertError) {
      errosEncontrados.push({ codigo: "INSERT_ERROR", descricao: insertError.message });
    } else {
      insertedCount = validQuestions.length;
    }
  }

  const statusResult = insertedCount > 0 ? (errosEncontrados.length > 0 ? "parcial" : "sucesso") : "erro";
  const discardSummary = Object.fromEntries(discardReasons.entries());
  const mensagem = `${insertedCount} questões criadas, ${discarded} descartadas de ${rawQuestions.length} geradas para "${disc.disciplina}".`;
  console.log(`[GERAR-NL] RESULTADO: ${mensagem} motivos=${JSON.stringify(discardSummary)}`);

  return new Response(JSON.stringify({
    status: statusResult, mensagem,
    detalhes: {
      total_processado: rawQuestions.length,
      questoes_criadas: insertedCount,
      questoes_corrigidas: 0,
      questoes_revisao_manual: questoesRevisaoManual,
      erros_encontrados: errosEncontrados,
      motivos_descarte: discardSummary,
    },
    success: insertedCount > 0, count: insertedCount, inserted: insertedCount, generated: insertedCount,
    discarded, total_generated: rawQuestions.length, timestamp,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req: Request) => {
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

    const { disciplina_index, batch_size, curso_id, curso_slug, disciplina_nome } = await req.json();
    const cursoId: string | null = curso_id ?? null;
    const cursoSlug: string = String(curso_slug || "pmto").toLowerCase();
    const DISCIPLINES_ATIVAS: any[] = getDisciplinesByCurso(cursoSlug);
    const requestedBatchSize = Number(batch_size) || 2;
    // Mínimo 2 questões por lote (resiliência: se uma falha, sobra outra). Cap em 2 pelo budget de tempo.
    const batchSize = Math.max(2, Math.min(2, requestedBatchSize));
    const discIndex = disciplina_index ?? 0;

    const byName = disciplina_nome
      ? DISCIPLINES_ATIVAS.findIndex((d: any) => d.disciplina === disciplina_nome)
      : -1;
    const resolvedIndex = byName >= 0 ? byName : discIndex;

    if (resolvedIndex < 0 || resolvedIndex >= DISCIPLINES_ATIVAS.length) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Índice de disciplina inválido.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_INDEX", descricao: `Índice ${resolvedIndex} fora do range 0-${DISCIPLINES_ATIVAS.length - 1}` }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const disc: any = DISCIPLINES_ATIVAS[resolvedIndex];
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch source text. Para tipo "lei"/"conceitual" é fonte obrigatória.
    // Para tipo "texto" (Língua Portuguesa) a IA cria o próprio texto-base → fonte opcional.
    let legalTextQuery = supabase
      .from("discipline_legal_texts").select("content").eq("disciplina", disc.disciplina);
    legalTextQuery = cursoId
      ? legalTextQuery.or(`curso_id.eq.${cursoId}${cursoSlug === "pmto" ? ",curso_id.is.null" : ""}`)
      : legalTextQuery.is("curso_id", null);
    const { data: legalTextRows } = await legalTextQuery.limit(1);
    const legalTextRow = legalTextRows?.[0] ?? null;

    const sourceContent = legalTextRow?.content ? String(legalTextRow.content).trim() : "";
    const requiresSource = disc.tipo !== "texto";

    if (requiresSource && sourceContent.length < 500) {
      return new Response(JSON.stringify({
        status: "erro",
        mensagem: `Texto oficial insuficiente para "${disc.disciplina}". Geração bloqueada — discipline_legal_texts.content é a ÚNICA fonte permitida.`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_LEGAL_TEXT", descricao: `Cadastre/expanda o texto oficial da disciplina "${disc.disciplina}" (mínimo 500 caracteres). PDFs, anexos e conhecimento geral do modelo são proibidos como fonte.` }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const leiSeca = sourceContent;
    const blocks = parseArticleBlocks(leiSeca);
    const availableArticles = blocks.map(b => `Art. ${b.artNum}`).join(", ");

    // ── AI Provider: Maritaca AI (Sabiá-4) é o gerador PRIMÁRIO. DeepSeek Reasoner é o fallback. ──
    const DEEPSEEK_API_KEY_PRIMARY = Deno.env.get("DEEPSEEK_API_KEY");
    const MARITACA_API_KEY = Deno.env.get("MARITACA_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useMaritaca = !!MARITACA_API_KEY;
    const useDeepSeekFallback = !!DEEPSEEK_API_KEY_PRIMARY;
    const useLovable = !useMaritaca && !useDeepSeekFallback && !!LOVABLE_API_KEY;
    if (!DEEPSEEK_API_KEY_PRIMARY && !MARITACA_API_KEY && !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Nenhuma API key de IA configurada para o gerador.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_API_KEY", descricao: "Configure MARITACA_API_KEY (preferencial — Sabiá-4), DEEPSEEK_API_KEY (fallback — reasoner) ou LOVABLE_API_KEY" }] },
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

    // ── ROTEAMENTO: disciplinas NÃO jurídicas (Língua Portuguesa / Redação Oficial) ──
    // Não dependem de artigos de lei; usam pipeline próprio (texto-base interpretativo ou conceito de documentos).
    if (disc.tipo !== "lei") {
      return await generateNonLegalBatch({
        supabase, disc, sourceContent: leiSeca, batchSize,
        existingFingerprints, existingSemanticFPs, existingForSimilarity,
        assuntoCoverage, openingsToAvoid,
        timestamp, questoesRevisaoManual, errosEncontrados, useLovable, cursoId,
      });
    }


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
    const systemPrompt = `${MASTER_BANCA_DIRECTIVE}

Você é uma BANCA EXAMINADORA JURÍDICA DE ALTÍSSIMO NÍVEL, especializada em concursos militares internos da Polícia Militar do Estado do Tocantins, especialmente no padrão exigido para o CHOA/PMTO. Sua missão é elaborar questões objetivas de múltipla escolha com cinco alternativas, sendo apenas uma correta, com rigor técnico equivalente ao de bancas difíceis como CEBRASPE, FGV e VUNESP.

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
4. NÍVEL DE DIFICULDADE E ESTILO DE BANCA (PADRÃO ELITE OBRIGATÓRIO)
============================================================
As questões devem ter PADRÃO DE BANCA DE ALTÍSSIMO NÍVEL para o CHOA/PMTO, em patamar de COMPLEXIDADE JURÍDICA AINDA MAIS ELEVADO. O alvo PREFERENCIAL agora é "difficulty_level":"hard"; use "advanced" apenas quando o dispositivo não comportar maior sofisticação, e "intermediate" SOMENTE em literalidade obrigatória inevitável. Questões fáceis, óbvias, infantis, puramente literais ou resolvíveis por eliminação grosseira são PROIBIDAS — só admita literalidade direta quando o próprio dispositivo legal EXIGIR literalidade (definições fechadas, enumerações taxativas, prazos numéricos expressos). Um aluno que apenas leu rapidamente a lei — e mesmo um aluno que a leu com atenção, mas sem dominar a articulação entre dispositivos — NÃO pode acertar com facilidade.

PRIORIZE SEMPRE, e em grau mais profundo: interpretação fina e sistemática do texto legal (lendo caput, parágrafos, incisos, alíneas e remissões em conjunto, não isoladamente); exceções, ressalvas e exceções da exceção; competências e atribuições com sobreposições e limites; prazos, marcos temporais e contagens; condições e requisitos cumulativos versus alternativos; consequências jurídicas encadeadas; distinção fina entre institutos semelhantes do próprio texto; e pegadinhas normativas realistas e sutis extraídas exclusivamente da lei carregada. Sempre que o texto permitir, a questão deve exigir a ARTICULAÇÃO DE DOIS OU MAIS DISPOSITIVOS (ex.: regra de um artigo combinada com exceção ou prazo de outro) para chegar à resposta correta. Evite memorização rasa e respostas obtidas por simples localização de um único dispositivo.

Use, em cada questão, pelo menos QUATRO das técnicas a seguir (combinando-as de forma que o raciocínio tenha mais de uma etapa): combinação entre caput, parágrafo, inciso, alínea e exceção; distinção entre regra geral, hipótese especial e exceção da exceção; troca sutil de autoridade competente; alteração discreta de prazo, requisito, ordem procedimental ou consequência; confusão plausível entre órgão, função, posto, graduação ou competência; situação hipotética militar realista que exija subsunção em mais de um dispositivo; comparação entre conduta proibida, permitida, condicionada ou excepcional; alternativa com verdade parcial e conclusão errada; inversão entre dever, faculdade, vedação, autorização e competência; omissão de condição essencial prevista no texto legal; deslocamento de requisito de um instituto para outro semelhante. As alternativas incorretas devem ser tecnicamente sofisticadas: erros plausíveis que só um candidato com domínio real do dispositivo consegue descartar — nada de distratores absurdos.

Cada questão deve registrar honestamente "cognitive_skill" (a habilidade dominante exigida) e "trap_type" (a pegadinha normativa central). Se a questão não tiver uma pegadinha real e verificável no texto legal, ela é fácil demais — reescreva antes de emitir.

Não transforme todas as questões em casos práticos. Varie os formatos entre literalidade direta (apenas quando o dispositivo exigir), caso prático, exceção à regra, conceito legal, combinação de dispositivos, consequência jurídica, asserções e completar lacuna.


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
12. COMENTÁRIO DIDÁTICO OBRIGATÓRIO (PADRÃO BANCA DE ELITE)
============================================================
O comentário é a parte MAIS importante da questão: cada questão deve funcionar como uma AULA CURTA. Ele deve soar como um professor de Direito Militar altamente didático explicando a questão ao aluno — claro, completo, juridicamente preciso e seguro. Entre 900 e 2400 caracteres. Proibido comentário raso, genérico ou que apenas repita o gabarito. Proibida formatação robótica ("a) IDENTIFICAÇÃO:") e cópia de blocos enormes da lei.

O campo "comentario" deve CONSOLIDAR, nesta ordem e com estas seções nomeadas em texto corrido (use os rótulos exatamente como abaixo, em negrito markdown):

**Comentário do professor:** Explique por que o gabarito está correto, citando o trecho curto e literal do texto legal que o sustenta. Contextualize o instituto e, quando houver, diferencie conceitos próximos e explique a pegadinha/técnica usada pela banca (troca de autoridade, inversão de regra/exceção, omissão de requisito, alteração de prazo, generalização indevida etc.).

**Análise das alternativas:** Analise CADA alternativa individualmente, uma por linha, no padrão "**A)** ...", "**B)** ...", "**C)** ...", "**D)** ...", "**E)** ...", explicando por que cada uma está correta ou incorreta com fundamento objetivo no texto legal. NUNCA escreva "as demais estão erradas" — todas as cinco devem ser comentadas.

**Dica de prova:** Encerre com um resumo estratégico para memorização: alerta de pegadinha, comparação importante ou frase de fixação curta ("Lembre-se: segundo o art. X, ...").

**Base normativa:** Indique a norma, artigo, inciso, parágrafo ou item utilizado, sempre presente no TEXTO LEGAL OFICIAL.

O comentário não deve citar fontes externas. Não mencione Constituição Federal, jurisprudência, doutrina ou outros diplomas se eles não estiverem no TEXTO LEGAL OFICIAL. Não copie blocos enormes da lei; use citação curta e suficiente.

============================================================
13. MATRIZ INTERNA DE PROVA JURÍDICA
============================================================
Para cada questão, construa internamente uma matriz de validação que demonstre por que a correta é correta e por que cada distrator é incorreto: artigo principal; dispositivos auxiliares, se houver; trecho literal curto que sustenta a alternativa correta; razão de erro de cada alternativa incorreta; tipo de pegadinha usada em cada distrator; confirmação de que nenhuma fonte externa foi usada; confirmação de que todos os artigos citados existem no texto legal fornecido; confirmação de que há exatamente uma alternativa correta; confirmação de que a alternativa correta não é a mais longa nem a mais curta.

Se qualquer item da matriz falhar, reescreva a questão antes de responder.

============================================================
13b. TERMOS PROIBIDOS E CATÁLOGO DE DISTRATORES (REFORÇO)
============================================================
TERMOS ABSOLUTOS: não use "sempre", "nunca", "somente", "apenas", "exclusivamente", "em qualquer hipótese" ou equivalentes — SALVO quando o próprio TEXTO LEGAL OFICIAL empregar expressamente essa restrição. Esses termos costumam denunciar alternativa falsa ou tornar a correta artificial.

NÃO COPIE LITERALMENTE longos trechos da lei nem no enunciado nem nas alternativas. Transforme o conteúdo em pergunta de banca preservando fielmente o sentido jurídico; a citação literal só é admitida em trecho curto dentro do comentário.

Cada uma das quatro alternativas incorretas deve ser errada por um MOTIVO OBJETIVO E VERIFICÁVEL no texto legal, usando OBRIGATORIAMENTE técnicas distintas escolhidas entre:
- troca da autoridade/órgão competente por outro plausível, porém errado;
- omissão de requisito essencial previsto no texto;
- acréscimo de requisito, hipótese ou consequência NÃO prevista no texto;
- inversão entre regra geral e exceção;
- alteração de prazo, condição, sujeito ou consequência jurídica;
- confusão entre dever, faculdade, vedação e permissão ("deverá/poderá/é vedado/é facultado");
- transformação de hipótese específica em regra geral (ou vice-versa);
- verdade parcial com conclusão incorreta;
- mistura de conceitos próximos do próprio texto legal, sem recorrer a fonte externa.
NUNCA crie alternativa absurda, infantil, genérica ou obviamente falsa. NUNCA repita a mesma técnica de erro em duas alternativas da mesma questão.

============================================================
14. CONTROLE DE QUALIDADE SILENCIOSO (ANTES DE RESPONDER)
============================================================
Antes de emitir cada questão, confira internamente, sem expor o raciocínio: (1) a questão depende APENAS do TEXTO LEGAL OFICIAL; (2) existe EXATAMENTE uma alternativa correta; (3) cada alternativa incorreta tem erro objetivo identificável no texto; (4) o gabarito corresponde de fato à alternativa correta; (5) não há menção a Constituição, doutrina, jurisprudência, edital, PDF, internet ou conhecimento externo; (6) todos os artigos citados existem no texto fornecido; (7) a correta não está denunciada por tamanho, detalhamento ou linguagem diferente; (8) o enunciado é claro e não admite dupla interpretação; (9) não há repetição evidente de questões semelhantes; (10) o nível de dificuldade está compatível com o solicitado. Se qualquer item falhar, reescreva a questão antes de respondê-la.

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
   - EQUILÍBRIO DE COMPRIMENTO (OBRIGATÓRIO): as cinco alternativas devem ter comprimento SEMELHANTE. A alternativa CORRETA NÃO pode ser a visivelmente mais longa nem a visivelmente mais curta — isso entrega a resposta. Ajuste as alternativas (encurtando a correta ou detalhando as incorretas) até que todas fiquem com tamanho próximo.
5) DISTRIBUA o gabarito: não concentre todas as respostas na mesma letra.
6) O COMENTÁRIO segue a estrutura obrigatória definida no sistema.
7) COBERTURA INTEGRAL DA LEI: NÃO se limite aos dispositivos "famosos" ou mais cobrados. Conteúdos aparentemente secundários — disposições gerais, finais e transitórias, definições, prazos, vedações, atribuições acessórias, parágrafos e incisos de menor destaque — TAMBÉM podem cair na prova e DEVEM virar questões. Sempre que o artigo-alvo tiver trechos pouco explorados, priorize-os. Toda parte do texto legal é cobrável.


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

DIRETRIZES ESPECÍFICAS DA DISCIPLINA (${isManual ? "Edital nº 1/2026/GABCOM — CHOA BM 2026 CBMTO" : "Edital nº 001/2026 — CHOA/2026 PMTO"}) — obrigatórias:
${disc.diretrizes}

15. REGRAS DE SAÍDA — OBJETO JSON OBRIGATÓRIO (sem markdown, sem comentários, sem texto fora do objeto).
Campos obrigatórios por questão: "disciplina", "assunto", "dificuldade" (use "Fácil|Médio|Difícil"), "enunciado", "alt_a".."alt_e" (sem prefixo de letra), "gabarito" (0=A,1=B,2=C,3=D,4=E), "comentario" (4 seções rotuladas: **Comentário do professor:** / **Análise das alternativas:** com A–E individuais / **Dica de prova:** / **Base normativa:** — vide seção 12), "artigo_principal" ("Art. X"), "tipo_questao", "audit_techniques" (array), "difficulty_level" (use PREFERENCIALMENTE "hard"; use "advanced" quando o dispositivo não comportar maior sofisticação; só use "intermediate" se o dispositivo for de literalidade obrigatória), "cognitive_skill" (a habilidade dominante exigida: "interpretação normativa" | "aplicação prática" | "comparação entre dispositivos" | "identificação de exceção"), "trap_type" (frase curta explicando a pegadinha normativa central da questão — ex.: "ampliação indevida de competência do Comandante-Geral", "troca de prazo do art. X", "confusão entre regra geral e exceção do §"). Antes de emitir cada questão, valide internamente a matriz de prova jurídica (fonte única confirmada, exatamente uma correta, artigos citados existentes, correta não é a mais longa nem a mais curta, hierarquia conferida, sem ambiguidade, dificuldade de banca elite) — só inclua a questão se TODOS os itens passarem.
{"questions":[{"disciplina":"${disc.disciplina}","assunto":"...","dificuldade":"Fácil|Médio|Difícil","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"...","artigo_principal":"Art. X","tipo_questao":"literalidade|caso_pratico|competencia_hierarquia|excecao_regra|consequencia_juridica|combinacao_dispositivos|conceito_legal|completar_lacuna|identificar_incorreta","audit_techniques":["troca_autoridade","omissao_requisito","inversao_regra_excecao"],"difficulty_level":"advanced","cognitive_skill":"interpretação normativa","trap_type":"..."}]}

Se NÃO for possível gerar nenhuma questão válida com base EXCLUSIVA no TEXTO LEGAL OFICIAL, retorne {"questions":[],"erro":"NAO_FOI_POSSIVEL_GERAR_COM_FONTE_UNICA","motivo":"explique objetivamente o requisito que falhou, sem fonte externa."}`;

    // API call with retry logic
    // Lovable AI Gateway with google/gemini-2.5-flash is dramatically faster
    // than DeepSeek (typically 8-25s vs 50-90s for the same prompt).
    const MAX_API_RETRIES = 2;
    const PRIMARY_TIMEOUT_MS = useLovable ? (batchSize === 1 ? 35000 : 50000) : (batchSize === 1 ? 90000 : 110000);
    const RETRY_TIMEOUT_MS = useLovable ? (batchSize === 1 ? 30000 : 42000) : (batchSize === 1 ? 60000 : 70000);
    // Output token budget. DeepSeek Reasoner (R1) consome boa parte do orçamento
    // em raciocínio interno; com cap baixo o JSON trunca (finish_reason=length) → lote "+0".
    // Damos margem ampla; Gemini (fallback) ignora o excedente sem custo extra.
    const maxTokens = batchSize === 1 ? 5200 : 7000;

    // ===== Geração via camada de roteamento (aiRouter) =====
    // Etapa de ALTO risco jurídico → DeepSeek Reasoner (R1) como principal (mantém
    // complexidade), com deepseek-chat → Gemini → OpenRouter como fallbacks.
    let content = '{"questions":[]}';
    let finishReason = "stop";
    try {
      const genMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];
      const aiResult = await runAiStage("question_generation", genMessages, {
        jsonResponse: true,
        maxOutputTokensOverride: maxTokens,
        temperatureOverride: 0.25,
        timeoutMs: PRIMARY_TIMEOUT_MS,
        // Disciplinas jurídicas (tipo "lei"): alta complexidade → sabia-4.
        complexity: "high",
        metadata: { batchSize, disciplina: disc.disciplina },
        contentValidator: (c: string) => {
          try { return parseQuestionsFromModelContent(c).questions.length > 0; }
          catch { return false; }
        },
      });
      content = aiResult.content || '{"questions":[]}';
      finishReason = aiResult.raw?.choices?.[0]?.finish_reason || "stop";
      console.log(`[GERAR] OK via ${aiResult.provider}/${aiResult.model} (attempt ${aiResult.attemptIndex}) finish=${finishReason}`);
    } catch (genErr: any) {
      const msg = String(genErr?.message ?? genErr);
      const isCredit = /HTTP 402|insufficient|no credits|saldo|sem cr[eé]dito|quota|billing|exhaust/i.test(msg);
      const isRate = /HTTP 429|rate limit|too many requests/i.test(msg);
      const isTimeout = /abort|timeout/i.test(msg);
      console.error(`[GERAR] Falha em todas as tentativas de geração: ${msg}`);
      return new Response(JSON.stringify({
        status: "erro",
        mensagem: isCredit ? "Provedor de IA sem saldo/limite disponível."
          : isRate ? "Rate limit da IA."
          : isTimeout ? "A IA demorou demais para responder."
          : "Erro da IA na geração.",
        paused: isCredit || isRate,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: isCredit ? "AI_402" : isRate ? "RATE_LIMIT" : isTimeout ? "TIMEOUT" : "API_ERROR", descricao: msg.slice(0, 200) }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


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
        difficulty_level: (() => {
          const v = normalizeWhitespace(raw.difficulty_level).toLowerCase();
          return ["advanced", "hard", "intermediate"].includes(v) ? v : "hard";
        })(),
        cognitive_skill: normalizeWhitespace(raw.cognitive_skill) || null,
        trap_type: normalizeWhitespace(raw.trap_type) || null,
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

      // ===================================================================
      // FLUXO OFICIAL: gerar -> PENDENTES -> auditoria manual -> publicar/excluir
      // A partir daqui NÃO descartamos por qualidade/duplicidade. Apenas aplicamos
      // AUTO-FIXES seguros (reconciliação de artigo/snippet) e seguimos. Tudo é
      // inserido como audit_status='pending' para o admin auditar manualmente.
      // ===================================================================

      const gabIdx = Number(q.gabarito);
      const correctAltKey = ALT_KEYS[q.gabarito];
      const correctAltText = q[correctAltKey] as string;

      // ── Citation auto-fix (sem descarte) ──
      const literalArticle = findArticleForText(correctAltText, blocks);
      const evidenceArticle = detectCommentEvidenceArticle(q.comentario, blocks);
      const resolvedArticle = evidenceArticle || literalArticle;
      const citationCheck = validateAllCitations(q.comentario, blocks);
      if (!citationCheck.valid && resolvedArticle) {
        const reconciled = reconcileCommentArticle(q.comentario, resolvedArticle);
        if (validateAllCitations(reconciled, blocks).valid) {
          q.comentario = reconciled;
          console.log(`[GERAR] Q${idx+1} AUTO-FIX: artigo corrigido para ${resolvedArticle}`);
        }
      }

      // ── Garante citação mínima quando possível (sem descarte) ──
      if (extractAllCitedArticles(q.comentario).length === 0 && resolvedArticle) {
        q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
      }

      // ── Snippet auto-fix (sem descarte) ──
      const snippetCheck = verifySnippetBelongsToArticle(q.comentario, blocks);
      if (!snippetCheck.valid) {
        const { corrected: snippetFixed, appliedCorrections: snippetCorrs } = applyAllSnippetCorrections(q.comentario, blocks);
        if (snippetCorrs.length > 0 && validateAllCitations(snippetFixed, blocks).valid) {
          q.comentario = snippetFixed;
          console.log(`[GERAR] Q${idx+1} AUTO-FIX snippet: ${snippetCorrs.map(c => `${c.from}→${c.to}`).join(", ")}`);
        }
      }

      // ── Confronto de artigos: auto-fix (sem descarte) ──
      const commentCitedArticles = extractAllCitedArticles(q.comentario);
      if (literalArticle && commentCitedArticles.length > 0) {
        const literalArtNum = literalArticle.match(/\d+/)?.[0];
        if (literalArtNum && !commentCitedArticles.includes(literalArtNum)) {
          const reconciled = reconcileCommentArticle(q.comentario, literalArticle);
          if (extractAllCitedArticles(reconciled).includes(literalArtNum)) {
            q.comentario = reconciled;
            console.log(`[GERAR] Q${idx+1} AUTO-FIX confronto: artigo corrigido para ${literalArticle}`);
          }
        }
      }

      // ── Reconciliação final (sem descarte) ──
      if (resolvedArticle) {
        const resolvedNum = resolvedArticle.match(/\d+/)?.[0];
        const commentCitedArts = extractAllCitedArticles(q.comentario);
        if (resolvedNum && commentCitedArts.length > 0 && !commentCitedArts.includes(resolvedNum)) {
          q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
        }
      }

      // ── Assinatura semântica (apenas para metadados/dedup posterior; NÃO descarta) ──
      const newSig = await buildSemanticSignature(
        { enunciado: q.enunciado, alt_correta: correctAltText, comentario: q.comentario },
      );
      const artigoPrincipal = newSig.artigo || extractMainArticle(q.comentario);
      const artKey = normSigToken(artigoPrincipal) || "__sem_artigo__";

      q.assinatura_semantica = newSig;
      q.artigo_principal = artigoPrincipal || null;

      if (!existingByArticle.has(artKey)) existingByArticle.set(artKey, []);
      existingByArticle.get(artKey)!.push({ id: -1 - idx, assunto: q.assunto, signature: newSig, enunciado: q.enunciado });

      const approvedArts = extractAllCitedArticles(q.comentario);
      validQuestions.push(q);
      console.log(`[GERAR] Q${idx+1} ENVIADA PARA PENDENTES: ${approvedArts.map(a => `Art. ${a}`).join(", ")} | sig.artigo=${newSig.artigo}`);
    }


    // ===== AUDITORIA CRUZADA PÓS-GERAÇÃO (DESATIVADA) =====
    // Fluxo oficial: gerar questões -> enviar TODAS para a lista de PENDENTES (audit_status='pending').
    // A auditoria/correção é feita MANUALMENTE pelo admin na lista de pendentes (botão "Auditar selecionadas").
    // Por isso a auditoria automática durante a geração fica desligada — nada é descartado/corrigido aqui.
    const ENABLE_CROSS_AUDIT = false;
    let autoCorrigidas = 0;
    try {
    if (ENABLE_CROSS_AUDIT && validQuestions.length > 0) {
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
2. Existe outra alternativa também correta / defensável? Ou nenhuma correta? (múltiplas defensáveis ⇒ severidade 'high')
3. Algum distrator é absurdo / óbvio / vazio? Distratores devem ser tecnicamente próximos e plausíveis — distrator obviamente absurdo ⇒ 'high'.
4. Comentário cita base legal coerente com o gabarito?
5. Há afirmação claramente inventada (não apenas ausente do recorte)? Dependência de fonte externa (CF, doutrina, jurisprudência, outra lei não presente) ⇒ 'high'.
6. NÍVEL DE DIFICULDADE: a questão é fácil demais, óbvia, de mera memorização ou resolvível por eliminação grosseira? O enunciado é apenas uma CÓPIA literal do texto legal sem exigir interpretação? Se sim ⇒ severidade 'high' (type='facil_demais' ou 'enunciado_copiado'). Só tolere literalidade quando o dispositivo EXIGIR literalidade (definição fechada, prazo numérico, enumeração taxativa).
7. QUALIDADE DO COMENTÁRIO (cada questão deve ser uma AULA CURTA): o comentário explica POR QUE o gabarito está correto com fundamento no texto legal, analisa INDIVIDUALMENTE todas as 5 alternativas (A–E), traz uma dica de prova e indica a base normativa? Comentário raso, genérico, que apenas repete o gabarito, ou que NÃO analisa todas as alternativas ⇒ severidade 'medium' (type='comentario_raso'); se possível, proponha em proposed_patch.comentario uma versão completa no padrão "Comentário do professor / Análise das alternativas (A–E) / Dica de prova / Base normativa".


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
      if (cursoId) for (const q of validQuestions) (q as any).curso_id = cursoId;
      const { error: insertError } = await supabase.from("questoes").insert(validQuestions);
      if (insertError) {
        console.error("[GERAR] Insert error:", insertError.message);
        errosEncontrados.push({ codigo: "INSERT_ERROR", descricao: insertError.message });
      } else {
        insertedCount = validQuestions.length;
      }
    }

    const statusResult = insertedCount > 0 ? (errosEncontrados.length > 0 ? "parcial" : "sucesso") : "erro";
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
      success: insertedCount > 0, count: insertedCount, inserted: insertedCount, generated: insertedCount,
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
