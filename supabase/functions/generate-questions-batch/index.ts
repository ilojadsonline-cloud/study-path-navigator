import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;

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

/** Extract ALL article numbers cited in text */
function extractAllCitedArticles(text: string): string[] {
  const matches = text.match(/Art\.?\s*(\d+)/gi) || [];
  return [...new Set(matches.map(m => m.match(/\d+/)?.[0] || "").filter(Boolean))];
}

/** Check if a specific article number exists in the law text */
function articleExistsInLaw(artNum: string, lawText: string): boolean {
  const lower = lawText.toLowerCase();
  return lower.includes(`art. ${artNum}`) || lower.includes(`artigo ${artNum}`) || lower.includes(`art ${artNum}`);
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
      // Walk backwards in ORIGINAL law to find nearest Art.
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

/** Validate that ALL cited articles in a comment exist in the law text */
function validateAllCitations(comment: string, lawText: string): { valid: boolean; missing: string[] } {
  const cited = extractAllCitedArticles(comment);
  const missing: string[] = [];
  for (const artNum of cited) {
    if (!articleExistsInLaw(artNum, lawText)) missing.push(`Art. ${artNum}`);
  }
  return { valid: missing.length === 0, missing };
}

/** Cross-validate: enunciado/alts reference same law as comment */
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

    // Fetch legal text — MANDATORY
    const { data: legalTextRow, error: ltError } = await supabase
      .from("discipline_legal_texts").select("content").eq("disciplina", disc.disciplina).single();

    if (ltError || !legalTextRow?.content) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: `Texto legal não encontrado para "${disc.disciplina}".`,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_LEGAL_TEXT", descricao: `Faça upload em /admin/textos-legais para "${disc.disciplina}"` }] },
        timestamp,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const leiSeca = legalTextRow.content;
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "DEEPSEEK_API_KEY não configurada.",
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "NO_API_KEY", descricao: "Variável DEEPSEEK_API_KEY ausente" }] },
        timestamp,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[GERAR] Iniciando geração: disciplina="${disc.disciplina}", batch_size=${batchSize}`);

    const systemPrompt = `Você é um especialista jurídico EXTREMAMENTE PRECISO em concursos militares. Sua prioridade ABSOLUTA é a fidelidade literal ao texto legal fornecido.

