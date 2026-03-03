import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCIPLINES = [
  {
    disciplina: "Constituição Federal",
    assuntos: [
      "Direitos e Garantias Fundamentais (Art. 5º)",
      "Administração Pública (Art. 37)",
      "Militares dos Estados (Art. 42)",
      "Forças Armadas (Art. 142)",
      "Segurança Pública (Art. 144)",
    ],
  },
  {
    disciplina: "Direito Administrativo",
    assuntos: [
      "Princípios da Administração Pública",
      "Atos Administrativos",
      "Poderes Administrativos",
      "Poder de Polícia",
      "Responsabilidade Civil do Estado",
    ],
  },
  {
    disciplina: "Direito Penal Militar",
    assuntos: [
      "Aplicação da Lei Penal Militar",
      "Crime Militar: conceito e elementos",
      "Excludentes de ilicitude e culpabilidade",
      "Penas e medidas de segurança",
      "Crimes em espécie",
    ],
  },
  {
    disciplina: "Língua Portuguesa",
    assuntos: [
      "Interpretação e Compreensão de Textos",
      "Ortografia e Acentuação",
      "Concordância Verbal e Nominal",
      "Regência Verbal e Nominal",
      "Sintaxe e Pontuação",
      "Uso da Crase",
      "Colocação Pronominal",
    ],
  },
  {
    disciplina: "Raciocínio Lógico",
    assuntos: [
      "Lógica Proposicional",
      "Tabelas-Verdade",
      "Equivalências e Negações",
      "Diagramas Lógicos",
      "Conjuntos e Operações",
      "Princípio da Contagem",
      "Probabilidade",
    ],
  },
  {
    disciplina: "Lei nº 2.578/2012",
    assuntos: [
      "Ingresso e Hierarquia",
      "Deveres e Direitos",
      "Regime Disciplinar",
      "Licenciamento e Exclusão",
      "Movimentação e Lotação",
    ],
  },
  {
    disciplina: "LC nº 128/2021",
    assuntos: [
      "Estrutura e Missão da PMTO",
      "Órgãos de Direção",
      "Órgãos de Execução",
      "Disposições Gerais",
    ],
  },
  {
    disciplina: "Lei nº 2.575/2012",
    assuntos: [
      "Promoção por Antiguidade",
      "Promoção por Merecimento",
      "Promoção por Bravura e Post Mortem",
      "Impedimentos e Ressalvas",
    ],
  },
  {
    disciplina: "CPPM",
    assuntos: [
      "Polícia Judiciária Militar",
      "Inquérito Policial Militar",
      "Prisão em Flagrante",
      "Prisão Preventiva",
      "Menagem e Liberdade Provisória",
    ],
  },
  {
    disciplina: "RDMETO",
    assuntos: [
      "Transgressões Disciplinares",
      "Sanções Disciplinares",
      "Comportamento Militar",
      "Processo Administrativo Disciplinar",
      "Recursos Disciplinares",
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const disc = DISCIPLINES[discIndex];
    const dificuldades = ["Fácil", "Médio", "Difícil"];

    const prompt = `Você é um especialista em concursos militares do Brasil, especialmente CHOA PMTO (Curso de Habilitação de Oficiais Administrativos da Polícia Militar do Tocantins).

Gere exatamente ${batchSize} questões de múltipla escolha para a disciplina "${disc.disciplina}".

Os assuntos possíveis são: ${disc.assuntos.join(", ")}.

Para cada questão, distribua os assuntos de forma equilibrada e varie a dificuldade entre: ${dificuldades.join(", ")}.

REGRAS IMPORTANTES:
- Cada questão deve ter 5 alternativas (A, B, C, D, E)
- Apenas UMA alternativa correta por questão
- O gabarito deve ser o ÍNDICE da alternativa correta (0=A, 1=B, 2=C, 3=D, 4=E)
- Varie o gabarito entre as questões (não coloque sempre a mesma letra)
- O comentário deve explicar POR QUE a alternativa correta está certa e as outras erradas
- Questões devem ser realistas e compatíveis com provas de concurso militar
- Para legislação estadual (TO), baseie-se no conteúdo real das leis

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
    "comentario": "Explicação detalhada..."
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
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";

    // Clean markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let questoes;
    try {
      questoes = JSON.parse(content);
    } catch (parseErr) {
      console.error("Parse error:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 500) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(questoes) || questoes.length === 0) {
      return new Response(JSON.stringify({ error: "No questions generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and sanitize
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

    // Insert into database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.from("questoes").insert(validQuestoes).select("id");

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to insert questions", details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        disciplina: disc.disciplina,
        generated: validQuestoes.length,
        inserted: data?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
