import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARTICLE_REGEX = /(?:art(?:igos?)?\.?\s*\d+|anexo\s+[ivxlcdm\d]+)/i;
const SINGLE_TOKEN_INVALID_ALT_REGEX = /^(?:a|b|c|d|e|um|dois|tr[eê]s|quatro|cinco|i|ii|iii|iv|v|1|2|3|4|5)$/i;
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

const DISCIPLINES = [
  {
    disciplina: "Lei nº 2.578/2012",
    leiNome: "Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins",
    assuntos: [
      "Disposições Preliminares: conceito de policial militar, cargo, posto, graduação, situações de atividade e inatividade",
      "Ingresso, Hierarquia e Disciplina: condições de ingresso, círculos hierárquicos, ordem de precedência, graus hierárquicos",
      "Deveres, Obrigações e Direitos: compromisso militar, deveres militares, valor militar, ética e decoro, remuneração, estabilidade, férias, licenças",
      "Regime Disciplinar: transgressões e classificação, sanções, PAD, Conselho de Disciplina e Justificação, comportamento militar",
      "Movimentação e Lotação: classificação, reclassificação, transferências, permutas",
      "Afastamento e Licenciamento: agregação, licenciamento a pedido e ex officio, exclusão, demissão, reforma, reserva remunerada",
    ],
    instrucaoExtra: "Base legal: Lei nº 2.578, de 20 de abril de 2012, do Estado do Tocantins. Cite artigos, incisos e parágrafos específicos desta lei nos comentários.",
  },
  {
    disciplina: "LC nº 128/2021",
    leiNome: "Organização Básica da Polícia Militar do Estado do Tocantins",
    assuntos: [
      "Estrutura e Missão Institucional: missão constitucional, competências, subordinação ao Governador",
      "Órgãos de Direção Geral: Comando-Geral, Subcomando-Geral, Estado-Maior, Gabinete",
      "Órgãos de Direção Setorial: Diretoria de Pessoal, Ensino, Apoio Logístico, Finanças, Saúde",
      "Órgãos de Execução: CPA, Batalhões, Companhias, Pelotões, unidades especializadas (BOPE, BPRv, BPAmb)",
      "Disposições Gerais e Transitórias: quadro de organização e efetivo, adequação da estrutura",
    ],
    instrucaoExtra: "Base legal: Lei Complementar nº 128, de 2021, do Estado do Tocantins. Cite artigos específicos desta LC nos comentários.",
  },
  {
    disciplina: "Lei nº 2.575/2012",
    leiNome: "Promoções dos Militares Estaduais do Tocantins",
    assuntos: [
      "Disposições Gerais: finalidade, princípios, condições essenciais, tipos de promoção (antiguidade, merecimento, bravura, post mortem), interstício mínimo",
      "Promoção por Antiguidade: contagem de tempo, QAA, preterição, precedência e desempate",
      "Promoção por Merecimento: conceito, critérios de avaliação, QAM, Comissão de Promoções, cursos obrigatórios",
      "Promoção por Bravura e Post Mortem: requisitos, ato de bravura, hipóteses e efeitos legais",
      "Impedimentos e Ressalvas: processo disciplinar, cessação, vagas, claros, datas e efeitos retroativos",
    ],
    instrucaoExtra: "Base legal: Lei nº 2.575, de 20 de abril de 2012, do Estado do Tocantins. Cite artigos específicos desta lei nos comentários.",
  },
  {
    disciplina: "CPPM",
    leiNome: "Código de Processo Penal Militar — Arts. 8º a 28º e 243º a 253º",
    assuntos: [
      "Polícia Judiciária Militar (Arts. 8º a 11): conceito, atribuições, exercício, competência, delegação",
      "Inquérito Policial Militar (Arts. 12 a 28): conceito, finalidade, instauração, encarregado, diligências, prazo (20 dias preso / 40 dias solto), prorrogação, relatório final, arquivamento",
      "Prisão em Flagrante (Arts. 243 a 247): conceito, hipóteses, auto de prisão em flagrante, formalidades",
      "Prisão Preventiva (Arts. 254 a 261): requisitos, fundamentos, decretação, revogação",
      "Menagem e Liberdade Provisória: conceito, aplicação, possibilidades, restrições, relaxamento de prisão ilegal",
    ],
    instrucaoExtra: "Base legal: Decreto-Lei nº 1.002/1969 (CPPM). As questões devem ser EXCLUSIVAMENTE sobre os Arts. 8º a 28º e Arts. 243º a 253º. Cite artigos específicos nos comentários.",
  },
  {
    disciplina: "RDMETO",
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins — Decreto nº 4.994/2014",
    assuntos: [
      "Disposições Gerais e Princípios: finalidade, princípios de hierarquia e disciplina, conceito e classificação de transgressões",
      "Transgressões Disciplinares: transgressões previstas, atenuantes e agravantes, causas de justificação",
      "Sanções Disciplinares: advertência, repreensão, detenção, prisão disciplinar, licenciamento e exclusão",
      "Comportamento Militar: classificação, critérios de mudança, ficha de alterações, reabilitação, elogios",
      "Processo Disciplinar: sindicância, PAD, contraditório, ampla defesa e recursos",
    ],
    instrucaoExtra: "Base legal: Decreto nº 4.994/2014 do Estado do Tocantins. Cite artigos específicos deste decreto nos comentários.",
  },
  {
    disciplina: "Direito Penal Militar",
    leiNome: "Código Penal Militar — Decreto-Lei nº 1.001/1969 — Parte Geral",
    assuntos: [
      "Aplicação da Lei Penal Militar",
      "Crime Militar — Conceito e Elementos",
      "Excludentes: legítima defesa, estado de necessidade, estrito cumprimento do dever legal",
      "Penas e Medidas de Segurança",
    ],
    instrucaoExtra: "Base legal: Decreto-Lei nº 1.001/1969 (CPM — Parte Geral). Cite artigos específicos do CPM nos comentários.",
  },
  {
    disciplina: "Lei Orgânica PM",
    leiNome: "Lei Orgânica das Polícias Militares — Lei nº 14.751/2023",
    assuntos: [
      "Disposições Gerais e Princípios",
      "Organização e Estrutura",
      "Carreira e Direitos",
      "Regime Disciplinar e Deveres",
      "Policiamento Ostensivo",
      "Disposições Finais e Transitórias",
    ],
    instrucaoExtra: "IMPORTANTE: Basear EXCLUSIVAMENTE na Lei nº 14.751/2023, com citação de artigos reais.",
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
    const dificuldades = ["Fácil", "Médio", "Difícil"];

    const prompt = `Você é um especialista em concursos militares do CHOA/CHOM PMTO.

Gere exatamente ${batchSize} questões para "${disc.disciplina}" (${disc.leiNome}).

Tópicos do edital:
${disc.assuntos.map((a, i) => `${i + 1}. ${a}`).join("\n")}

${disc.instrucaoExtra}

REGRAS OBRIGATÓRIAS:
1) Exatamente 5 alternativas por questão (A-E).
2) Apenas UMA correta.
3) Gabarito em índice 0..4 (0=A, 1=B, 2=C, 3=D, 4=E).
4) Não repetir a mesma letra correta em sequência sempre que possível.
5) Comentário deve citar artigo/dispositivo legal real.
6) Lei seca apenas (sem invenção).
7) Não usar placeholders como "UM", "DOIS", "TRÊS", "A", "B", "I", "II" como alternativa isolada.
8) Alternativas devem ser completas e coerentes.

Formato de saída (JSON array, sem markdown):
[
  {
    "disciplina": "${disc.disciplina}",
    "assunto": "Nome do assunto",
    "dificuldade": "Fácil|Médio|Difícil",
    "enunciado": "Texto da questão",
    "alt_a": "...",
    "alt_b": "...",
    "alt_c": "...",
    "alt_d": "...",
    "alt_e": "...",
    "gabarito": 0,
    "comentario": "Explicação com artigo legal"
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return new Response(JSON.stringify({ error: "AI generation failed", details: errText }), {
        status: aiResponse.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
