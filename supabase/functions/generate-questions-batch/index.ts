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

function hasDuplicateAlts(alts: string[]): boolean {
  const norm = alts.map(a => normalizeWhitespace(a).toLowerCase());
  return new Set(norm).size !== norm.length;
}

function articleExistsInLaw(artNum: string, lawText: string): boolean {
  const lower = lawText.toLowerCase();
  return lower.includes(`art. ${artNum}`) || lower.includes(`artigo ${artNum}`) || lower.includes(`art ${artNum}`);
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

    // Fetch legal text — MANDATORY
    const { data: legalTextRow, error: ltError } = await supabase
      .from("discipline_legal_texts")
      .select("content")
      .eq("disciplina", disc.disciplina)
      .single();

    if (ltError || !legalTextRow?.content) {
      return new Response(JSON.stringify({ error: `Texto legal não encontrado para "${disc.disciplina}". Faça upload em /admin/textos-legais primeiro.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leiSeca = legalTextRow.content;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um especialista jurídico rigoroso em concursos militares.

Gere exatamente ${batchSize} questões de múltipla escolha para "${disc.disciplina}" (${disc.leiNome}).

TEXTO LEGAL OBRIGATÓRIO — ESTA É SUA ÚNICA FONTE:
${leiSeca.substring(0, 35000)}

REGRAS ABSOLUTAS:
1) É PROIBIDO usar conhecimento externo. Use APENAS o texto legal acima.
2) Se um artigo NÃO está no texto acima, ele NÃO EXISTE. Não invente.
3) O comentário DEVE citar o artigo/parágrafo/inciso REAL (ex: "Conforme Art. 10, § 1º").
4) CONFIRA: o artigo citado existe LITERALMENTE no texto fornecido? Se não, não use.
5) Estilo: "De acordo com a ${disc.leiNome}..." ou exemplos fictícios do cotidiano militar.
6) 5 alternativas distintas (A-E). Sem prefixo nas alternativas (não comece com "A)", "a)", etc.).
7) gabarito = número inteiro: 0=A, 1=B, 2=C, 3=D, 4=E.
8) Distribua dificuldades: ~30% Fácil, ~50% Médio, ~20% Difícil.

Assuntos possíveis: ${disc.assuntos.join(", ")}

Formato JSON array (SEM markdown, SEM \`\`\`):
[{"disciplina":"${disc.disciplina}","assunto":"...","dificuldade":"Fácil|Médio|Difícil","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"..."}]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (aiResponse.status === 429 || aiResponse.status === 402) {
      const msg = aiResponse.status === 429 ? "Rate limit atingido. Aguarde 1 minuto." : "Créditos insuficientes. Adicione créditos no workspace Lovable.";
      return new Response(JSON.stringify({ error: msg, paused: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: `AI Gateway error: ${aiResponse.status}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let rawQuestions;
    try {
      rawQuestions = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "IA retornou JSON inválido", count: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validQuestions = [];
    let discarded = 0;

    for (const raw of rawQuestions) {
      // Sanitize
      const q: Record<string, any> = {
        disciplina: disc.disciplina,
        assunto: normalizeWhitespace(raw.assunto),
        dificuldade: normalizeWhitespace(raw.dificuldade) || "Médio",
        enunciado: normalizeWhitespace(raw.enunciado),
        comentario: normalizeWhitespace(raw.comentario),
        gabarito: Math.min(Math.max(Number(raw.gabarito) || 0, 0), 4),
      };

      for (const k of ALT_KEYS) {
        q[k] = stripAlternativePrefix(raw[k]);
      }

      // Structural validation
      const alts = ALT_KEYS.map(k => q[k] as string);
      if (!q.enunciado || q.enunciado.length < 25) { discarded++; continue; }
      if (alts.some(a => !a || a.length < 2)) { discarded++; continue; }
      if (hasDuplicateAlts(alts)) { discarded++; continue; }

      // CRITICAL: Verify cited article exists in legal text
      const citedMatch = q.comentario.match(/art(?:igo)?\.?\s*(\d+)/i);
      if (citedMatch) {
        const artNum = citedMatch[1];
        if (!articleExistsInLaw(artNum, leiSeca)) {
          discarded++; // Article doesn't exist in law — discard
          continue;
        }
      } else {
        // No article cited — discard (we require legal reference)
        discarded++;
        continue;
      }

      validQuestions.push(q);
    }

    if (validQuestions.length > 0) {
      const { error: insertError } = await supabase.from("questoes").insert(validQuestions);
      if (insertError) {
        return new Response(JSON.stringify({ error: `Insert error: ${insertError.message}`, count: 0 }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: validQuestions.length,
      discarded,
      total_generated: rawQuestions.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
