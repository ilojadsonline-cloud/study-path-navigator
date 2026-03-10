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
  if (!sanitized.enunciado || sanitized.enunciado.length < 25) issues.push("Enunciado curto");
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
      "Transgressões disciplinares and classificação",
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: legalTextRow, error: ltError } = await supabase
      .from("discipline_legal_texts")
      .select("content")
      .eq("disciplina", disc.disciplina)
      .single();

    if (ltError || !legalTextRow?.content) {
      return new Response(JSON.stringify({ error: `Texto legal não encontrado para "${disc.disciplina}".` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leiSeca = legalTextRow.content;
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const prompt = `Você é um especialista jurídico rigoroso em concursos militares.
    
Gere exatamente ${batchSize} questões para "${disc.disciplina}" (${disc.leiNome}).

FONTE LEGAL OBRIGATÓRIA (É PROIBIDO INVENTAR ARTIGOS OU USAR CONHECIMENTO EXTERNO):
${leiSeca.substring(0, 35000)}

REGRAS CRÍTICAS:
1) Use APENAS o texto legal fornecido acima. Se um artigo não está no texto acima, ele NÃO existe para esta tarefa.
2) O comentário DEVE citar o artigo/parágrafo/inciso REAL que fundamenta a resposta (ex: "Art. 10, § 1º").
3) CONFIRA DUAS VEZES: O artigo citado no comentário existe LITERALMENTE no texto legal fornecido?
4) Se você inventar um artigo, a questão será descartada. Seja fiel à letra da lei.
5) Estilo de prova: "De acordo com a Lei nº...".

Formato de saída (JSON array, sem markdown):
[
  {
    "disciplina": "${disc.disciplina}",
    "assunto": "Nome do assunto",
    "dificuldade": "Fácil|Médio|Difícil",
    "enunciado": "Texto da questão",
    "alt_a": "Texto da alternativa A",
    "alt_b": "Texto da alternativa B",
    "alt_c": "Texto da alternativa C",
    "alt_d": "Texto da alternativa D",
    "alt_e": "Texto da alternativa E",
    "gabarito": 0,
    "comentario": "Explicação citando o artigo específico da lei"
  }
]`;

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Baixa temperatura para reduzir alucinações
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) return new Response(JSON.stringify({ error: "AI Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const rawQuestions = JSON.parse(content);
    const validQuestions = [];
    
    for (const raw of rawQuestions) {
      const { sanitized, issues } = sanitizeAndValidateQuestion(raw);
      if (issues.length === 0) {
        // Verificação extra de segurança: o artigo citado no comentário existe no texto legal?
        const cited = sanitized.comentario.match(/art(?:igo)?\.?\s*(\d+)/i);
        if (cited) {
          const artNum = cited[1];
          if (leiSeca.toLowerCase().includes(`art. ${artNum}`) || leiSeca.toLowerCase().includes(`artigo ${artNum}`)) {
            validQuestions.push(sanitized);
          }
        } else {
          validQuestions.push(sanitized);
        }
      }
    }

    if (validQuestions.length > 0) {
      await supabase.from("questoes").insert(validQuestions);
    }

    return new Response(JSON.stringify({ success: true, count: validQuestions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
