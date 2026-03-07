import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offset = 0, limit = 5 } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch a batch of questions to validate
    const { data: questoes, error: fetchErr } = await supabase
      .from("questoes")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch questions", details: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!questoes || questoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more questions to validate", validated: 0, fixed: 0, deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build validation prompt
    const questoesJson = JSON.stringify(
      questoes.map((q) => ({
        id: q.id,
        disciplina: q.disciplina,
        assunto: q.assunto,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        alt_a: q.alt_a,
        alt_b: q.alt_b,
        alt_c: q.alt_c,
        alt_d: q.alt_d,
        alt_e: q.alt_e,
        gabarito: q.gabarito,
        comentario: q.comentario,
      }))
    );

    const prompt = `Você é um revisor especialista em questões de concursos militares brasileiros (CHOA PMTO).

Analise as questões abaixo e corrija os seguintes problemas:

PROBLEMAS A IDENTIFICAR E CORRIGIR:
1. Alternativas sem sentido, genéricas ou que não se relacionam com o enunciado
2. Questões com mais de uma alternativa correta - ajuste para que APENAS UMA seja correta
3. Alternativas com formatação errada (ex: "UM, a, b, c" ao invés de texto correto)
4. Gabarito apontando para alternativa errada - corrija o índice (0=A, 1=B, 2=C, 3=D, 4=E)
5. Enunciados confusos ou mal redigidos
6. Comentários que não explicam corretamente a resposta
7. Alternativas duplicadas ou muito similares

REGRAS:
- Mantenha o id original de cada questão
- Se uma questão está IRRECUPERÁVEL (totalmente sem sentido), marque-a com "deletar": true
- Se uma questão precisa de correções, forneça a versão corrigida completa
- Se uma questão está OK, marque-a com "ok": true
- O gabarito DEVE ser 0-indexed (0=A, 1=B, 2=C, 3=D, 4=E)
- Todas as alternativas devem ser textos completos e coerentes
- O comentário deve citar artigos da legislação quando aplicável

Questões para revisar:
${questoesJson}

Responda APENAS com um JSON array válido, sem markdown. Formato:
[
  {
    "id": 123,
    "ok": true
  },
  {
    "id": 456,
    "deletar": true,
    "motivo": "Alternativas sem sentido"
  },
  {
    "id": 789,
    "corrigida": {
      "enunciado": "Texto corrigido...",
      "alt_a": "Alternativa A corrigida",
      "alt_b": "Alternativa B corrigida",
      "alt_c": "Alternativa C corrigida",
      "alt_d": "Alternativa D corrigida",
      "alt_e": "Alternativa E corrigida",
      "gabarito": 2,
      "comentario": "Explicação corrigida..."
    }
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
      console.error("AI error:", errText);
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI validation failed", details: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let resultados;
    try {
      resultados = JSON.parse(content);
    } catch {
      console.error("Parse error:", content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(resultados)) {
      return new Response(JSON.stringify({ error: "AI response is not an array" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fixed = 0;
    let deleted = 0;
    let okCount = 0;
    const errors: string[] = [];

    for (const r of resultados) {
      if (!r.id) continue;

      if (r.deletar) {
        // First delete related respostas_usuario
        await supabase.from("respostas_usuario").delete().eq("questao_id", r.id);
        const { error: delErr } = await supabase.from("questoes").delete().eq("id", r.id);
        if (delErr) {
          errors.push(`Delete ${r.id}: ${delErr.message}`);
        } else {
          deleted++;
        }
      } else if (r.corrigida) {
        const update: Record<string, unknown> = {};
        if (r.corrigida.enunciado) update.enunciado = r.corrigida.enunciado;
        if (r.corrigida.alt_a) update.alt_a = r.corrigida.alt_a;
        if (r.corrigida.alt_b) update.alt_b = r.corrigida.alt_b;
        if (r.corrigida.alt_c) update.alt_c = r.corrigida.alt_c;
        if (r.corrigida.alt_d) update.alt_d = r.corrigida.alt_d;
        if (r.corrigida.alt_e) update.alt_e = r.corrigida.alt_e;
        if (typeof r.corrigida.gabarito === "number") update.gabarito = Math.min(Math.max(r.corrigida.gabarito, 0), 4);
        if (r.corrigida.comentario) update.comentario = r.corrigida.comentario;

        if (Object.keys(update).length > 0) {
          const { error: upErr } = await supabase.from("questoes").update(update).eq("id", r.id);
          if (upErr) {
            errors.push(`Update ${r.id}: ${upErr.message}`);
          } else {
            fixed++;
          }
        }
      } else if (r.ok) {
        okCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        validated: questoes.length,
        ok: okCount,
        fixed,
        deleted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
