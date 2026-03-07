import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    instrucaoExtra: "Base legal: Decreto-Lei nº 1.002/1969 (CPPM). As questões devem ser EXCLUSIVAMENTE sobre os Arts. 8º a 28º (Polícia Judiciária Militar e IPM) e Arts. 243º a 253º (Prisão Provisória). Cite artigos específicos nos comentários.",
  },
  {
    disciplina: "RDMETO",
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins — Decreto nº 4.994/2014",
    assuntos: [
      "Disposições Gerais e Princípios: finalidade, princípios de hierarquia e disciplina, conceito e classificação de transgressões (leves, médias, graves)",
      "Transgressões Disciplinares: relação das transgressões previstas, circunstâncias atenuantes e agravantes, causas de justificação, cumulatividade, prescrição",
      "Sanções Disciplinares: advertência, repreensão, detenção, prisão disciplinar, licenciamento e exclusão, competência para aplicação",
      "Comportamento Militar: classificação (excepcional, ótimo, bom, regular, insuficiente, mau), critérios de mudança, ficha de alterações, reabilitação, elogios",
      "Processo Disciplinar: sindicância, PAD, garantias do contraditório e ampla defesa, recursos, revisão e anulação de punições",
    ],
    instrucaoExtra: "Base legal: Decreto nº 4.994, de 11 de setembro de 2014, do Estado do Tocantins. Cite artigos específicos deste decreto nos comentários.",
  },
  {
    disciplina: "Direito Penal Militar",
    leiNome: "Código Penal Militar — Decreto-Lei nº 1.001/1969 — Parte Geral",
    assuntos: [
      "Aplicação da Lei Penal Militar: crime propriamente e impropriamente militar, tempo de paz e guerra, aplicação no espaço e tempo, sujeitos à jurisdição militar",
      "Crime Militar — Conceito e Elementos: tipicidade, ilicitude, culpabilidade, dolo e culpa, tentativa e consumação, concurso de agentes",
      "Excludentes: legítima defesa, estado de necessidade, estrito cumprimento do dever legal, obediência hierárquica, coação irresistível, circunstâncias agravantes e atenuantes",
      "Penas e Medidas de Segurança: espécies de pena (morte, reclusão, detenção, prisão, impedimento, suspensão, reforma), penas principais e acessórias, medidas de segurança, extinção da punibilidade",
    ],
    instrucaoExtra: "Base legal: Decreto-Lei nº 1.001/1969 (Código Penal Militar — Parte Geral). Cite artigos específicos do CPM nos comentários.",
  },
  {
    disciplina: "Lei Orgânica PM",
    leiNome: "Lei Orgânica das Polícias Militares — Lei nº 14.751, de 12 de dezembro de 2023",
    assuntos: [
      "Disposições Gerais e Princípios: objeto, âmbito de aplicação, competências constitucionais, princípios institucionais, natureza jurídica",
      "Organização e Estrutura: estrutura organizacional, competência dos estados, quadros de oficiais e praças, cargos, postos, graduações, efetivo",
      "Carreira e Direitos: ingresso, sistema de promoções, remuneração, vantagens, direitos e garantias, regime previdenciário",
      "Regime Disciplinar e Deveres: deveres militares, ética profissional, regime disciplinar, transgressões, PAD, contraditório e ampla defesa",
      "Policiamento Ostensivo: definição, preservação da ordem pública, ciclo completo, uso progressivo da força, atuação integrada, controle externo",
      "Disposições Finais e Transitórias: adequação das legislações estaduais, prazos, revogações, vigência",
    ],
    instrucaoExtra: "IMPORTANTE: Todas as questões devem ser baseadas EXCLUSIVAMENTE no texto da Lei nº 14.751, de 12 de dezembro de 2023. Cite artigos específicos desta lei nos comentários. NÃO confunda com legislações estaduais anteriores.",
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

    const prompt = `Você é um especialista em concursos militares do Brasil, especificamente no CHOA/CHOM PMTO (Curso de Habilitação de Oficiais da Polícia Militar do Tocantins).

Gere exatamente ${batchSize} questões de múltipla escolha para a disciplina "${disc.disciplina}" (${disc.leiNome}).

TÓPICOS DO EDITAL que devem ser cobertos (distribua de forma equilibrada):
${disc.assuntos.map((a, i) => `${i + 1}. ${a}`).join("\n")}

${disc.instrucaoExtra}

REGRAS OBRIGATÓRIAS:
1. Cada questão deve ter exatamente 5 alternativas (A, B, C, D, E)
2. Apenas UMA alternativa correta por questão
3. O gabarito deve ser o ÍNDICE da alternativa correta (0=A, 1=B, 2=C, 3=D, 4=E)
4. VARIE o gabarito — não repita a mesma letra em questões consecutivas
5. Varie a dificuldade entre: ${dificuldades.join(", ")}
6. O comentário DEVE explicar por que a alternativa correta está certa e as outras erradas
7. O comentário DEVE citar artigos, incisos e parágrafos específicos da legislação
8. As questões devem ter embasamento EXCLUSIVO na LEI SECA (texto literal da legislação)
9. As alternativas incorretas devem ser plausíveis mas claramente distinguíveis pela lei
10. NÃO invente dispositivos legais inexistentes — cite apenas artigos reais
11. Os enunciados devem ser no estilo "De acordo com...", "Segundo a...", "Assinale a alternativa CORRETA/INCORRETA..."
12. Questões devem ser compatíveis com provas de concurso militar de nível médio/superior

Responda APENAS com um JSON array válido, sem markdown, sem explicações. Formato:
[
  {
    "disciplina": "${disc.disciplina}",
    "assunto": "Nome do assunto",
    "dificuldade": "Fácil|Médio|Difícil",
    "enunciado": "Texto da questão...",
    "alt_a": "Alternativa A",
    "alt_b": "Alternativa B",
    "alt_c": "Alternativa C",
    "alt_d": "Alternativa D",
    "alt_e": "Alternativa E",
    "gabarito": 0,
    "comentario": "Explicação detalhada com citação de artigos da lei seca..."
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
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
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
    } catch (parseErr) {
      console.error("Parse error:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(questoes) || questoes.length === 0) {
      return new Response(JSON.stringify({ error: "No questions generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validQuestoes = questoes
      .filter((q: any) => q.enunciado && q.alt_a && q.alt_b && q.alt_c && q.alt_d && q.alt_e && typeof q.gabarito === "number")
      .map((q: any) => ({
        disciplina: q.disciplina || disc.disciplina,
        assunto: q.assunto || disc.assuntos[0],
        dificuldade: dificuldades.includes(q.dificuldade) ? q.dificuldade : "Médio",
        enunciado: q.enunciado,
        alt_a: q.alt_a,
        alt_b: q.alt_b,
        alt_c: q.alt_c,
        alt_d: q.alt_d,
        alt_e: q.alt_e,
        gabarito: Math.min(Math.max(q.gabarito, 0), 4),
        comentario: q.comentario || "Sem comentário disponível.",
      }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.from("questoes").insert(validQuestoes).select("id");

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to insert questions", details: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, disciplina: disc.disciplina, generated: validQuestoes.length, inserted: data?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
