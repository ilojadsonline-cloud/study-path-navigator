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

/** Build a semantic fingerprint: article number + key legal terms from comment/answer.
 *  Two questions about the same article and same legal concept will collide. */
function buildSemanticFingerprint(comentario: string, correctAltText: string): string {
  const arts = extractAllCitedArticles(comentario);
  const artPart = arts.sort().join(",");
  // Extract key legal terms from the correct answer (normalized, sorted, deduped)
  const keyTerms = normalize(correctAltText)
    .split(" ")
    .filter(w => w.length > 4)
    .sort()
    .slice(0, 8)
    .join(" ");
  return `${artPart}|${keyTerms}`.substring(0, 100);
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

const APPROACH_TYPES = [
  "TEORIA_PURA",       // Literalidade da lei
  "CASO_PRATICO",      // Cenário hipotético
  "PEGADINHA_DETALHE",  // Troca de termos sutis
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const timestamp = new Date().toISOString();
  const questoesRevisaoManual: Array<{ id?: string; motivo: string }> = [];
  const errosEncontrados: Array<{ codigo: string; descricao: string }> = [];

  try {
    const { disciplina_index, batch_size } = await req.json();
    const batchSize = batch_size || 10;
    const discIndex = disciplina_index ?? 0;

    if (discIndex < 0 || discIndex >= DISCIPLINES.length) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Índice de disciplina inválido.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_INDEX", descricao: `Índice ${discIndex} fora do range 0-${DISCIPLINES.length - 1}` }] },
        timestamp,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch existing questions for dedup (fingerprint + semantic)
    const { data: existingQ } = await supabase
      .from("questoes").select("enunciado, comentario, alt_a, alt_b, alt_c, alt_d, alt_e, gabarito")
      .eq("disciplina", disc.disciplina).order("id", { ascending: false }).limit(500);
    
    const existingFingerprints = new Set<string>();
    const existingSemanticFPs = new Set<string>();
    const recentTopicSummaries: string[] = [];
    
    if (existingQ) {
      existingQ.forEach((eq, idx) => {
        existingFingerprints.add(buildFingerprint(eq.enunciado));
        // Build semantic fingerprint from comment + correct answer
        const correctKey = ALT_KEYS[Math.min(Math.max(eq.gabarito || 0, 0), 4)];
        const correctText = eq[correctKey] || "";
        existingSemanticFPs.add(buildSemanticFingerprint(eq.comentario || "", correctText));
        // Collect last 50 summaries for the prompt
        if (idx < 50) {
          const arts = extractAllCitedArticles(eq.comentario || "");
          const artRef = arts.length > 0 ? `Art. ${arts[0]}` : "?";
          // Truncate enunciado to key phrase
          const shortEnunciado = eq.enunciado.substring(0, 80).replace(/\s+/g, " ");
          recentTopicSummaries.push(`- ${artRef}: ${shortEnunciado}`);
        }
      });
    }

    console.log(`[GERAR] Iniciando: "${disc.disciplina}", batch=${batchSize}, artigos=${blocks.length}, existentes=${existingQ?.length || 0}, semânticas=${existingSemanticFPs.size}`);

    // Assign approach types to each question in the batch
    const approachAssignments: string[] = [];
    for (let i = 0; i < batchSize; i++) {
      approachAssignments.push(APPROACH_TYPES[i % 3]);
    }

    const recentTopicsBlock = recentTopicSummaries.length > 0
      ? `\n\nQUESTÕES JÁ EXISTENTES (NÃO REPITA o mesmo núcleo jurídico — artigo + regra + resposta):\n${recentTopicSummaries.join("\n")}\n\nSe já existe questão sobre determinado inciso/parágrafo/regra, ESCOLHA outro dispositivo da mesma lei. A diversidade de artigos abordados é OBRIGATÓRIA.`
      : "";

    const approachInstructions = approachAssignments.map((a, i) => {
      const num = i + 1;
      switch (a) {
        case "TEORIA_PURA":
          return `Questão ${num}: TEORIA PURA — Teste a literalidade da lei. O enunciado apresenta uma afirmativa e o candidato deve identificar se está de acordo com a lei. Use "Sobre [tema], é correto afirmar que..." ou "Assinale a alternativa correta sobre [tema]".`;
        case "CASO_PRATICO":
          return `Questão ${num}: CASO PRÁTICO — Crie um cenário hipotético detalhado (2-3 linhas) com personagem fictício (Soldado Silva, Cabo Pereira, etc.) em situação concreta do cotidiano militar. O candidato deve APLICAR a regra da lei ao caso.`;
        case "PEGADINHA_DETALHE":
          return `Questão ${num}: PEGADINHA DE DETALHE — Foque em termos que geram confusão: "deverá" vs "poderá", "vedado" vs "facultado", "exclusivamente" vs "preferencialmente", inversão de prazos, troca de competências. A alternativa correta é literal; as incorretas trocam UM detalhe sutil.`;
      }
    }).join("\n");

    const systemPrompt = `Você é um PROFESSOR DE CONCURSO MILITAR de elite, especialista em criar questões que testam a COMPREENSÃO PRÁTICA da lei, não a memorização de números de artigos.

REGRAS INVIOLÁVEIS DE CONTEÚDO:
- NUNCA invente, alucine ou fabrique artigos, parágrafos, incisos ou trechos de lei.
- Use EXCLUSIVAMENTE o texto legal fornecido. É TERMINANTEMENTE PROIBIDO usar conhecimento externo.
- ANTES de citar qualquer "Art. X", CONFIRME que esse artigo existe na lista de artigos disponíveis.
- Responda APENAS com JSON válido, sem markdown, sem \`\`\`.

REGRAS PEDAGÓGICAS (CRÍTICAS):
1. PROIBIDO DECOREBA DE NÚMERO: NUNCA crie questões do tipo "O que dispõe o Art. X?", "Qual artigo trata de Y?", "Segundo o Art. X, ...". O número do artigo aparece SOMENTE no comentário como fundamentação.
2. O comentário é a PROVA REAL: deve citar artigo, parágrafo e inciso EXATAMENTE como estão na lei seca, com transcrição literal. NUNCA interprete criativamente.
3. DISTRATORES FORTES: As alternativas incorretas devem ser PLAUSÍVEIS — baseadas em interpretações erradas comuns da própria lei, não em absurdos óbvios.
4. TOM PROFISSIONAL E DESAFIADOR: Estilo de banca examinadora séria (CESPE/CEBRASPE, FGV).
5. PRIORIZE QUESTÕES COMPLEXAS: Questões que envolvem problemáticas práticas, conflitos entre dispositivos legais, exceções às regras gerais, e situações-limite são MAIS VALIOSAS que questões simples.

REGRA DE UNICIDADE SEMÂNTICA (CRÍTICA):
- Cada questão DEVE abordar um DISPOSITIVO LEGAL DIFERENTE (artigo, parágrafo, inciso distinto).
- Se duas questões abordam o mesmo artigo, elas DEVEM tratar de parágrafos/incisos/regras DIFERENTES daquele artigo.
- É PROIBIDO gerar questões que tenham a mesma resposta correta ou testem o mesmo conceito jurídico, mesmo com enunciados diferentes.

ARTIGOS DISPONÍVEIS NESTA LEI: ${availableArticles}
ATENÇÃO: Cite SOMENTE artigos desta lista. Qualquer artigo fora desta lista é PROIBIDO.`;

    const truncatedLei = leiSeca.substring(0, 18000);

    const prompt = `Gere exatamente ${batchSize} questões de múltipla escolha para "${disc.disciplina}" (${disc.leiNome}).

TEXTO LEGAL (trecho principal):
${truncatedLei}

ABORDAGEM OBRIGATÓRIA POR QUESTÃO (alterne rigorosamente):
${approachInstructions}
${recentTopicsBlock}

MÉTODO DE CRIAÇÃO (siga rigorosamente):
1) Escolha um artigo/parágrafo/inciso do texto legal acima QUE AINDA NÃO FOI ABORDADO nas questões existentes.
2) Identifique a REGRA DE CONDUTA que ele estabelece (o que é obrigatório, proibido, facultado, os prazos, as condições).
3) Siga a ABORDAGEM OBRIGATÓRIA designada para cada questão (TEORIA PURA, CASO PRÁTICO ou PEGADINHA DE DETALHE).
4) Crie 5 alternativas (A-E) sem prefixo de letra:
   - A CORRETA deve refletir LITERALMENTE o que a lei diz.
   - As INCORRETAS devem usar TROCADILHOS SUTIS: trocar verbos (deverá/poderá), inverter prazos, alterar condições, mudar sujeitos.
5) O COMENTÁRIO deve: "Conforme o Art. X da ${disc.leiNome}: '[transcrição literal do trecho]'." — citando artigo, parágrafo e inciso exatamente como na lei seca.

PROIBIÇÕES ABSOLUTAS NO ENUNCIADO:
- "O que diz o Art. X?"
- "Qual artigo trata de...?"  
- "Segundo o Art. X, ..."
- "De acordo com o Art. X, ..."
- Qualquer menção direta ao número de artigo no enunciado.

REGRAS TÉCNICAS:
- Cite SOMENTE artigos da lista: ${availableArticles}
- gabarito = inteiro: 0=A, 1=B, 2=C, 3=D, 4=E.
- Distribua: ~30% Fácil, ~50% Médio, ~20% Difícil.
- Assuntos possíveis: ${disc.assuntos.join(", ")}

JSON array:
[{"disciplina":"${disc.disciplina}","assunto":"...","dificuldade":"Fácil|Médio|Difícil","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"Conforme o Art. X da ${disc.leiNome}: '...'"}]`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === "AbortError";
      console.error(`[GERAR] Fetch ${isTimeout ? "timeout" : "error"}:`, String(fetchErr));
      return new Response(JSON.stringify({
        status: "erro", mensagem: isTimeout ? "DeepSeek demorou demais (timeout 50s). Tente com menos questões." : `Erro de conexão: ${fetchErr.message}`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: isTimeout ? "TIMEOUT" : "FETCH_ERROR", descricao: String(fetchErr) }] },
        error: String(fetchErr), timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    clearTimeout(timeoutId);

    console.log(`[GERAR] DeepSeek status: ${aiResponse.status}`);

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Rate limit do DeepSeek.", paused: true,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "RATE_LIMIT", descricao: "Aguarde 1 minuto" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[GERAR] DeepSeek error: ${aiResponse.status} ${errText.substring(0, 300)}`);
      return new Response(JSON.stringify({
        status: "erro", mensagem: `Erro DeepSeek (${aiResponse.status})`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "API_ERROR", descricao: errText.substring(0, 200) }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let rawQuestions;
    try {
      rawQuestions = JSON.parse(content);
    } catch {
      console.error("[GERAR] JSON parse failed:", content.substring(0, 200));
      return new Response(JSON.stringify({
        status: "erro", mensagem: "IA retornou JSON inválido.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_JSON", descricao: "JSON inválido" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validQuestions = [];
    let discarded = 0;
    const batchFingerprints = new Set<string>();
    const batchSemanticFPs = new Set<string>();

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

      // ── Anti-decoreba check ──
      const decoreba = /\b(o\s+que\s+(diz|dispõe|estabelece|prevê)\s+o\s+art|qual\s+(o\s+)?artigo|segundo\s+o\s+art[\.\s]*\d|de\s+acordo\s+com\s+o\s+art[\.\s]*\d|conforme\s+o\s+art[\.\s]*\d|nos\s+termos\s+do\s+art[\.\s]*\d)/i;
      if (decoreba.test(q.enunciado.toLowerCase())) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: decoreba (cita artigo no enunciado)`); continue;
      }

      // ── Text fingerprint duplicate detection ──
      const fp = buildFingerprint(q.enunciado);
      if (existingFingerprints.has(fp) || batchFingerprints.has(fp)) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: duplicata textual`); continue;
      }
      batchFingerprints.add(fp);

      // ── Semantic fingerprint duplicate detection ──
      const correctAltKey = ALT_KEYS[q.gabarito];
      const correctAltText = q[correctAltKey] as string;
      const semFP = buildSemanticFingerprint(q.comentario, correctAltText);
      if (existingSemanticFPs.has(semFP) || batchSemanticFPs.has(semFP)) {
        discarded++; console.log(`[GERAR] Q${idx+1} descartada: duplicata semântica (mesmo artigo + conceito)`); continue;
      }
      batchSemanticFPs.add(semFP);

      // ── Validate ALL cited articles exist in law ──
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
            questoesRevisaoManual.push({ motivo: `Artigos inexistentes: ${recheck.missing.join(", ")} (auto-correção falhou)` });
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

      // ── Validate at least one article is cited ──
      const citedArts = extractAllCitedArticles(q.comentario);
      if (citedArts.length === 0) {
        if (resolvedArticle) {
          q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
        }
      }

      const finalCitedArts = extractAllCitedArticles(q.comentario);
      if (finalCitedArts.length === 0) {
        discarded++;
        questoesRevisaoManual.push({ motivo: "Comentário sem citação de artigo" });
        console.log(`[GERAR] Q${idx+1} descartada: sem artigo no comentário`);
        continue;
      }

      // ── Cross-validation: enunciado vs comment ──
      const crossCheck = crossValidateReferences(q.enunciado, q.comentario);
      if (!crossCheck.valid) {
        discarded++;
        questoesRevisaoManual.push({ motivo: crossCheck.reason });
        console.log(`[GERAR] Q${idx+1} descartada: ${crossCheck.reason}`);
        continue;
      }

      // ── Verify correct answer text is in the law ──
      if (resolvedArticle) {
        const resolvedNum = resolvedArticle.match(/\d+/)?.[0];
        const commentCitedArts = extractAllCitedArticles(q.comentario);
        if (resolvedNum && commentCitedArts.length > 0 && !commentCitedArts.includes(resolvedNum)) {
          console.log(`[GERAR] Q${idx+1} AUTO-FIX: comentário cita Art. ${commentCitedArts.join(",")} mas evidência aponta para ${resolvedArticle}`);
          q.comentario = reconcileCommentArticle(q.comentario, resolvedArticle);
        }
      }

      const approvedArts = extractAllCitedArticles(q.comentario);
      validQuestions.push(q);
      console.log(`[GERAR] Q${idx+1} APROVADA: ${approvedArts.map(a => `Art. ${a}`).join(", ")} ${resolvedArticle ? `(conferido: ${resolvedArticle})` : ""}`);
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
      status: statusResult,
      mensagem,
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
