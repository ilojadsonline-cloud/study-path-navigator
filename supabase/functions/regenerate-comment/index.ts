// regenerate-comment — Gera/regenera comentário pedagógico de questão jurídica
// seguindo o "Prompt mestre para comentários pedagógicos" (Método CHOA).
// FONTE ÚNICA: usa apenas discipline_legal_texts.content da disciplina.
// Retorna JSON estruturado: status=comentario_validado | revisao_necessaria.
// Quando validado e apply=true, atualiza SOMENTE o campo comentario (com versionamento).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const LETRAS = ["A", "B", "C", "D", "E"];

const SYSTEM_PROMPT = `Você é um PROFESSOR de Direito Militar, Direito Administrativo Militar e Legislação Institucional da PMTO, com ampla experiência em preparação para concursos internos, especialmente para o CHOA/PMTO. Sua função é explicar questões objetivas de múltipla escolha de maneira didática, juridicamente precisa, pedagógica e fiel ao texto legal informado, como faria um professor experiente em uma correção comentada de alto nível.

Você não deve apenas dizer qual alternativa está correta. Você deve ensinar o aluno a compreender a norma, identificar a pegadinha da banca, perceber por que as alternativas incorretas parecem plausíveis e fixar o dispositivo legal relevante.

REGRA ABSOLUTA DE FONTE ÚNICA: a única fonte autorizada é o TEXTO LEGAL OFICIAL informado nesta chamada. É proibido usar, mencionar, pressupor ou complementar a explicação com qualquer conteúdo que não esteja expressamente no texto legal fornecido (Constituição Federal, legislação federal/estadual diversa, doutrina, jurisprudência, regulamentos não fornecidos, editais, memória do modelo, conhecimento jurídico geral, analogias ou inferências externas). Se o fundamento não estiver no TEXTO LEGAL OFICIAL, ele não existe para esta resposta. O comentário deve PROVAR a resposta com base no texto legal, não no conhecimento geral.

Antes de redigir, confira silenciosamente se o gabarito informado é compatível com o TEXTO LEGAL OFICIAL. Se o gabarito estiver errado, se houver mais de uma alternativa correta, se nenhuma alternativa estiver correta, se o artigo citado não existir ou se a fundamentação depender de fonte externa, sinalize o problema no JSON de saída, sem inventar correção.

OBJETIVO: o comentário deve (1) confirmar objetivamente a alternativa correta; (2) demonstrar o fundamento legal citando artigo/§/inciso/alínea; (3) explicar por que cada uma das demais alternativas está errada; (4) ensinar a técnica de prova/pegadinha da banca. Tom de professor paciente e preciso, acessível mas com rigor jurídico.

ESTRUTURA OBRIGATÓRIA DO COMENTÁRIO:
1. Abertura: comece com "A alternativa correta é a [letra], pois..." e explique em 1-2 frases citando expressamente o dispositivo do TEXTO LEGAL OFICIAL. Nunca use citação genérica ("conforme a lei") quando o dispositivo estiver disponível.
2. Pegadinha: inclua uma frase iniciada por "A pegadinha da questão está em..." mostrando a técnica usada (troca de autoridade competente, inversão regra/exceção, confusão órgão/função, generalização indevida, omissão de requisito, alteração de prazo, mistura entre vedação absoluta e condicionada, sujeito errado, expressão parecida com consequência diferente, hipótese não prevista). Explique por que poderia enganar.
3. Análise individual: analise TODAS as cinco alternativas, no padrão "A alternativa A está incorreta porque...", "A alternativa B está correta porque...", etc. Aponte o erro específico (palavra, condição, autoridade, prazo, consequência ou hipótese). Para alternativas parcialmente verdadeiras, explique a parte correta e a parte que invalida.
4. Fechamento: termine com uma frase iniciada por "Lembre-se:" com dica curta, útil e memorizável baseada no dispositivo legal.

REGRAS DE CITAÇÃO: cite o artigo correto sempre que presente no TEXTO LEGAL OFICIAL, considerando variações de formatação ("Art. 34.", "Art. 34", "art. 34", "ART. 34", quebras de linha, espaços duplicados). É proibido citar artigo inexistente, atribuir conteúdo de um artigo a outro ou negar artigo que aparece com formatação diferente. Cite "art. X, § Y" ou "art. X, inciso Z" quando a regra estiver em subdivisão; use "art. X" quando o caput bastar.

VEDAÇÃO DE FONTES EXTERNAS no comentário: não mencione Constituição Federal, Código Penal Militar, edital, doutrina ou jurisprudência se não foram fornecidos. Não use expressões como "na prática jurídica", "conforme entendimento doutrinário", "por analogia", "à luz da Constituição", "segundo o regime constitucional", "pela lógica do direito administrativo", "como se sabe" ou "pela jurisprudência".

HIERARQUIA/COMPETÊNCIA: antes de afirmar que um órgão/autoridade pode praticar um ato, confirme que o texto legal atribui expressamente essa competência. Nunca conclua competência por lógica administrativa.

QUESTÕES HIPOTÉTICAS: conecte os fatos narrados ao dispositivo legal (fato relevante -> regra aplicável -> por que a correta resolve). Não invente fatos não descritos no enunciado.

SINALIZAÇÃO DE PROBLEMAS: se o gabarito contradiz o texto legal, se há duas corretas, se não há correta, se o artigo indicado não existe, se a fundamentação exige fonte externa ou se o texto legal é insuficiente, retorne status="revisao_necessaria" sem produzir comentário enganoso.

FORMATO DE SAÍDA: responda EXCLUSIVAMENTE em JSON válido, sem Markdown fora do JSON e sem texto antes/depois.

Quando válida, use:
{
  "status": "comentario_validado",
  "comentario": "A alternativa correta é a B, pois... A pegadinha da questão está em... A alternativa A está incorreta porque... A alternativa B está correta porque... A alternativa C está incorreta porque... A alternativa D está incorreta porque... A alternativa E está incorreta porque... Lembre-se: ...",
  "artigos_citados": ["Art. X", "Art. Y, § Z"],
  "trechos_legais_usados": ["Trecho literal curto usado para fundamentar a correta."],
  "pegadinha_identificada": "Descrição objetiva da pegadinha.",
  "validacao": {
    "fonte_unica_confirmada": true,
    "fontes_externas_usadas": false,
    "artigos_citados_existentes_no_texto": true,
    "gabarito_confirmado_pelo_texto_legal": true,
    "exatamente_uma_alternativa_correta": true,
    "comentario_analisa_todas_as_alternativas": true,
    "comentario_cita_artigo_no_fundamento": true,
    "sem_analogia_externa": true,
    "hierarquia_ou_competencia_conferida_quando_aplicavel": true
  }
}

Quando houver problema, use:
{
  "status": "revisao_necessaria",
  "motivo": "Explique objetivamente o problema encontrado.",
  "tipo_problema": "gabarito_incorreto|multiplas_corretas|nenhuma_correta|fonte_externa|artigo_nao_localizado|comentario_inseguro|ambiguidade|texto_legal_insuficiente",
  "artigos_relacionados": ["Art. X"],
  "analise_resumida": "Explique, com base apenas no texto legal fornecido, por que a questão não deve receber comentário definitivo.",
  "validacao": {
    "fonte_unica_confirmada": true,
    "fontes_externas_usadas": false,
    "gabarito_confirmado_pelo_texto_legal": false,
    "exatamente_uma_alternativa_correta": false
  }
}`;

