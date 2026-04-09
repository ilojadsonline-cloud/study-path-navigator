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
        if (score < 0.3) {
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
  const cited = extractAllCitedArticles(comment);
  const missing: string[] = [];
  for (const artNum of cited) {
    if (!articleExistsInBlocks(artNum, blocks)) missing.push(`Art. ${artNum}`);
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

// 7 approach types for maximum diversity — cycled based on existing question count
const APPROACH_TYPES = [
  "TEORIA_PURA",
  "CASO_PRATICO",
  "PEGADINHA_DETALHE",
  "COMBINACAO_ARTIGOS",
  "JURISPRUDENCIA_APLICADA",
  "EXCECAO_REGRA",
  "INTERPRETACAO_SISTEMATICA",
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
    const { disciplina_index, batch_size } = await req.json();
    const requestedBatchSize = Number(batch_size) || 3;
    // Allow up to 5 questions per batch for creative diversity
    const batchSize = Math.max(1, Math.min(5, requestedBatchSize));
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

    if (ltError || !legalTextRow?.content) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: `Texto legal não encontrado para "${disc.disciplina}".`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_LEGAL_TEXT", descricao: `Faça upload para "${disc.disciplina}"` }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const leiSeca = legalTextRow.content;
    const blocks = parseArticleBlocks(leiSeca);
    const availableArticles = blocks.map(b => `Art. ${b.artNum}`).join(", ");

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "DEEPSEEK_API_KEY não configurada.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_API_KEY", descricao: "Variável DEEPSEEK_API_KEY ausente" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch existing questions for dedup
    const { data: existingQ } = await supabase
      .from("questoes").select("id, enunciado, comentario, alt_a, alt_b, alt_c, alt_d, alt_e, gabarito, assunto")
      .eq("disciplina", disc.disciplina).order("id", { ascending: false }).limit(1000);

    const existingFingerprints = new Set<string>();
    const existingSemanticFPs = new Set<string>();
    const existingForSimilarity: Array<{ id: number; enunciado: string }> = [];
    const articleCoverage = new Map<string, number>();
    const assuntoCoverage = new Map<string, number>();

    if (existingQ) {
      existingQ.forEach((eq) => {
        existingFingerprints.add(buildFingerprint(eq.enunciado));
        const correctKey = ALT_KEYS[Math.min(Math.max(eq.gabarito || 0, 0), 4)];
        const correctText = eq[correctKey] || "";
        existingSemanticFPs.add(buildSemanticFingerprint(eq.comentario || "", correctText));
        existingForSimilarity.push({ id: eq.id, enunciado: eq.enunciado });

        const arts = extractAllCitedArticles(eq.comentario || "");
        arts.forEach((a) => {
          articleCoverage.set(a, (articleCoverage.get(a) || 0) + 1);
        });
        
        const assunto = eq.assunto || "";
        if (assunto) assuntoCoverage.set(assunto, (assuntoCoverage.get(assunto) || 0) + 1);
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

    const approachInstructions = approachAssignments
      .map((a, i) => {
        const num = i + 1;
        switch (a) {
          case "TEORIA_PURA":
            return `Questão ${num}: LITERALIDADE COMPLEXA — Apresente uma situação em que o candidato precisa distinguir entre conceitos jurídicos SIMILARES previstos na lei. O enunciado deve conter uma premissa verdadeira e pedir que identifique a CONSEQUÊNCIA JURÍDICA correta. Alternativas incorretas usam termos da própria lei mas em contextos ERRADOS (troca de sujeito, de condição ou de efeito jurídico).`;
          case "CASO_PRATICO":
            return `Questão ${num}: CASO PRÁTICO COMPLEXO (estilo CESPE/FGV) — Crie um cenário DETALHADO (4-6 linhas) com MÚLTIPLOS ELEMENTOS relevantes: personagem com posto/graduação coerente, circunstância temporal, condição específica e um dilema jurídico. O candidato deve analisar TODOS os elementos para chegar à resposta. Inclua detalhes que funcionem como ARMADILHAS para quem não lê com atenção. Ex: prazos que quase se confundem, competências que parecem sobrepostas, condições cumulativas.`;
          case "PEGADINHA_DETALHE":
            return `Questão ${num}: PEGADINHA SOFISTICADA (estilo CESPE) — Construa alternativas que diferem em apenas UMA PALAVRA juridicamente decisiva: "deverá/poderá", "vedado/facultado", "cumulativamente/alternativamente", "suspensão/demissão". O enunciado deve ser longo o suficiente (3-4 linhas) para distrair o candidato do detalhe crítico. A alternativa correta é LITERAL; as incorretas são QUASE corretas.`;
          case "COMBINACAO_ARTIGOS":
            return `Questão ${num}: COMBINAÇÃO AVANÇADA DE DISPOSITIVOS (estilo FGV) — Elabore questão que exija RACIOCÍNIO EM CADEIA: o candidato precisa identificar a regra geral (Art. X), verificar se há exceção (Art. Y) e aplicar o resultado ao caso concreto. O enunciado deve narrar uma situação que, à primeira vista, parece se enquadrar numa regra, mas na verdade se encaixa em outra. As alternativas incorretas aplicam os dispositivos isoladamente.`;
          case "JURISPRUDENCIA_APLICADA":
            return `Questão ${num}: CONSEQUÊNCIAS JURÍDICAS ENCADEADAS (estilo VUNESP) — Apresente uma sequência de fatos (ação → consequência → desdobramento) e pergunte qual é o resultado jurídico FINAL conforme a lei. O candidato precisa percorrer TODA a cadeia normativa. As alternativas incorretas interrompem a cadeia em diferentes pontos ou aplicam consequências de situações SIMILARES mas distintas.`;
          case "EXCECAO_REGRA":
            return `Questão ${num}: EXCEÇÃO DENTRO DA EXCEÇÃO (estilo CESPE/FCC) — Explore situações onde há REGRA GERAL → EXCEÇÃO → RESSALVA À EXCEÇÃO. O enunciado deve descrever um caso que se enquadra (ou não) na exceção, e o candidato deve determinar qual regime jurídico se aplica. Use "NÃO constitui exceção à regra...", "Aplica-se a regra geral, EXCETO quando...", "A ressalva prevista NÃO se aplica ao caso de...".`;
          case "INTERPRETACAO_SISTEMATICA":
            return `Questão ${num}: INTERPRETAÇÃO TELEOLÓGICA E SISTEMÁTICA — Elabore questão que exija compreensão da FINALIDADE do instituto jurídico e sua RELAÇÃO com outros dispositivos da mesma lei. O candidato deve demonstrar que entende o PORQUÊ da norma, não apenas o QUÊ. Pergunte sobre a ratio legis, o bem jurídico protegido ou a coerência do sistema normativo. As incorretas confundem a finalidade com a de institutos similares.`;
        }
      })
      .join("\n\n");

    // System prompt: define the AI persona as an elite exam board
    const systemPrompt = `Você é uma BANCA EXAMINADORA DE ALTÍSSIMO NÍVEL para concursos militares (CFO/CHOA), com o rigor intelectual das bancas CESPE/CEBRASPE, FGV e VUNESP em suas provas mais difíceis.

NÍVEL DE COMPLEXIDADE EXIGIDO: ALTO
Suas questões devem exigir RACIOCÍNIO JURÍDICO AVANÇADO. Não basta conhecer o artigo — o candidato precisa INTERPRETAR, COMBINAR e APLICAR dispositivos legais a situações complexas.

TÉCNICAS DE ELEVAÇÃO DE COMPLEXIDADE (use obrigatoriamente):
1. ENUNCIADOS LONGOS E CONTEXTUALIZADOS: Crie cenários com 3-6 linhas, detalhando circunstâncias, condições e exceções que exijam análise cuidadosa antes de responder.
2. ALTERNATIVAS COM GRADAÇÃO DE CORREÇÃO: Todas as 5 alternativas devem parecer plausíveis a um candidato mediano. A diferença entre a correta e as incorretas deve residir em DETALHES JURÍDICOS SUTIS — uma palavra, um prazo, uma condição, uma competência.
3. RACIOCÍNIO MULTINÍVEL: Questões que exijam pelo menos 2 etapas de raciocínio (ex: identificar a regra aplicável E depois verificar se há exceção; ou combinar dois dispositivos para chegar à conclusão).
4. ARMADILHAS INTELIGENTES: Use alternativas que invertem sutilmente a regra (ex: trocar "vedado" por "facultado"), que misturam competências de autoridades diferentes, que alteram condições ou prazos, ou que aplicam regra geral onde há exceção.
5. CONTEXTUALIZAÇÃO MILITAR REALISTA: Cenários devem envolver situações operacionais verossímeis com postos, graduações e cargos FIÉIS à hierarquia da lei. Use nomes fictícios para personagens.
6. INTERSEÇÃO DE DISPOSITIVOS: Sempre que possível, elabore questões que exijam conhecimento de MAIS DE UM dispositivo legal para chegar à resposta correta.

PRINCÍPIOS FUNDAMENTAIS:
1. CRIATIVIDADE COM PRECISÃO: Explore ângulos inéditos do dispositivo legal — consequências implícitas, condições cumulativas, ressalvas pouco percebidas, interações com outros artigos.
2. HIERARQUIA MILITAR: RESPEITE ABSOLUTAMENTE a cadeia de comando conforme o texto legal. Se a lei diz "Comandante-Geral", use Comandante-Geral.
3. FIDELIDADE AO TEXTO LEGAL: A alternativa correta DEVE estar fundamentada LITERALMENTE no texto da lei. NUNCA invente regras que não existem no texto.
4. PROIBIÇÃO DE DECOREBA: NUNCA cite números de artigos no enunciado. O candidato demonstra COMPREENSÃO, não memorização.
5. CADA QUESTÃO É ÚNICA: Varie estilo, estrutura, tipo de raciocínio e padrão de enunciado em CADA questão.

ESTRUTURA DO COMENTÁRIO (obrigatória e detalhada — estilo professor explicando ao aluno):
a) IDENTIFICAÇÃO DO FUNDAMENTO: Comece com "Conforme o Art. X da [nome da lei]:" seguido da transcrição LITERAL do trecho que fundamenta a resposta correta. O número do artigo DEVE ser verificado: localize o texto exato na lei e use o número do artigo onde ele realmente aparece. Se o trecho está no Art. 33, cite Art. 33 — NUNCA cite um artigo diferente.
b) EXPLICAÇÃO DA CORRETA: Explique POR QUE a alternativa correta está certa, conectando cada elemento da alternativa ao texto literal da lei.
c) ANÁLISE INDIVIDUALIZADA DE CADA INCORRETA (OBRIGATÓRIO — NÃO PULE NENHUMA):
   - Para a alternativa A (se incorreta): "A alternativa A está incorreta porque afirma '[trecho errado]', quando na verdade a lei dispõe que '[trecho correto da lei]'."
   - Para a alternativa B (se incorreta): idem
   - Para a alternativa C (se incorreta): idem
   - Para a alternativa D (se incorreta): idem
   - Para a alternativa E (se incorreta): idem
   Cada explicação deve indicar QUAL SERIA o correto conforme a lei.
d) CONCLUSÃO PEDAGÓGICA: Feche com uma frase que sintetize o ponto-chave que o candidato deveria dominar.

REGRA CRÍTICA PARA NÚMEROS DE ARTIGOS NO COMENTÁRIO:
- Antes de citar "Art. X", LOCALIZE o trecho literal no texto legal e verifique em qual artigo ele realmente aparece.
- Se o trecho sobre "exclusão de QA" está no Art. 33, cite Art. 33 — JAMAIS cite Art. 19 ou outro número.
- O número do artigo NÃO é um detalhe menor: um artigo errado invalida toda a questão.

Responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown e sem texto fora do JSON, no formato {"questions":[...]}.`;

    // Build the full legal context — send up to 18KB of law text for systemic understanding
    const legalContextTruncated = truncateLegalText(leiSeca, 18000);

    const prompt = `Gere exatamente ${batchSize} questões de múltipla escolha para "${disc.disciplina}" (${disc.leiNome}).

ARTIGOS-ALVO PRIORITÁRIOS (use como base principal, mas pode referenciar outros artigos da mesma lei quando necessário para contexto):
${selectedTargets.map(({ block }, idx) => `${idx + 1}) Questão ${idx + 1}: base no Art. ${block.artNum}`).join("\n")}

TEXTO LEGAL DE REFERÊNCIA (artigos-alvo com contexto):
${targetArticlesBlock}

TEXTO LEGAL COMPLETO PARA CONSULTA (use para garantir coerência sistêmica):
${legalContextTruncated}
${coverageGuidanceBlock}

ASSUNTOS MENOS EXPLORADOS (priorize): ${leastCoveredAssuntos}

ABORDAGEM OBRIGATÓRIA POR QUESTÃO:
${approachInstructions}

MÉTODO DE CRIAÇÃO:
1) Cada questão DEVE ter como BASE PRINCIPAL o artigo-alvo, mas PODE e DEVE referenciar outros artigos quando a situação exigir interpretação conjunta.
2) Explore DIFERENTES ASPECTOS do artigo: caput, incisos, parágrafos, exceções, condições, prazos, competências, sujeitos.
3) VARIE o estilo de redação: perguntas diretas, asserções para julgar, cenários para analisar, situações para classificar.
4) Crie 5 alternativas (A-E) sem prefixo de letra:
   - A CORRETA reflete LITERALMENTE o que a lei dispõe.
   - As INCORRETAS usam TROCAS SUTIS: verbos (deverá/poderá), prazos, condições, sujeitos, autoridades competentes.
   - CADA alternativa incorreta deve ter um erro DIFERENTE e SUTIL.
5) DISTRIBUA o gabarito: não concentre todas as respostas na mesma letra.
6) O COMENTÁRIO segue a estrutura obrigatória definida no sistema.

PROIBIÇÕES ABSOLUTAS NO ENUNCIADO:
- "O que diz o Art. X?", "Qual artigo trata de...", "Segundo o Art. X, ...", "De acordo com o Art. X, ..."
- Qualquer menção direta ao número de artigo no enunciado.

REGRAS TÉCNICAS:
- Artigos existentes na lei: ${availableArticles}
- Cite SOMENTE artigos que existam na lei acima.
- gabarito = inteiro: 0=A, 1=B, 2=C, 3=D, 4=E.
- Distribua dificuldade: ~15% Fácil, ~40% Médio, ~45% Difícil. PRIORIZE questões de nível Médio e Difícil.
- Assuntos possíveis: ${disc.assuntos.join(", ")}

OBJETO JSON OBRIGATÓRIO (sem markdown e sem qualquer texto fora do objeto):
{"questions":[{"disciplina":"${disc.disciplina}","assunto":"...","dificuldade":"Fácil|Médio|Difícil","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"..."}]}`;

    // API call with retry logic
    const MAX_API_RETRIES = 2;
    const DEEPSEEK_TIMEOUT_MS = 110000; // 110s — within Supabase 150s limit
    let aiStatus: number | null = null;
    let aiResponseText = "";
    let lastFetchError: any = null;

    // Larger output budget — rich comments need space for per-alternative analysis.
    const maxTokens = Math.min(6000, 2000 + batchSize * 1100);

    for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

      try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: maxTokens,
            temperature: 0.15,
          }),
          signal: controller.signal,
        });
        aiStatus = response.status;
        console.log(`[GERAR] DeepSeek status: ${aiStatus}, attempt ${attempt + 1}`);
        aiResponseText = await response.text();
        clearTimeout(timeoutId);

        if (aiStatus === 429 && attempt < MAX_API_RETRIES - 1) {
          const retryDelay = 5000 * Math.pow(2, attempt);
          console.log(`[GERAR] Rate limit 429, retry em ${retryDelay}ms`);
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }

        if (aiStatus && aiStatus >= 500 && attempt < MAX_API_RETRIES - 1) {
          const retryDelay = 3000 * Math.pow(2, attempt);
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
          const retryDelay = 4000 * Math.pow(2, attempt);
          console.log(`[GERAR] ${isTimeout ? "Timeout" : "Fetch error"}, retry em ${retryDelay}ms: ${String(fetchErr)}`);
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }
      }
    }

    if (!aiResponseText) {
      const isTimeout = lastFetchError?.name === "AbortError";
      console.error(`[GERAR] Todas as tentativas falharam:`, String(lastFetchError));
      return new Response(JSON.stringify({
        status: "erro", mensagem: isTimeout ? "DeepSeek demorou demais para responder." : `Erro de conexão: ${lastFetchError?.message}`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: isTimeout ? "TIMEOUT" : "FETCH_ERROR", descricao: String(lastFetchError) }] },
        error: String(lastFetchError), timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (aiStatus === 429) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Rate limit do DeepSeek.", paused: true,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "RATE_LIMIT", descricao: "Aguarde 1 minuto" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (aiStatus === 402) {
      let creditMessage = "Créditos insuficientes no DeepSeek.";
      try {
        const parsed = JSON.parse(aiResponseText);
        creditMessage = parsed?.error?.message || creditMessage;
      } catch { /* ignore */ }
      return new Response(JSON.stringify({
        status: "erro", mensagem: "DeepSeek sem saldo/limite disponível.", paused: true,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "DEEPSEEK_402", descricao: creditMessage }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!aiStatus || aiStatus < 200 || aiStatus >= 300) {
      console.error(`[GERAR] DeepSeek error: ${aiStatus} ${aiResponseText.substring(0, 300)}`);
      return new Response(JSON.stringify({
        status: "erro", mensagem: `Erro DeepSeek (${aiStatus ?? "desconhecido"})`,
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

      // ── Anti-decoreba ──
      const decoreba = /\b(o\s+que\s+(diz|dispõe|estabelece|prevê)\s+o\s+art|qual\s+(o\s+)?artigo|segundo\s+o\s+art[\.\s]*\d|de\s+acordo\s+com\s+o\s+art[\.\s]*\d|conforme\s+o\s+art[\.\s]*\d|nos\s+termos\s+do\s+art[\.\s]*\d)/i;
      if (decoreba.test(q.enunciado.toLowerCase())) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: decoreba`); continue;
      }

      // ── Fingerprint dedup ──
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

      // ── Similarity dedup ──
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

      // ── Snippet-article verification: quoted text must belong to cited article ──
      const snippetCheck = verifySnippetBelongsToArticle(q.comentario, blocks);
      if (!snippetCheck.valid) {
        // Try auto-correction
        const { corrected: snippetFixed, appliedCorrections: snippetCorrs } = applyAllSnippetCorrections(q.comentario, blocks);
        if (snippetCorrs.length > 0) {
          const reVerify = verifySnippetBelongsToArticle(snippetFixed, blocks);
          const reCheck = validateAllCitations(snippetFixed, blocks);
          if (reVerify.valid && reCheck.valid) {
            q.comentario = snippetFixed;
            console.log(`[GERAR] Q${idx+1} AUTO-FIX snippet: ${snippetCorrs.map(c => `${c.from}→${c.to}`).join(", ")}`);
          } else {
            discarded++;
            questoesRevisaoManual.push({ motivo: `Snippet-artigo mismatch: ${snippetCheck.mismatches[0]}` });
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

      // ── Cross-validation ──
      const crossCheck = crossValidateReferences(q.enunciado, q.comentario);
      if (!crossCheck.valid) {
        discarded++;
        questoesRevisaoManual.push({ motivo: crossCheck.reason });
        console.log(`[GERAR] Q${idx+1} descartada: ${crossCheck.reason}`);
        continue;
      }

      // ── Literal proof check ──
      const normCorrectAlt = normalize(correctAltText);
      const correctAltWords = normCorrectAlt.split(" ").filter(w => w.length > 3);
      let literalProofScore = 0;
      if (correctAltWords.length > 0) {
        const lawNorm = normalize(leiSeca);
        let matchedWords = 0;
        for (const word of correctAltWords) {
          if (lawNorm.includes(word)) matchedWords++;
        }
        literalProofScore = matchedWords / correctAltWords.length;
      }
      if (literalProofScore < 0.5) {
        discarded++;
        questoesRevisaoManual.push({ motivo: `Prova literal insuficiente (${literalProofScore.toFixed(2)})` });
        console.log(`[GERAR] Q${idx+1} descartada: prova literal ${literalProofScore.toFixed(2)} < 0.5`);
        continue;
      }

      // ── Final reconciliation ──
      if (resolvedArticle) {
        const resolvedNum = resolvedArticle.match(/\d+/)?.[0];
        const commentCitedArts = extractAllCitedArticles(q.comentario);
        if (resolvedNum && commentCitedArts.length > 0 && !commentCitedArts.includes(resolvedNum)) {
          q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
        }
      }

      const approvedArts = extractAllCitedArticles(q.comentario);
      validQuestions.push(q);
      console.log(`[GERAR] Q${idx+1} APROVADA: ${approvedArts.map(a => `Art. ${a}`).join(", ")} (literal: ${literalProofScore.toFixed(2)})`);
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
        questoes_corrigidas: 0,
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
