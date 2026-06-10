import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("MARITACA_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "NO_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const base = Deno.env.get("AI_MARITACA_BASE_URL") ?? "https://chat.maritaca.ai/api";
  const url = `${base.replace(/\/$/, "")}/chat/completions`;
  const model = Deno.env.get("AI_MARITACA_GENERATION_MODEL") ?? "sabia-4";

  const body = {
    model,
    max_tokens: 5200,
    temperature: 0.4,
    stream: false,
    messages: [
      { role: "system", content: "Você é um gerador de questões. Responda EXCLUSIVAMENTE com JSON válido." },
      { role: "user", content: 'Gere 1 questão de múltipla escolha simples sobre crase. Responda APENAS com o objeto JSON no formato {"questions":[{"disciplina":"Língua Portuguesa","assunto":"crase","dificuldade":"Médio","enunciado":"...","alt_a":"...","alt_b":"...","alt_c":"...","alt_d":"...","alt_e":"...","gabarito":0,"comentario":"...","cognitive_skill":"...","trap_type":"..."}]}' },
    ],
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* keep raw */ }
    const content = json?.choices?.[0]?.message?.content ?? null;
    const finish = json?.choices?.[0]?.finish_reason ?? null;
    return new Response(JSON.stringify({
      status: resp.status,
      url,
      model,
      finish_reason: finish,
      usage: json?.usage ?? null,
      content_len: content ? content.length : 0,
      content_preview: content ? content.slice(0, 2000) : null,
      raw_keys: json ? Object.keys(json) : null,
      raw_text_preview: json ? null : text.slice(0, 1000),
    }, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
