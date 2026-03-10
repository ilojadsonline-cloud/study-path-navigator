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
    const limit = Math.min(body.limit || 10, 20); // Limite para evitar timeout

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    // 1. Buscar questões para validar/reparar
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
        okCount++; // Se não tem lei para comparar, mantemos como está
        results.push({ id: q.id, status: "pular", motivo: "Sem texto legal" });
        continue;
      }

      // Verificação rápida: o artigo citado no comentário existe na lei?
      const cited = q.comentario?.match(/art(?:igo)?\.?\s*(\d+)/i);
      const artNum = cited ? cited[1] : null;
      const artExists = artNum && (lawText.toLowerCase().includes(`art. ${artNum}`) || lawText.toLowerCase().includes(`artigo ${artNum}`));

      if (artExists) {
        okCount++;
        results.push({ id: q.id, status: "ok", motivo: "Artigo validado" });
        continue;
      }

      // Se o artigo não existe ou não foi citado, usamos a IA para REPARAR
      const prompt = `Você é um revisor jurídico. Corrija a questão para que ela fique 100% fiel ao texto legal fornecido.
      
TEXTO LEGAL (${q.disciplina}):
${lawText.substring(0, 25000)}

QUESTÃO ORIGINAL:
ID: ${q.id} | Enunciado: ${q.enunciado}
A) ${q.alt_a} | B) ${q.alt_b} | C) ${q.alt_c} | D) ${q.alt_d} | E) ${q.alt_e}
Gabarito Atual: ${String.fromCharCode(65 + q.gabarito)} | Comentário Atual: ${q.comentario}

Responda APENAS em JSON:
{
  "enunciado": "enunciado corrigido",
  "alt_a": "...", "alt_b": "...", "alt_c": "...", "alt_d": "...", "alt_e": "...",
  "gabarito": 0,
  "comentario": "Comentário corrigido com citação real da lei"
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

        // Atualizar no banco
        await supabase.from("questoes").update(corrected).eq("id", q.id);
        fixedCount++;
        results.push({ id: q.id, status: "corrigida", motivo: "IA reparou a questão" });
      }
      await new Promise(r => setTimeout(r, 400));
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
