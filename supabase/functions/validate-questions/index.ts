import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const afterId = body.after_id ?? 0;
    const limit = Math.min(body.limit || 5, 10);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    const { data: questions, error } = await supabase
      .from("questoes")
      .select("*")
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const { data: legalRows } = await supabase.from("discipline_legal_texts").select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    if (legalRows) legalRows.forEach(row => legalTexts[row.disciplina] = row.content);

    let fixedCount = 0;
    let okCount = 0;

    for (const q of questions) {
      const lawText = legalTexts[q.disciplina];
      if (!lawText) {
        okCount++;
        continue;
      }

      // PROMPT ULTRA-RIGOROSO PARA CORREÇÃO DE COMENTÁRIOS E ARTIGOS
      const prompt = `Você é um auditor jurídico militar. A questão abaixo tem erros de citação de artigos no comentário.
Corrija a questão para que ela seja 100% fiel ao texto legal fornecido.

TEXTO LEGAL (${q.disciplina}):
${lawText.substring(0, 30000)}

QUESTÃO:
Enunciado: ${q.enunciado}
Alternativas: A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)}
Comentário Atual: ${q.comentario}

SUA TAREFA:
1. Localize no texto legal o artigo EXATO que fundamenta a resposta correta.
2. Se o comentário atual citar um artigo que não existe ou que não trata desse assunto, REESCREVA o comentário.
3. O novo comentário DEVE citar o número do artigo, parágrafo e inciso corretamente (ex: "Conforme o Art. 10, § 1º, inciso II...").
4. Se o enunciado ou alternativas estiverem juridicamente errados, corrija-os também.
5. Mantenha o gabarito (0-4) coerente com a alternativa correta.

Responda APENAS em JSON:
{
  "enunciado": "texto corrigido",
  "alt_a": "...", "alt_b": "...", "alt_c": "...", "alt_d": "...", "alt_e": "...",
  "gabarito": 0,
  "comentario": "Comentário corrigido com citação literal e correta da lei"
}`;

      const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        let content = aiData.choices?.[0]?.message?.content || "";
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const corrected = JSON.parse(content);

        // Atualizar no banco de dados
        await supabase.from("questoes").update(corrected).eq("id", q.id);
        fixedCount++;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ success: true, ok: okCount, corrigidas: fixedCount, last_id: questions[questions.length-1]?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
