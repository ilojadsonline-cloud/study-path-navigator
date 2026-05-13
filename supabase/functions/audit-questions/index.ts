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

const AUTO_FIX_CONFIDENCE = 0.9;
const AUTO_FIX_RISK = "low";
const MAX_PER_INVOCATION = 4; // mais ritmo sem sacrificar qualidade
const PROCESS_CONCURRENCY = 2; // 2 chamadas IA em paralelo, dentro do limite de 150s
const PAGE_Q = 250;
const OPEN_AUDIT_STATUSES = ["manual_review", "pending", "error"];

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
              "Você é AUDITOR INTEGRAL e PROFESSOR ORIENTADOR de questões objetivas para concursos militares e jurídicos (PMTO, FGV/CESPE/VUNESP). Sua auditoria NÃO é por amostragem nem por palavras-chave: você LÊ a questão inteira (enunciado, A, B, C, D, E, gabarito e comentário) E confronta TUDO com o TEXTO LEGAL DE REFERÊNCIA fornecido. O objetivo central é garantir que enunciado, alternativas, gabarito e comentário estejam em SINTONIA entre si e FIÉIS à norma vigente. Você deve detectar, registrar e CORRIGIR (sempre que possível com segurança jurídica) todos estes defeitos: alucinação jurídica (fundamento inexistente), bug estrutural (campo vazio/corrompido), ausência de comentário, comentário em loop/circular, duas ou mais alternativas corretas, nenhuma correta, violação de hierarquia (atribui posto/função/competência diferente do que a lei fixa), atribuição de função incompatível com o posto/graduação citado, questão duplicada, questão incoerente/impossível, distratores fracos/óbvios, gabarito visualmente identificável (único completo, único técnico, único com ressalva), desalinhamento entre enunciado/alternativas/comentário, texto legal desatualizado/revogado, comentário que não explica cada alternativa individualmente. Reescrever é PREFERÍVEL a marcar para revisão humana — só envie para revisão manual quando a correção automática não for SEGURA juridicamente ou exigir julgamento humano sobre interpretação. Quando reescrever, eleve a questão ao padrão de banca de elite: distratores plausíveis baseados em ERROS TÍPICOS reais (troca de prazo, troca de autoridade, inversão regra/exceção, confusão entre institutos parecidos, dispositivo revogado, aplicação errada de princípio). Comentário OBRIGATORIAMENTE no perfil PROFESSOR ORIENTADOR: (1) confirma a correta e cita o dispositivo legal exato (Art./inciso/§) com o trecho relevante; (2) nomeia explicitamente a pegadinha/trocadilho/elemento de confusão; (3) analisa CADA alternativa incorreta individualmente, dizendo o erro específico (não 'as demais estão erradas'); (4) quando houver hierarquia/posto/competência exclusiva, reforça a regra geral e as exceções. Tom direto, técnico, didático, sem rodeios, sem repetir o enunciado, sem 'conforme a legislação vigente' solto. Responda APENAS JSON válido.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
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

Audite com rigor de banca examinadora. Verifique APENAS problemas REAIS de correção/coerência:
1. Gabarito está correto à luz do texto legal? (mais grave)
2. Enunciado tem ambiguidade real, erro de português que prejudique o entendimento, ou pegadinha mal feita que induza a erro injusto?
3. Existe MAIS de uma alternativa correta? Existe NENHUMA correta?
4. DISTRATORES ÓBVIOS — defeito sério, deve ser corrigido SEMPRE que presente. Marque issue "distrator_fraco" com severity MEDIUM (HIGH se 2+ alternativas forem facilmente descartáveis). São considerados óbvios:
   • Distrator absurdo, sem qualquer relação com o tema (instituto inexistente, dado fantasioso).
   • Distrator gritantemente falso ao senso comum jurídico (ex.: "ministro do STF é eleito por voto popular").
   • Distrator visivelmente mais curto/longo que os demais — denuncia a resposta de cara.
   • Distrator que repete trecho do enunciado quase literalmente.
   • Palavras-âncora ("sempre", "nunca", "somente", "exclusivamente") em apenas 1 alternativa enquanto as demais são moderadas.
   • Registro/estilo destoante (4 técnicas + 1 coloquial; 4 afirmativas + 1 interrogativa).
   • "Todas as anteriores", "Nenhuma das anteriores", "Apenas a alternativa X está correta", "N.D.A.".
5. Há afirmação extra-legal, inventada, ou que CONTRARIA o texto legal?
6. Comentário CONTRADIZ o gabarito, está factualmente errado, ou cita dispositivo errado?
7. Alternativas duplicadas, vazias ou idênticas em conteúdo?

