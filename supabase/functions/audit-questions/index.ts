import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const AUTO_FIX_CONFIDENCE = 0.85;
const AUTO_FIX_RISK_ALLOWED = ["low", "medium"]; // só "high" exige humano
const MAX_PER_INVOCATION = 4; // mais ritmo sem sacrificar qualidade
const PROCESS_CONCURRENCY = 2; // 2 chamadas IA em paralelo, dentro do limite de 150s
const PAGE_Q = 250;
const OPEN_AUDIT_STATUSES = ["manual_review", "pending", "error"];

// Estados do ciclo de vida da auditoria (em public.questoes.audit_status)
const Q_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  AUTO_CORRECTED: "auto_corrected",
  MANUAL: "manual_review",
  ADMIN_RESOLVED: "admin_resolved",
  DELETED: "deleted",
} as const;

/** Atualiza o estado de auditoria persistente da questão. */
async function setQuestionAuditStatus(
  supabase: ReturnType<typeof createClient>,
  questaoId: number,
  status: string,
  techniques?: string[],
) {
  const patch: any = { audit_status: status, audit_status_updated_at: new Date().toISOString() };
  if (Array.isArray(techniques)) patch.audit_techniques = techniques;
  await supabase.from("questoes").update(patch).eq("id", questaoId);
}

type Questao = {
  id: number;
  disciplina: string;
  assunto: string;
  enunciado: string;
  alt_a: string;
  alt_b: string;
  alt_c: string;
  alt_d: string;
  alt_e: string;
  gabarito: number;
  comentario: string;
  artigo_principal?: string | null;
};

type AuditResult = {
  confidence: number;
  risk_level: "low" | "medium" | "high";
  issues: Array<{ type: string; severity: string; description: string }>;
  proposed_patch: Partial<Questao> | null;
  needs_human_review: boolean;
  ai_summary: string;
  techniques_used: string[];
};

