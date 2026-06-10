import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const MASTER = `============================================================
DIRETRIZ OFICIAL DA BANCA — PROMPT MESTRE (PRECEDÊNCIA MÁXIMA)
============================================================
Você é uma banca examinadora de alto nível jurídico-militar responsável por elaborar questões para o Processo Seletivo Interno CHOA/2026 da PMTO.
Crie questões objetivas comentadas da disciplina indicada, conforme o Edital nº 001/2026, utilizando EXCLUSIVAMENTE o conteúdo existente na base interna.
A RESPOSTA FINAL deve ser entregue APENAS como JSON válido — NÃO use markdown.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("MARITACA_API_KEY")!;
  const base = Deno.env.get("AI_MARITACA_BASE_URL") ?? "https://chat.maritaca.ai/api";
  const url = `${base.replace(/\/$/, "")}/chat/completions`;
  const model = Deno.env.get("AI_MARITACA_GENERATION_MODEL") ?? "sabia-4";

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await supabase.from("discipline_legal_texts").select("content").eq("disciplina", "Redação Oficial").single();
  const sourceContent = row?.content ? String(row.content).trim() : "";

  const systemPrompt = `${MASTER}

Você é uma BANCA EXAMINADORA DE REDAÇÃO OFICIAL MILITAR DE ALTÍSSIMO NÍVEL para o concurso interno CHOA/2026 da PMTO. Sua missão é elaborar questões objetivas sobre o MANUAL DE REDAÇÃO OFICIAL DA PMTO — Item 6, subitens 6.1 a 6.8 — com 5 alternativas e apenas uma correta.

ESCOPO ESTRITO (Edital nº 001/2026): cobre APENAS os ASPECTOS CONCEITUAIS de cada documento — DEFINIÇÃO, FINALIDADE e HIPÓTESES DE UTILIZAÇÃO. É EXPRESSAMENTE PROIBIDO cobrar estrutura, formatação, partes constitutivas.`;

  const fonteBlock = `TEXTO OFICIAL — FONTE ÚNICA (Manual de Redação Oficial da PMTO, Item 6):\n"""${(sourceContent || "").slice(0, 14000)}"""`;

  const prompt = `DADOS DA GERAÇÃO
Disciplina: Redação Oficial
Quantidade exata de questões a gerar: 2

${fonteBlock}

REGRAS DE QUALIDADE:
- O comentário deve funcionar como AULA CURTA (entre 900 e 2400 caracteres). Consolide no campo "comentario", com rótulos: **Comentário do professor:**; **Análise das alternativas:** (CADA A–E); **Dica de prova:**; **Base normativa:**.

REGRAS DE SAÍDA — responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown e sem texto fora do objeto, no formato {"questions":[...]}.
Campos obrigatórios por questão: "disciplina", "assunto", "dificuldade", "enunciado", "alt_a".."alt_e", "gabarito" (0-4), "comentario", "cognitive_skill", "trap_type".

Se NÃO for possível gerar nenhuma questão válida dentro do escopo, retorne {"questions":[],"erro":"NAO_FOI_POSSIVEL_GERAR"}.`;

  const body = {
    model, max_tokens: 5200, temperature: 0.4, stream: false,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  const content = json?.choices?.[0]?.message?.content ?? null;
  return new Response(JSON.stringify({
    status: resp.status,
    source_len: sourceContent.length,
    finish_reason: json?.choices?.[0]?.finish_reason ?? null,
    usage: json?.usage ?? null,
    content_len: content ? content.length : 0,
    content_preview: content ? content.slice(0, 1500) : null,
    content_tail: content ? content.slice(-600) : null,
    raw_text_preview: json ? null : text.slice(0, 800),
  }, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