REGRAS INVIOLÁVEIS:
- NUNCA invente, alucine ou fabrique artigos, parágrafos, incisos ou trechos de lei.
- Se você NÃO encontrar uma citação LITERAL no texto legal fornecido, NÃO A CITE.
- O comentário é uma PROVA IRREFUTÁVEL da alternativa correta. Ele DEVE conter a transcrição literal ou paráfrase fiel do dispositivo legal que fundamenta a resposta.
- ANTES de citar qualquer "Art. X", CONFIRME que esse artigo existe no texto fornecido. Se não existir, NÃO CITE.
- O comentário DEVE referenciar EXATAMENTE a mesma lei e artigo que o enunciado menciona. Divergência = ERRO GRAVE.
- Responda APENAS com JSON válido, sem markdown, sem \`\`\`.`;

    const prompt = `Gere exatamente ${batchSize} questões de múltipla escolha para "${disc.disciplina}" (${disc.leiNome}).

TEXTO LEGAL COMPLETO — ESTA É SUA ÚNICA E EXCLUSIVA FONTE DE VERDADE:
${leiSeca.substring(0, 35000)}

INSTRUÇÕES DETALHADAS:
1) Use EXCLUSIVAMENTE o texto legal acima. É TERMINANTEMENTE PROIBIDO usar conhecimento externo.
2) Para cada questão, PRIMEIRO localize o artigo/dispositivo no texto acima, DEPOIS formule a questão sobre ele.
3) O comentário DEVE incluir: "Conforme o Art. X [, § Y, inciso Z] da ${disc.leiNome}: '[transcrição literal ou paráfrase fiel]'."
4) VERIFICAÇÃO OBRIGATÓRIA: Releia o texto legal e confirme que o artigo citado no comentário EXISTE e contém o conteúdo mencionado.
5) Se o enunciado menciona um artigo específico, o comentário DEVE citar o MESMO artigo. NUNCA cite um artigo diferente.
6) Estilo do enunciado: "De acordo com a ${disc.leiNome}..." ou situações hipotéticas do cotidiano militar.
7) 5 alternativas distintas (A-E). Sem prefixo nas alternativas. Cada alternativa deve ser substancialmente diferente.
8) gabarito = número inteiro: 0=A, 1=B, 2=C, 3=D, 4=E.
9) Distribua dificuldades: ~30% Fácil, ~50% Médio, ~20% Difícil.

Assuntos possíveis: ${disc.assuntos.join(", ")}

Formato JSON array:
[{"disciplina":"${disc.disciplina}","assunto":"...","dificuldade":"Fácil|Médio|Difícil","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"Conforme o Art. X da ${disc.leiNome}: '...'"}]`;

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.5, // Lower temperature for more precision
        max_tokens: 8000,
      }),
    });

    console.log(`[GERAR] DeepSeek status: ${aiResponse.status}`);

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({
        status: "erro", mensagem: "Rate limit do DeepSeek atingido.", paused: true,
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "RATE_LIMIT", descricao: "Aguarde 1 minuto e tente novamente" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[GERAR] DeepSeek error: ${aiResponse.status} ${errText.substring(0, 300)}`);
      return new Response(JSON.stringify({
        status: "erro", mensagem: `Erro na API DeepSeek (${aiResponse.status})`,
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
        detalhes: { total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0, questoes_revisao_manual: [], erros_encontrados: [{ codigo: "INVALID_JSON", descricao: "Resposta da IA não é JSON válido" }] },
        timestamp,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validQuestions = [];
    let discarded = 0;

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
        discarded++;
        console.log(`[GERAR] Q${idx+1} descartada: enunciado muito curto`);
        continue;
      }
      if (alts.some(a => !a || a.length < 2)) {
        discarded++;
        console.log(`[GERAR] Q${idx+1} descartada: alternativa vazia/curta`);
        continue;
      }
      if (hasDuplicateAlts(alts)) {
        discarded++;
        console.log(`[GERAR] Q${idx+1} descartada: alternativas duplicadas`);
        continue;
      }

      // ── CRITICAL: Validate ALL cited articles in comment exist in law ──
      const citationCheck = validateAllCitations(q.comentario, leiSeca);
      if (!citationCheck.valid) {
        discarded++;
        const motivo = `Artigos inexistentes no texto legal: ${citationCheck.missing.join(", ")}`;
        console.log(`[GERAR] Q${idx+1} descartada: ${motivo}`);
        questoesRevisaoManual.push({ motivo });
        continue;
      }

      // ── Validate at least one article is cited ──
      const citedArts = extractAllCitedArticles(q.comentario);
      if (citedArts.length === 0) {
        discarded++;
        console.log(`[GERAR] Q${idx+1} descartada: sem citação de artigo no comentário`);
        questoesRevisaoManual.push({ motivo: "Comentário não cita nenhum artigo" });
        continue;
      }

      // ── Cross-validation: enunciado vs comment article references ──
      const crossCheck = crossValidateReferences(q.enunciado, q.comentario);
      if (!crossCheck.valid) {
        discarded++;
        console.log(`[GERAR] Q${idx+1} descartada: ${crossCheck.reason}`);
        questoesRevisaoManual.push({ motivo: crossCheck.reason });
        continue;
      }

      // ── Verify correct answer text exists in law (literal confrontation) ──
      const correctAltKey = ALT_KEYS[q.gabarito];
      const correctAltText = q[correctAltKey] as string;
      const foundArticle = findArticleForText(correctAltText, leiSeca);
      
      if (correctAltText.length > 20 && !foundArticle) {
        // Text of correct answer not found in law — suspicious but allow if article check passed
        console.log(`[GERAR] Q${idx+1} AVISO: texto da alternativa correta não localizado literalmente na lei (permitida pois artigos conferem)`);
      }

      // ── If we found the real article, verify comment matches ──
      if (foundArticle) {
        const commentCitedArts = extractAllCitedArticles(q.comentario);
        const foundNum = foundArticle.match(/\d+/)?.[0];
        const commentMatchesFound = commentCitedArts.some(a => a === foundNum);
        if (!commentMatchesFound && commentCitedArts.length > 0) {
          // Comment cites different article than where the correct answer actually is
          // Auto-fix: replace the first cited article with the real one
          console.log(`[GERAR] Q${idx+1} AUTO-FIX: comentário cita Art. ${commentCitedArts[0]} mas resposta está no ${foundArticle}`);
          const wrongArt = `Art. ${commentCitedArts[0]}`;
          q.comentario = q.comentario.replace(new RegExp(wrongArt.replace(".", "\\."), "gi"), foundArticle);
        }
      }

      validQuestions.push(q);
      console.log(`[GERAR] Q${idx+1} APROVADA: ${citedArts.map(a => `Art. ${a}`).join(", ")} ${foundArticle ? `(confronto: ${foundArticle})` : ""}`);
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
      // Legacy fields for frontend compatibility
      success: true,
      count: insertedCount,
      inserted: insertedCount,
      generated: insertedCount,
      discarded,
      total_generated: rawQuestions.length,
      timestamp,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[GERAR] Unexpected error:", String(err));
    return new Response(JSON.stringify({
      status: "erro",
      mensagem: String(err),
      detalhes: {
        total_processado: 0, questoes_criadas: 0, questoes_corrigidas: 0,
        questoes_revisao_manual: questoesRevisaoManual,
        erros_encontrados: [{ codigo: "UNEXPECTED", descricao: String(err) }],
      },
      error: String(err),
      timestamp,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