function stripThinkTags(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function callDeepSeek(prompt: string, timeoutMs = 55000): Promise<string> {
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
          {
            role: "system",
            content:
              "Você é AUDITOR INTEGRAL e PROFESSOR ORIENTADOR de questões objetivas para concursos militares e jurídicos (PMTO, FGV/CESPE/VUNESP). Auditoria SEM amostragem: leia enunciado, A–E, gabarito e comentário inteiros e confronte TUDO com o TEXTO LEGAL DE REFERÊNCIA. Detecte e (sempre que seguro) CORRIJA: alucinação jurídica, bug estrutural, comentário ausente/loop, duas+ alternativas corretas, nenhuma correta, violação de hierarquia funcional, função incompatível com o posto, duplicata, incoerência, distratores fracos, gabarito visualmente identificável, desalinhamento, legislação revogada/desatualizada, comentário que não analisa cada alternativa, e PADRÃO ANTIÉTICO 'alternativa correta = a mais longa OU a mais curta' do conjunto. Reescrever é PREFERÍVEL a marcar para revisão humana. Use estes códigos de issue quando aplicável: length_bias (gabarito é o mais longo/curto), insufficient_distractors (<2 técnicas de distração), hierarquia_violada, multiplas_corretas, texto_legal_desatualizado, duplicada, unrecoverable. Em duplicata e em irrecuperável, defina needs_human_review=false e indique no ai_summary 'AUTO_DELETE: <motivo>' — o sistema excluirá automaticamente. Para texto desatualizado (ex.: 'CPI'/'Comissão de Polícia Interna' substituída por 'CRP'/'Corregedoria' conforme texto vigente), faça a substituição no patch quando o sentido for preservado; senão, mande para revisão manual. TÉCNICAS DE DISTRAÇÃO obrigatórias (use ≥2 ao reescrever): inversão sujeito/predicado, troca de conectivo lógico, prazo trocado, cargo/posto trocado, verbo modal trocado (poderá↔deverá), negação inserida/removida, referência a lei errada, confusão de instância (Conselho↔Comando), completude falsa, generalização indevida. Registre as técnicas usadas em 'techniques_used'. ANTI-LENGTH-BIAS: ao reescrever, garanta que a alternativa correta NÃO seja a de maior nem a de menor número de caracteres do conjunto (±25% de paridade). COMENTÁRIO em 4 movimentos OBRIGATÓRIOS: (1) 'A alternativa correta é a [X], pois...' + citação literal do dispositivo; (2) 'A pegadinha desta questão está em...' nomeando explicitamente a técnica usada; (3) Análise individual de CADA alternativa errada com o dispositivo que a contradiz no formato 'Alternativa [Y]: incorreta porque ... Vide [art. Z]'; (4) 'Lembre-se: segundo o [art. X da Lei Y], [regra geral]'. Tom de tutor experiente. Responda APENAS JSON válido.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 6000,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
    const data = await res.json();
    return stripThinkTags(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

function buildAuditPrompt(q: Questao, legalText: string | null): string {
  const alts = ["A", "B", "C", "D", "E"].map(
    (l, i) => `${l}) ${(q as any)[`alt_${l.toLowerCase()}`]}`
  ).join("\n");
  const correta = ["A", "B", "C", "D", "E"][q.gabarito] ?? "?";

  const legalBlock = legalText
    ? `TEXTO LEGAL DE REFERÊNCIA (use como ÚNICA fonte de verdade):\n"""${legalText.slice(0, 9000)}"""\n`
    : "ATENÇÃO: Não há texto legal disponível para referência cruzada — audite com base em conhecimento jurídico geral mas marque qualquer afirmação não verificável como issue.\n";

  return `${legalBlock}
QUESTÃO #${q.id}
Disciplina: ${q.disciplina}
Assunto: ${q.assunto}
Artigo declarado: ${q.artigo_principal ?? "(não informado)"}

Enunciado:
${q.enunciado}

Alternativas:
${alts}

Gabarito atual: ${correta} (índice ${q.gabarito})

Comentário atual:
${q.comentario}

Audite INTEGRALMENTE esta questão (sem amostragem, sem atalhos por palavra-chave). LEIA enunciado + 5 alternativas + gabarito + comentário e CONFRONTE TUDO com o texto legal acima. Verifique TODOS os defeitos abaixo:

A. ALUCINAÇÃO JURÍDICA — fundamento legal inventado, artigo/inciso/§ que não existe na lei de referência, ou afirmação não amparada pelo texto legal disponível.
B. BUG ESTRUTURAL — campo vazio, alternativa duplicada, formatação corrompida, enunciado truncado.
C. AUSÊNCIA DE COMENTÁRIO — comentario vazio, "(sem comentário)" ou apenas placeholder.
D. COMENTÁRIO EM LOOP — texto circular, repetição da mesma frase, não acrescenta informação, parafraseia o enunciado sem explicar.
E. DUAS OU MAIS ALTERNATIVAS CORRETAS — mais de uma alternativa é defensável à luz da lei.
F. NENHUMA ALTERNATIVA CORRETA — gabarito atual aponta para alternativa errada e nenhuma das outras está correta tampouco.
G. VIOLAÇÃO DE HIERARQUIA — enunciado/alternativas atribuem competência, função, posto ou graduação de forma diferente do que a lei determina.
H. ATRIBUIÇÃO DE FUNÇÃO INCONSISTENTE com o posto/graduação citado (ex.: cabo exercendo função privativa de oficial superior).
I. QUESTÃO INCOERENTE/IMPOSSÍVEL — premissa contraditória, situação juridicamente inviável, sem solução lógica.
J. DISTRATORES FRACOS/ÓBVIOS — alternativas absurdas, genéricas, gritantemente falsas, muito mais curtas/longas, com palavras-âncora isoladas ("sempre/nunca/somente"), "todas/nenhuma das anteriores", "n.d.a.", ou que entregam a resposta por eliminação. (severity medium; high se 2+).
K. GABARITO VISUALMENTE IDENTIFICÁVEL — a correta destoa: única completa, única técnica, única com ressalva, única longa.
L. ENUNCIADO/ALTERNATIVAS/COMENTÁRIO DESALINHADOS entre si — o comentário cita uma alternativa como correta diferente do gabarito, ou o enunciado pergunta X e as alternativas respondem Y.
M. TEXTO LEGAL DESATUALIZADO — questão baseada em dispositivo revogado/alterado/substituído (compare com o texto legal de referência).
N. COMENTÁRIO QUE NÃO EXPLICA CADA ALTERNATIVA INCORRETA INDIVIDUALMENTE — limita-se a "as demais estão erradas" ou explica só a correta.

QUESTÕES INTERPRETATIVAS SÃO VÁLIDAS:
- Reproduzir literalmente a lei NÃO é requisito. Paráfrase, interpretação e combinação de dispositivos são aceitas, desde que FIÉIS à norma.
- Só sinalize "extra_legal/alucinacao_juridica" quando a afirmação CONTRARIAR a lei, inventar requisito/prazo/autoridade inexistente, ou afirmar algo não autorizado.

REGRA DE OURO — NÃO MEXER NO QUE ESTÁ CORRETO:
- Se gabarito está correto (literal OU interpretativamente fiel), as 5 alternativas são plausíveis e equilibradas, enunciado é claro, e o comentário explica corretamente a resposta E os erros das demais (mesmo que de forma sucinta), APROVE com confidence alta, issues=[], proposed_patch=null.
- Em caso de dúvida sobre defeito real, APROVE.

POLÍTICA DE CORREÇÃO:
- TENTE SEMPRE corrigir antes de mandar para revisão humana. Só marque needs_human_review=true quando a correção automática não for SEGURA juridicamente (ex.: você não tem certeza de qual é a resposta correta à luz da lei) ou quando a questão for duplicada e exigir decisão humana sobre exclusão.
- Se o ÚNICO defeito for distrator fraco/óbvio: reescreva APENAS as alternativas problemáticas (preserve o resto). Devolva no patch só os campos alt_X afetados (e "gabarito" se a posição mudou).
- Se houver defeito de gabarito/enunciado/comentário/hierarquia/coerência: reescreva enunciado + alt_a..alt_e + gabarito + comentario JUNTOS.

ALGORITMO DE ESCRITA DAS ALTERNATIVAS (siga à risca quando reescrever qualquer alt_X):
1. PARIDADE FORMAL: 5 alternativas com comprimento similar (±25%), mesmo registro técnico-jurídico, mesma estrutura sintática, pontuação coerente.
2. PARIDADE SEMÂNTICA: todas igualmente plausíveis para quem estudou mas não dominou o detalhe.
3. CADA DISTRATORA = UM ERRO TÍPICO REAL (troca de prazo, troca de autoridade, inversão regra/exceção, confusão entre institutos parecidos, dispositivo revogado, aplicação errada de princípio). Não exponha qual erro no JSON.
4. PROIBIDO: "todas/nenhuma das anteriores", "apenas a alternativa X", "n.d.a.", duplicatas, alternativa que contradiga o enunciado, palavras-âncora isoladas em 1 só.
5. POSIÇÃO DA CORRETA: distribua aleatoriamente A–E (não vicie em C/D). Ajuste "gabarito" (0–4).
6. RESPEITE A HIERARQUIA da lei: cargos, postos, graduações, competências exclusivas devem espelhar EXATAMENTE o que a norma fixa.

REGRAS DE COMENTÁRIO (PROFESSOR ORIENTADOR) — OBRIGATÓRIO quando reescrever comentário:
Estrutura em 4 movimentos, sem títulos visíveis, em parágrafos fluidos:
(1) CONFIRMA a alternativa correta e CITA o dispositivo (Art. X, inciso Y, §Z) com o trecho legal essencial — não basta "conforme o art. X", explique o que ele diz e por que torna a alternativa correta.
(2) NOMEIA EXPLICITAMENTE a pegadinha/trocadilho/elemento de confusão (ex.: "a banca trocou o prazo de 5 por 10 dias", "inverteu a competência do delegado pela do juiz", "aplicou exceção como se fosse regra").
(3) ANALISA CADA ALTERNATIVA INCORRETA INDIVIDUALMENTE: para A, B, C, D, E que não são o gabarito, diga o ERRO ESPECÍFICO (inversão de competência, troca de prazo, atribuição indevida de função, condição inexistente na lei, confusão entre institutos parecidos). Use o formato "A) ... — erro: ...; B) ... — erro: ...". NUNCA escreva "as demais estão incorretas".
(4) Se a questão envolve hierarquia/posto/graduação/comissão/competência exclusiva, REFORÇA a regra geral e as exceções da lei para fixação.
Tom direto, técnico, didático, em pt-BR. Sem repetir o enunciado, sem "conforme a legislação vigente" solto, sem rodeios. 600–1500 caracteres.

REGRAS DE ENUNCIADO (quando reescrever):
- Claro, específico, ancorado na lei. Prefira casos concretos curtos. Mantenha a dificuldade compatível com a original.

Retorne JSON ESTRITO:
{
  "confidence": 0.0-1.0,
  "risk_level": "low" | "medium" | "high",
  "issues": [
    { "type": "gabarito_errado|sem_correta|multiplas_corretas|alucinacao_juridica|bug_estrutural|sem_comentario|comentario_loop|comentario_incompleto|distrator_fraco|gabarito_obvio|hierarquia_violada|funcao_inconsistente|duplicada|incoerente|texto_legal_desatualizado|desalinhamento|extra_legal|alt_duplicada|ambiguidade|outros", "severity": "low|medium|high", "description": "..." }
  ],
  "proposed_patch": {              // null APENAS se a questão estiver impecável. Caso precise de qualquer ajuste relevante, devolva enunciado, alt_a..alt_e, gabarito e comentário JUNTOS.
    "enunciado"?: "...",
    "alt_a"?: "...", "alt_b"?: "...", "alt_c"?: "...", "alt_d"?: "...", "alt_e"?: "...",
    "gabarito"?: 0-4,
    "comentario"?: "..."
  },
  "needs_human_review": true|false,
  "ai_summary": "1-2 frases resumindo o diagnóstico e o que foi reescrito"
}

Se a questão estiver perfeita: confidence alta, issues=[], proposed_patch=null, needs_human_review=false.`;
}

async function auditOne(q: Questao, legalText: string | null): Promise<AuditResult> {
  const raw = await callDeepSeek(buildAuditPrompt(q, legalText));
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return {
      confidence: 0,
      risk_level: "high",
      issues: [{ type: "outros", severity: "high", description: "Auditor IA retornou resposta inválida" }],
      proposed_patch: null,
      needs_human_review: true,
      ai_summary: "Falha de parse do auditor",
    };
  }
  const conf = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
  const risk = ["low", "medium", "high"].includes(parsed.risk_level) ? parsed.risk_level : "medium";
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  let patch = parsed.proposed_patch && typeof parsed.proposed_patch === "object" ? parsed.proposed_patch : null;
  // Sanitiza patch
  if (patch) {
    const allowed = ["gabarito", "comentario", "alt_a", "alt_b", "alt_c", "alt_d", "alt_e", "enunciado"];
    const clean: any = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    if ("gabarito" in clean) {
      const g = Number(clean.gabarito);
      if (!Number.isInteger(g) || g < 0 || g > 4) delete clean.gabarito;
    }
    patch = Object.keys(clean).length ? clean : null;
  }
  return {
    confidence: conf,
    risk_level: risk,
    issues,
    proposed_patch: patch,
    needs_human_review: Boolean(parsed.needs_human_review) || issues.some((i: any) => i?.severity === "high"),
    ai_summary: String(parsed.ai_summary ?? ""),
  };
}

async function processQuestion(
  supabase: ReturnType<typeof createClient>,
  q: Questao,
  legalCache: Map<string, string | null>,
): Promise<{ status: string; auto_fixed: boolean; flagged: boolean }> {
  // Busca texto legal por disciplina (cache)
  let legal = legalCache.get(q.disciplina);
  if (legal === undefined) {
    const { data } = await supabase
      .from("discipline_legal_texts")
      .select("content")
      .eq("disciplina", q.disciplina)
      .limit(5);
    legal = (data ?? []).map((r: any) => r.content).join("\n\n").slice(0, 18000) || null;
    legalCache.set(q.disciplina, legal);
  }

  let result: AuditResult;
  try {
    result = await auditOne(q, legal);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("question_audits").insert({
      questao_id: q.id,
      status: "error",
      confidence: 0,
      risk_level: "high",
      issues: [{ type: "outros", severity: "high", description: msg }],
      ai_summary: "Erro durante auditoria",
    });
    return { status: "error", auto_fixed: false, flagged: false };
  }

  // Considera "sem defeito real" quando não há issues de severidade média/alta.
  const hasRealDefect = result.issues.some(
    (i: any) => i?.severity === "medium" || i?.severity === "high",
  );
  const noIssues = !hasRealDefect && !result.proposed_patch;
  const canAutoFix =
    hasRealDefect &&
    !!result.proposed_patch &&
    result.confidence >= AUTO_FIX_CONFIDENCE &&
    AUTO_FIX_RISK_ALLOWED.includes(result.risk_level) &&
    !result.needs_human_review;

  let finalStatus: string;
  let appliedPatch: any = null;

  if (noIssues) {
    finalStatus = "approved";
  } else if (canAutoFix) {
      await supabase
        .from("question_audits")
        .update({ status: "superseded", updated_at: new Date().toISOString() })
        .eq("questao_id", q.id)
        .in("status", OPEN_AUDIT_STATUSES);

    // Snapshot antes
    const { data: audIns } = await supabase
      .from("question_audits")
      .insert({
        questao_id: q.id,
        status: "auto_fixed",
        confidence: result.confidence,
        risk_level: result.risk_level,
        issues: result.issues,
        proposed_patch: result.proposed_patch,
        applied_patch: result.proposed_patch,
        ai_summary: result.ai_summary,
      })
      .select("id")
      .single();

    await supabase.from("question_versions").insert({
      questao_id: q.id,
      snapshot: q,
      change_reason: "auto_fix_audit",
      audit_id: audIns?.id ?? null,
    });

    await supabase.from("questoes").update(result.proposed_patch).eq("id", q.id);
    appliedPatch = result.proposed_patch;
    return { status: "auto_fixed", auto_fixed: true, flagged: false };
  } else {
    finalStatus = "manual_review";
  }

  if (finalStatus === "approved" || finalStatus === "manual_review") {
    await supabase
      .from("question_audits")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("questao_id", q.id)
      .in("status", OPEN_AUDIT_STATUSES);
  }

  await supabase.from("question_audits").insert({
    questao_id: q.id,
    status: finalStatus,
    confidence: result.confidence,
    risk_level: result.risk_level,
    issues: result.issues,
    proposed_patch: result.proposed_patch,
    applied_patch: appliedPatch,
    ai_summary: result.ai_summary,
  });

  return {
    status: finalStatus,
    auto_fixed: false,
    flagged: finalStatus === "manual_review",
  };
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
    const action = body.action ?? "run";

    // Ações: start (cria job), run (processa lote), status (consulta job), cancel
    if (action === "start") {
      const scope = {
        disciplinas: Array.isArray(body.disciplinas) ? body.disciplinas : null,
        only_unaudited: body.only_unaudited !== false,
        limit: Math.min(Number(body.limit ?? 200), 100000),
      };

      // Conta total elegível
      let countQ = supabase.from("questoes").select("id", { count: "exact", head: true });
      if (scope.disciplinas?.length) countQ = countQ.in("disciplina", scope.disciplinas);
      const { count } = await countQ;

      const { data: job } = await supabase.from("audit_jobs").insert({
        user_id: userId,
        status: "running",
        scope,
        total: Math.min(count ?? 0, scope.limit),
      }).select("*").single();

      return new Response(JSON.stringify({ job }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: job } = await supabase.from("audit_jobs").select("*").eq("id", body.job_id).single();
      return new Response(JSON.stringify({ job }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      await supabase.from("audit_jobs").update({ status: "canceled" }).eq("id", body.job_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "run": processa próximo lote do job
    const jobId = body.job_id;
    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job } = await supabase.from("audit_jobs").select("*").eq("id", jobId).single();
    if (!job || job.status !== "running") {
      return new Response(JSON.stringify({ error: "Job não está em execução", job }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Paginação por cursor persistido no job: evita recomeçar do ID 0 a cada chamada.
    const pending: any[] = [];
    let cursor = Number(job.scope?.cursor_id ?? 0);
    let nextCursor = cursor;
    let reachedEnd = false;
    const remaining = Math.max(0, (job.total ?? 0) - (job.processed ?? 0));
    const batchTarget = Math.min(MAX_PER_INVOCATION, remaining || MAX_PER_INVOCATION);
    while (pending.length < batchTarget) {
      let qBuilder = supabase
        .from("questoes")
        .select("*")
        .order("id", { ascending: true })
        .gt("id", cursor)
        .limit(PAGE_Q);
      if (job.scope?.disciplinas?.length) qBuilder = qBuilder.in("disciplina", job.scope.disciplinas);
      const { data: candidates, error: cErr } = await qBuilder;
      if (cErr || !candidates || candidates.length === 0) break;
      const candidateIds = (candidates as any[]).map((q) => q.id);
      const auditedIds = new Set<number>();
      if (job.scope?.only_unaudited && candidateIds.length) {
        const { data: auditedPage } = await supabase
          .from("question_audits")
          .select("questao_id")
          .in("questao_id", candidateIds)
          .not("status", "eq", "superseded");
        for (const r of auditedPage ?? []) auditedIds.add((r as any).questao_id);
      }
      let consumedFullPage = true;
      for (const q of candidates as any[]) {
        cursor = q.id;
        nextCursor = cursor;
        if (!job.scope?.only_unaudited || !auditedIds.has(q.id)) {
          pending.push(q);
          if (pending.length >= batchTarget) {
            consumedFullPage = q.id === (candidates[candidates.length - 1] as any).id;
            break;
          }
        }
      }
      if (pending.length >= batchTarget) {
        if (consumedFullPage && candidates.length < PAGE_Q) reachedEnd = true;
        break;
      }
      if (candidates.length < PAGE_Q) {
        reachedEnd = true;
        break;
      }
    }

    if (pending.length === 0) {
      const finalScope = { ...(job.scope ?? {}), cursor_id: nextCursor };
      const finalTotal = job.scope?.only_unaudited ? (job.processed ?? 0) : (job.total ?? 0);
      const { data: doneJob } = await supabase.from("audit_jobs").update({
        status: "done",
        scope: finalScope,
        total: finalTotal,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId).select("*").single();
      return new Response(JSON.stringify({ done: true, job_id: jobId, job: doneJob }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const legalCache = new Map<string, string | null>();
    let processed = 0, autoFixed = 0, flagged = 0, errors = 0;
    let lastBatchError: string | null = null;

    for (let i = 0; i < pending.length; i += PROCESS_CONCURRENCY) {
      const chunk = pending.slice(i, i + PROCESS_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((q) => processQuestion(supabase, q as Questao, legalCache)),
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          const r = result.value;
          processed++;
          if (r.auto_fixed) autoFixed++;
          if (r.flagged) flagged++;
          if (r.status === "error") errors++;
        } else {
          errors++;
          const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          lastBatchError = msg;
          await supabase.from("audit_jobs").update({ last_error: msg }).eq("id", jobId);
        }
      }
    }

    const newProcessed = (job.processed ?? 0) + processed;
    const newAutoFixed = (job.auto_fixed ?? 0) + autoFixed;
    const newFlagged = (job.flagged ?? 0) + flagged;
    const newErrors = (job.errors ?? 0) + errors;
    const isDone = reachedEnd || newProcessed >= (job.total ?? 0);
    const finalTotal = isDone && reachedEnd && job.scope?.only_unaudited && newProcessed < (job.total ?? 0)
      ? newProcessed
      : (job.total ?? 0);
    const nextScope = { ...(job.scope ?? {}), cursor_id: nextCursor };

    const { data: updatedJob } = await supabase.from("audit_jobs").update({
      processed: newProcessed,
      auto_fixed: newAutoFixed,
      flagged: newFlagged,
      errors: newErrors,
      total: finalTotal,
      scope: nextScope,
      status: isDone ? "done" : "running",
      last_error: lastBatchError,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId).select("*").single();

    return new Response(JSON.stringify({
      processed_in_batch: processed,
      auto_fixed_in_batch: autoFixed,
      flagged_in_batch: flagged,
      errors_in_batch: errors,
      total_processed: newProcessed,
      done: isDone,
      job_id: jobId,
      job: updatedJob,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