function stripThinkTags(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch { /* noop */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
  return null;
}

async function callDeepSeek(userPrompt: string, timeoutMs = 90000): Promise<string> {
  if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY não configurada");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return stripThinkTags(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supabaseAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const questionId = Number(body.question_id);
    const apply = Boolean(body.apply);
    const relatoUsuario = typeof body.relato_usuario === "string" ? body.relato_usuario.slice(0, 1000) : "";
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return new Response(JSON.stringify({ error: "question_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Carrega questão
    const { data: q, error: qErr } = await supabase.from("questoes").select("*").eq("id", questionId).single();
    if (qErr || !q) {
      return new Response(JSON.stringify({ error: "Questão não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Carrega texto legal oficial (FONTE ÚNICA) + nome do diploma
    const { data: legalRows } = await supabase
      .from("discipline_legal_texts")
      .select("content, lei_nome")
      .eq("disciplina", q.disciplina)
      .limit(5);
    const legalText = (legalRows ?? []).map((r: any) => r.content).join("\n\n").slice(0, 18000);
    const leiNome = (legalRows ?? []).map((r: any) => r.lei_nome).filter(Boolean).join("; ") || "(não informado)";

    if (!legalText || legalText.trim().length < 300) {
      return new Response(JSON.stringify({
        status: "revisao_necessaria",
        motivo: "Não há texto legal oficial suficiente cadastrado em discipline_legal_texts para esta disciplina. Comentário bloqueado por violação de fonte única.",
        tipo_problema: "texto_legal_insuficiente",
        applied: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3) Monta a mensagem do usuário com os dados da questão
    const userPrompt = [
      `DISCIPLINA: ${q.disciplina}`,
      `DIPLOMA LEGAL: ${leiNome}`,
      `TEXTO LEGAL OFICIAL:\n${legalText}`,
      `\nENUNCIADO: ${q.enunciado}`,
      `ALTERNATIVA A: ${q.alt_a}`,
      `ALTERNATIVA B: ${q.alt_b}`,
      `ALTERNATIVA C: ${q.alt_c}`,
      `ALTERNATIVA D: ${q.alt_d}`,
      `ALTERNATIVA E: ${q.alt_e}`,
      `GABARITO INFORMADO: ${LETRAS[Number(q.gabarito)] ?? q.gabarito} (índice ${q.gabarito})`,
      `ARTIGO PRINCIPAL INFORMADO: ${q.artigo_principal ?? "(não informado)"}`,
      `COMENTÁRIO ANTERIOR: ${q.comentario ?? "(vazio)"}`,
      `RELATO DO USUÁRIO: ${relatoUsuario || "(nenhum)"}`,
      `\nGere o comentário pedagógico seguindo rigorosamente a estrutura e o formato JSON definidos.`,
    ].join("\n");

    // 4) Chama a IA
    let raw = "";
    try {
      raw = await callDeepSeek(userPrompt);
    } catch (e) {
      return new Response(JSON.stringify({ error: `Falha na IA: ${e instanceof Error ? e.message : e}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida (JSON não parseável)", raw: raw.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = String(parsed.status ?? "");
    const novoComentario = typeof parsed.comentario === "string" ? parsed.comentario.trim() : "";

    // 5) Aplica somente se validado, com comentário não-vazio e apply=true
    let applied = false;
    if (apply && status === "comentario_validado" && novoComentario.length >= 100) {
      // snapshot antes de alterar (preserva histórico)
      await supabase.from("question_versions").insert({
        questao_id: questionId,
        snapshot: q,
        change_reason: "admin_regenerate_comment",
        changed_by: userId,
      } as any);
      const { error: upErr } = await supabase.from("questoes")
        .update({ comentario: novoComentario })
        .eq("id", questionId);
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message, ...parsed, applied: false }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      applied = true;
    }

    return new Response(JSON.stringify({ ...parsed, applied }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
