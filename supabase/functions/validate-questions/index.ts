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
    const limit = Math.min(body.limit || 5, 10); // Lotes pequenos para evitar timeout

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    // 1. Buscar questões para validar
    const { data: questions, error } = await supabase
      .from("questoes")
      .select("*")
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw error;

    // 2. Buscar textos legais para referência
    const { data: legalRows } = await supabase.from("discipline_legal_texts").select("disciplina, content");
    const legalTexts: Record<string, string> = {};
    if (legalRows) legalRows.forEach(row => legalTexts[row.disciplina] = row.content);

    let fixedCount = 0;
    let okCount = 0;
    const results = [];

    for (const q of questions) {
      const lawText = legalTexts[q.disciplina];
      if (!lawText) {
        okCount++;
        results.push({ id: q.id, status: "pular", motivo: "Sem texto legal" });
        continue;
      }

      // PROMPT DE AUDITORIA DE CONFRONTO DIRETO (O MESMO QUE USEI NO SCRIPT)
      const prompt = `Você é um auditor jurídico militar rigoroso. Analise se a questão abaixo é 100% FIEL ao texto legal fornecido.
      
TEXTO LEGAL (${q.disciplina}):
${lawText.substring(0, 30000)}

QUESTÃO:
ID: ${q.id} | Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário Atual: ${q.comentario}

SUA TAREFA:
1. O artigo citado no comentário EXISTE no texto legal acima?
2. O conteúdo do comentário está de acordo com o que diz o artigo citado?
3. Se houver QUALQUER erro de citação ou conteúdo, REESCREVA a questão (enunciado, alternativas, gabarito e comentário) para que ela fique 100% correta conforme a lei seca.
4. O comentário DEVE citar o artigo/parágrafo/inciso literal (ex: "Conforme o Art. 10, § 1º...").

Responda APENAS em JSON:
{
  "valida": true/false,
  "motivo_erro": "se houver erro, explique aqui",
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
          response_format: { type: "json_object" }
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        let content = aiData.choices?.[0]?.message?.content || "";
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(content);

        if (result.valida === false) {
          // Garantir gabarito numérico 0-4
          let gabaritoNum = parseInt(result.gabarito);
          if (isNaN(gabaritoNum)) gabaritoNum = 0;
          result.gabarito = Math.max(0, min(4, gabaritoNum));

          // Atualizar no banco
          const { valida, motivo_erro, ...updateData } = result;
          await supabase.from("questoes").update(updateData).eq("id", q.id);
          fixedCount++;
          results.push({ id: q.id, status: "corrigida", motivo: result.motivo_erro });
        } else {
          okCount++;
          results.push({ id: q.id, status: "ok", motivo: "Validada contra a lei seca" });
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      total_processado: questions.length,
      ok: okCount, 
      corrigidas: fixedCount, 
      detalhes: results,
      last_id: questions[questions.length-1]?.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