QUESTÕES INTERPRETATIVAS SÃO VÁLIDAS:
- Reproduzir literalmente o texto da lei NÃO é requisito. Alternativas e enunciados podem PARAFRASEAR, INTERPRETAR ou COMBINAR dispositivos de uma ou mais leis do edital, desde que o conteúdo seja FIEL ao que a norma efetivamente determina.
- NÃO marque como defeito apenas porque a alternativa correta não aparece "ipsis litteris" no texto legal. Só sinalize "extra_legal" quando a afirmação CONTRARIAR a norma, inventar requisito/prazo/autoridade inexistente, ou afirmar algo que a lei não autoriza.
- Questões que exigem maior esforço interpretativo do aluno (aplicação a caso concreto, comparação entre institutos, combinação de artigos) são desejáveis e devem ser preservadas.

REGRA DE OURO — NÃO MEXER NO QUE ESTÁ CORRETO:
- Se o gabarito está correto (literal OU interpretativamente fiel à norma), as 5 alternativas são plausíveis (todas defensáveis para um aluno mediano), o enunciado é claro e o comentário é coerente (mesmo que curto, simples ou sem floreio), a questão é APROVADA. Devolva confidence alta, issues=[], proposed_patch=null.
- NÃO reescreva comentários apenas por serem curtos/simples/sem citar Art./§. Só sinalize "comentario_incoerente" quando ele estiver factualmente ERRADO ou CONTRADIZER o gabarito.
- NÃO reescreva questões apenas por estarem "fáceis demais". Dificuldade baixa NÃO é defeito.
- Em caso de dúvida sobre defeito real, APROVE.

REGRA DE REESCRITA (use APENAS quando houver defeito real de média/alta gravidade):
- Se o ÚNICO defeito for distrator fraco/óbvio: reescreva APENAS as alternativas problemáticas (preserve as boas, preserve enunciado/gabarito/comentário se estiverem corretos). No proposed_patch devolva só os campos alt_X afetados (e o "gabarito" atualizado caso a posição da correta tenha mudado).
- Se o defeito for de gabarito/enunciado/comentário: reescreva tudo (enunciado + alt_a..alt_e + gabarito + comentário).

ALGORITMO DE ESCRITA DAS ALTERNATIVAS (siga à risca quando reescrever qualquer alt_X):
1. PARIDADE FORMAL: as 5 alternativas devem ter comprimento parecido (variação ±25% em caracteres), mesmo registro técnico-jurídico, mesma estrutura sintática (todas começam por verbo OU todas por substantivo) e pontuação coerente.
2. PARIDADE SEMÂNTICA: todas igualmente plausíveis para alguém que estudou mas não dominou o detalhe — nada absurdo, nada inventado.
3. CADA DISTRATORA = UM ERRO TÍPICO REAL DO ESTUDANTE, escolhido entre:
   (a) Troca de prazo (5 dias por 10 dias).
   (b) Troca de autoridade/órgão competente (Delegado por Juiz; Ministro por Presidente).
   (c) Inversão regra ↔ exceção.
   (d) Confusão entre institutos parecidos (preventiva × temporária; dolo eventual × culpa consciente).
   (e) Dispositivo revogado/alterado ou de outra lei próxima.
   (f) Aplicação errada de princípio correto (princípio existe, mas não incide aqui).
   Anote MENTALMENTE qual erro cada distratora explora antes de escrever — não exponha no JSON.
4. PROIBIDO: "todas/nenhuma das anteriores", "apenas a alternativa X", "n.d.a.", duplicatas, alternativa que contradiga o enunciado, palavras-âncora isoladas em 1 só alternativa.
5. POSIÇÃO DA CORRETA: distribua aleatoriamente entre A–E (não vicie em C/D). Ajuste "gabarito" (0–4) conforme a nova posição.
6. SOM DE BANCA: linguagem objetiva, terceira pessoa, sem ironia, sem exemplos hipotéticos longos dentro da alternativa — o caso vai no enunciado.

REGRAS DE ENUNCIADO (quando reescrever):
- Claro, específico, ancorado no texto legal. Prefira casos concretos curtos ou comparação entre institutos. Evite "qual o artigo X" literal. Mantenha dificuldade compatível com a original (não infle artificialmente).

REGRAS DE COMENTÁRIO (PROFESSOR ORIENTADOR) — quando reescrever comentário:
- 300–700 caracteres, tom de professor conversando com o aluno.
- Estrutura: 1 frase contextualizando o instituto; citação do dispositivo (Art. X, inciso Y, §Z) explicando por que a correta é correta; quando útil, 1 frase sobre a "pegadinha" da distratora mais perigosa.
- Sem repetir a alternativa inteira, sem enrolação, em pt-BR. Nada de "conforme a lei vigente" sem citar qual.

Retorne JSON ESTRITO:
{
  "confidence": 0.0-1.0,           // sua confiança no diagnóstico
  "risk_level": "low" | "medium" | "high",  // risco de aplicar correção automática (low = mudança segura; high = exige humano)
  "issues": [
    { "type": "gabarito_errado|ambiguidade|distrator_fraco|extra_legal|comentario_incoerente|alt_duplicada|outros", "severity": "low|medium|high", "description": "..." }
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
    result.risk_level === AUTO_FIX_RISK &&
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
