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

function stripAlternativePrefix(text: string): string {
  let cleaned = normalizeWhitespace(text);
  cleaned = cleaned.replace(/^(?:alternativa|opção|opcao|letra)\s*[a-e]\s*[:)\-.–]?\s*/i, "");
  cleaned = cleaned.replace(/^[a-e]\s*[:)\-.–]\s*/i, "");
  cleaned = cleaned.replace(/^(?:\d+|i{1,3}|iv|v|um|dois|tr[eê]s|quatro|cinco)\s*[:)\-.–]\s*/i, "");
  return normalizeWhitespace(cleaned);
}

function hasDuplicateAlternatives(alternatives: string[]): boolean {
  const normalized = alternatives.map((alt) => normalizeWhitespace(alt).toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

const ARTICLE_REGEX = /(?:art(?:igos?)?\.?\s*\d+|§\s*\d+|inciso\s+[ivxlcdm\d]+|anexo\s+[ivxlcdm\d]+)/i;
const SINGLE_TOKEN_INVALID_ALT_REGEX = /^(?:a|b|c|d|e|um|dois|tr[eê]s|quatro|cinco|i|ii|iii|iv|v|1|2|3|4|5)$/i;

function sanitizeAndValidateQuestion(raw: any) {
  const sanitized: Record<string, any> = {
    disciplina: normalizeWhitespace(raw.disciplina),
    assunto: normalizeWhitespace(raw.assunto),
    dificuldade: normalizeWhitespace(raw.dificuldade),
    enunciado: normalizeWhitespace(raw.enunciado),
    comentario: normalizeWhitespace(raw.comentario),
    gabarito:
      typeof raw.gabarito === "number"
        ? Math.min(Math.max(raw.gabarito, 0), 4)
        : Math.min(Math.max(Number(raw.gabarito || 0), 0), 4),
  };

  for (const key of ALT_KEYS) {
    sanitized[key] = stripAlternativePrefix(raw[key]);
  }

  const alternatives = ALT_KEYS.map((k) => sanitized[k]);

  const issues: string[] = [];
  if (!sanitized.enunciado || sanitized.enunciado.length < 30) issues.push("Enunciado curto");
  if (!sanitized.comentario || !ARTICLE_REGEX.test(sanitized.comentario)) issues.push("Comentário sem artigo");

  alternatives.forEach((alt, index) => {
    if (!alt) issues.push(`Alt ${String.fromCharCode(65 + index)} vazia`);
    if (SINGLE_TOKEN_INVALID_ALT_REGEX.test(alt)) {
      issues.push(`Alt ${String.fromCharCode(65 + index)} inválida (${alt})`);
    }
  });

  if (hasDuplicateAlternatives(alternatives)) issues.push("Alternativas duplicadas");

  return { sanitized, issues };
}

// Discipline definitions (topics for the prompt)
const DISCIPLINES = [
  {
    disciplina: "Lei nº 2.578/2012",
    leiNome: "Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins",
    assuntos: [
      "Disposições preliminares e conceituações",
      "Ingresso na Corporação e requisitos",
      "Hierarquia e disciplina militar",
      "Cargo e função militar",
      "Obrigações e ética militar",
      "Transgressões disciplinares (leves, médias, graves)",
      "Processos administrativos disciplinares",
      "Direitos, férias e licenças",
      "Prerrogativas dos militares",
      "Situações especiais (agregação, reversão)",
      "Exclusão do serviço ativo, reserva e reforma",
      "Demissão, exoneração e tempo de contribuição",
    ],
  },
  {
    disciplina: "LC nº 128/2021",
    leiNome: "Organização Básica da Polícia Militar do Estado do Tocantins",
    assuntos: [
      "Destinação, competências e subordinação da PMTO",
      "Estrutura geral da organização",
      "Unidades de direção (Comando-Geral, EMG, EME)",
      "Unidades de apoio (Gabinete, APMT, Assessorias, Comissões)",
      "Unidades de execução (Batalhões, Companhias, Pelotões)",
      "Unidades especiais (Colégios Militares)",
      "Gestão profissional e quadros",
      "Disposições gerais e transitórias",
    ],
  },
  {
    disciplina: "Lei nº 2.575/2012",
    leiNome: "Promoções na Polícia Militar do Estado do Tocantins",
    assuntos: [
      "Disposições preliminares sobre promoção",
      "Abertura de vagas",
      "Comissões de promoção (CPO e CPP)",
      "Critérios de promoção (antiguidade, merecimento, escolha, bravura, post-mortem)",
      "Quadros de acesso (QAA, QAM, QAE)",
      "Interstícios para promoção",
      "Avaliação profissional e moral",
      "Impedimentos e exclusão dos QA",
      "Promoções especiais (tempo de contribuição, invalidez)",
      "Recursos e disposições finais",
    ],
  },
  {
    disciplina: "CPPM",
    leiNome: "Código de Processo Penal Militar (DL 1.002/1969) - Arts. 8º a 28 e 243 a 253",
    assuntos: [
      "Polícia judiciária militar e exercício",
      "Inquérito policial militar (IPM)",
      "Instauração e condução do IPM",
      "Delegação de competência",
      "Prazo e encerramento do IPM",
      "Busca e apreensão",
      "Medidas preventivas e assecuratórias",
    ],
  },
  {
    disciplina: "RDMETO",
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins (Decreto 4.994/2014)",
    assuntos: [
      "Disposições gerais e finalidade",
      "Sujeição ao RDMETO",
      "Conceitos (honra pessoal, pundonor, decoro, hierarquia, disciplina)",
      "Transgressões disciplinares e classificação",
      "Circunstâncias atenuantes e agravantes",
      "Punições disciplinares e tipos",
      "Comportamento militar e classificação",
      "Recursos disciplinares",
      "Processos administrativos",
    ],
  },
  {
    disciplina: "Direito Penal Militar",
    leiNome: "Código Penal Militar (DL 1.001/1969) - Parte Geral, Arts. 1 a 135",
    assuntos: [
      "Aplicação da lei penal militar (princípio de legalidade)",
      "Crimes militares em tempo de paz",
      "Crime (fato típico, antijuridicidade, culpabilidade)",
      "Tentativa e consumação",
      "Concurso de agentes e de crimes",
      "Penas e suas espécies",
      "Aplicação e cálculo da pena",
      "Suspensão condicional da pena",
      "Livramento condicional",
      "Medidas de segurança",
      "Efeitos da condenação e reabilitação",
      "Extinção da punibilidade e prescrição",
    ],
  },
  {
    disciplina: "Lei Orgânica PM",
    leiNome: "Lei Orgânica Nacional das Polícias Militares (Lei nº 14.751/2023)",
    assuntos: [
      "Disposições gerais e princípios",
      "Definição e natureza das PMs e CBMs",
      "Competências e atribuições",
      "Hierarquia e disciplina",
      "Gestão de pessoal e carreira",
      "Formação e capacitação",
      "Remuneração e benefícios",
      "Disposições finais e transitórias",
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { disciplina_index, batch_size } = await req.json();
    const batchSize = batch_size || 10;
    const discIndex = disciplina_index ?? 0;

    if (discIndex < 0 || discIndex >= DISCIPLINES.length) {
      return new Response(JSON.stringify({ error: "Invalid discipline index" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const disc = DISCIPLINES[discIndex];

    // Fetch the legal text from the database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: legalTextRow, error: ltError } = await supabase
      .from("discipline_legal_texts")
      .select("content")
      .eq("disciplina", disc.disciplina)
      .single();

    if (ltError || !legalTextRow?.content) {
      return new Response(
        JSON.stringify({
          error: `Texto legal não encontrado para "${disc.disciplina}". Faça o upload do texto legal antes de gerar questões.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leiSeca = legalTextRow.content;
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dificuldades = ["Fácil", "Médio", "Difícil"];

    const prompt = `Você é um especialista em concursos militares do CHOA/CHOM PMTO.

Gere exatamente ${batchSize} questões para "${disc.disciplina}" (${disc.leiNome}).

FONTE LEGAL OBRIGATÓRIA (use SOMENTE este conteúdo como base — é PROIBIDO inventar artigos, parágrafos ou incisos que NÃO existam neste texto):
${leiSeca}

Tópicos do edital:
${disc.assuntos.map((a, i) => `${i + 1}. ${a}`).join("\n")}

REGRAS OBRIGATÓRIAS:
1) Exatamente 5 alternativas por questão (A-E), cada uma com texto completo e coerente.
2) Apenas UMA alternativa correta. As 4 incorretas devem ser plausíveis mas CLARAMENTE erradas conforme a lei.
3) Gabarito em índice 0..4 (0=A, 1=B, 2=C, 3=D, 4=E).
4) Varie a letra correta (não repita sempre a mesma).
5) O comentário DEVE citar o artigo/parágrafo/inciso REAL da lei (ex: "Art. 9º, inciso II, alínea 'a'").
6) CONFIRA que o artigo citado EXISTE no texto legal fornecido acima.
7) SOMENTE conteúdo da lei seca fornecida. NÃO invente artigos ou dispositivos inexistentes.
8) NÃO use placeholders como "UM", "DOIS", "TRÊS", "A", "B", "I", "II" como alternativa isolada.
9) Alternativas devem ser frases completas, específicas e plausíveis.
10) Estilo "De acordo com..." ou "Conforme..." típico de provas militares.
11) Distribua as dificuldades: Fácil (conceitos básicos), Médio (interpretação), Difícil (detalhes específicos).
12) NÃO misture conteúdo de outras leis. Cada questão deve tratar EXCLUSIVAMENTE da lei indicada.

Formato de saída (JSON array, sem markdown):
[
  {
    "disciplina": "${disc.disciplina}",
    "assunto": "Nome do assunto",
    "dificuldade": "Fácil|Médio|Difícil",
    "enunciado": "Texto da questão",
    "alt_a": "Texto completo da alternativa A",
    "alt_b": "Texto completo da alternativa B",
    "alt_c": "Texto completo da alternativa C",
    "alt_d": "Texto completo da alternativa D",
    "alt_e": "Texto completo da alternativa E",
    "gabarito": 0,
    "comentario": "Explicação com citação do artigo legal específico"
  }
]`;

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      const status = aiResponse.status;
      if (status === 429 || status === 402) {
        return new Response(
          JSON.stringify({ success: false, paused: true, error: `Groq rate limit (${status}): ${errText}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "AI generation failed", details: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let questoes;
    try {
      questoes = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(questoes) || questoes.length === 0) {
      return new Response(JSON.stringify({ error: "No questions generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discarded: { index: number; issues: string[] }[] = [];
    const validQuestoes = questoes
      .map((q: any, index: number) => {
        const { sanitized, issues } = sanitizeAndValidateQuestion({
          disciplina: q.disciplina || disc.disciplina,
          assunto: q.assunto || disc.assuntos[0],
          dificuldade: dificuldades.includes(q.dificuldade) ? q.dificuldade : "Médio",
          enunciado: q.enunciado,
          alt_a: q.alt_a,
          alt_b: q.alt_b,
          alt_c: q.alt_c,
          alt_d: q.alt_d,
          alt_e: q.alt_e,
          gabarito: q.gabarito,
          comentario: q.comentario || "",
        });

        if (issues.length > 0) {
          discarded.push({ index, issues });
          return null;
        }

        return sanitized;
      })
      .filter(Boolean);

    if (validQuestoes.length === 0) {
      return new Response(JSON.stringify({ error: "All generated questions were discarded by quality checks", discarded }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.from("questoes").insert(validQuestoes as any[]).select("id");

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to insert questions", details: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        disciplina: disc.disciplina,
        generated: questoes.length,
        inserted: data?.length || 0,
        discarded: discarded.length,
        discarded_details: discarded.length > 0 ? discarded.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
