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
const MAX_PER_INVOCATION = 5; // limite por chamada (timeout 150s)

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

async function callDeepSeek(prompt: string, timeoutMs = 45000): Promise<string> {
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
              "Você é um auditor cético e implacável de questões objetivas para concursos públicos jurídicos e militares (PMTO), e também atua como PROFESSOR REVISOR. Sua função é (1) encontrar TODAS as inconsistências (gabarito errado, distratores fracos, alternativas duplicadas/vagas, conteúdo extra-legal, ambiguidade, comentário fraco) e (2) quando necessário, REESCREVER a questão por inteiro — enunciado, alternativas A-E, gabarito e comentário — de forma que ela fique pronta para ser aplicada em prova de banca de elite. O comentário deve soar como um PROFESSOR explicando ao aluno: começa contextualizando o instituto jurídico, cita o artigo/inciso/parágrafo da lei, explica por que a alternativa correta é correta E por que cada distratora está errada quando relevante. Mínimo 600 caracteres no comentário quando reescrever. Responda APENAS JSON válido.",
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

Audite com rigor de banca examinadora. Verifique:
1. Gabarito está correto à luz do texto legal? (mais grave)
2. Enunciado tem ambiguidade, erro de português crítico, ou pega-pegadinha mal feita?
3. Existe MAIS de uma alternativa correta? Existe NENHUMA correta?
4. Distratores são plausíveis ou são óbvios demais / absurdos?
5. Há afirmação extra-legal, inventada, ou que contraria o texto legal?
6. Comentário está coerente com o gabarito e cita base legal?
7. Alternativas duplicadas, vazias ou triviais?

Retorne JSON ESTRITO:
{
  "confidence": 0.0-1.0,           // sua confiança na auditoria (alta = tem certeza do diagnóstico)
  "risk_level": "low" | "medium" | "high",  // risco de aplicar correção automática (low = mudança segura tipo trocar gabarito óbvio; high = exige humano)
  "issues": [
    { "type": "gabarito_errado|ambiguidade|distrator_fraco|extra_legal|comentario_incoerente|alt_duplicada|outros", "severity": "low|medium|high", "description": "..." }
  ],
  "proposed_patch": {              // null se não há correção segura. Inclua APENAS campos que devem mudar.
    "gabarito"?: 0-4,
    "comentario"?: "...",
    "alt_a"?: "...", "alt_b"?: "...", "alt_c"?: "...", "alt_d"?: "...", "alt_e"?: "...",
    "enunciado"?: "..."
  },
  "needs_human_review": true|false,
  "ai_summary": "1-2 frases resumindo o diagnóstico"
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

  const noIssues = result.issues.length === 0 && !result.proposed_patch;
  const canAutoFix =
    !!result.proposed_patch &&
    result.confidence >= AUTO_FIX_CONFIDENCE &&
    result.risk_level === AUTO_FIX_RISK &&
    !result.needs_human_review;

  let finalStatus: string;
  let appliedPatch: any = null;

  if (noIssues) {
    finalStatus = "approved";
  } else if (canAutoFix) {
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

    // IDs já auditados (paginado para superar limite default de 1000 do PostgREST)
    let excludeIds = new Set<number>();
    if (job.scope?.only_unaudited) {
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pErr } = await supabase
          .from("question_audits")
          .select("questao_id")
          .order("questao_id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (pErr || !page || page.length === 0) break;
        for (const r of page as any[]) excludeIds.add(r.questao_id);
        if (page.length < PAGE) break;
        from += PAGE;
        if (from >= 200000) break; // safety
      }
    }

    // Paginação por cursor: avança até encontrar MAX_PER_INVOCATION questões não auditadas
    const pending: any[] = [];
    let cursor = 0;
    const PAGE_Q = 500;
    while (pending.length < MAX_PER_INVOCATION) {
      let qBuilder = supabase
        .from("questoes")
        .select("*")
        .order("id", { ascending: true })
        .gt("id", cursor)
        .limit(PAGE_Q);
      if (job.scope?.disciplinas?.length) qBuilder = qBuilder.in("disciplina", job.scope.disciplinas);
      const { data: candidates, error: cErr } = await qBuilder;
      if (cErr || !candidates || candidates.length === 0) break;
      for (const q of candidates as any[]) {
        if (!excludeIds.has(q.id)) {
          pending.push(q);
          if (pending.length >= MAX_PER_INVOCATION) break;
        }
      }
      cursor = (candidates[candidates.length - 1] as any).id;
      if (candidates.length < PAGE_Q) break;
    }

    if (pending.length === 0) {
      await supabase.from("audit_jobs").update({ status: "done" }).eq("id", jobId);
      return new Response(JSON.stringify({ done: true, job_id: jobId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const legalCache = new Map<string, string | null>();
    let processed = 0, autoFixed = 0, flagged = 0, errors = 0;

    for (const q of pending) {
      try {
        const r = await processQuestion(supabase, q as Questao, legalCache);
        processed++;
        if (r.auto_fixed) autoFixed++;
        if (r.flagged) flagged++;
        if (r.status === "error") errors++;
      } catch (e) {
        errors++;
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("audit_jobs").update({ last_error: msg }).eq("id", jobId);
      }
    }

    const newProcessed = (job.processed ?? 0) + processed;
    const newAutoFixed = (job.auto_fixed ?? 0) + autoFixed;
    const newFlagged = (job.flagged ?? 0) + flagged;
    const newErrors = (job.errors ?? 0) + errors;
    const isDone = newProcessed >= (job.total ?? 0);

    await supabase.from("audit_jobs").update({
      processed: newProcessed,
      auto_fixed: newAutoFixed,
      flagged: newFlagged,
      errors: newErrors,
      status: isDone ? "done" : "running",
    }).eq("id", jobId);

    return new Response(JSON.stringify({
      processed_in_batch: processed,
      auto_fixed_in_batch: autoFixed,
      flagged_in_batch: flagged,
      errors_in_batch: errors,
      total_processed: newProcessed,
      done: isDone,
      job_id: jobId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
