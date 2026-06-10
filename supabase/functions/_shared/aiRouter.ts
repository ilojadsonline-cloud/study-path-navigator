// =============================================================================
// aiRouter.ts — Camada única de roteamento seguro entre APIs de IA (MetodoChoa)
// -----------------------------------------------------------------------------
// Princípio: modelo confiável (Gemini) nas etapas jurídicas críticas, modelo
// barato (DeepSeek) apenas em tarefas auxiliares, código determinístico
// bloqueando falhas e revisão humana nos casos duvidosos.
//
// - Provedor/modelo por etapa, configuráveis 100% por variável de ambiente.
// - Fallback explícito por etapa, respeitando o RISCO JURÍDICO da tarefa.
// - DeepSeek NUNCA é auditor jurídico final nem corretor de questão reportada,
//   salvo AI_ENABLE_DEEPSEEK_FOR_FINAL_AUDIT=true (e mesmo assim → revisão humana).
// - Logs estruturados em public.ai_provider_attempts (best-effort, nunca quebra).
// - Fonte única: helper assertLegalExcerptIsFromDisciplineText.
//
// Provedor "google":
//   * Se GOOGLE_GEMINI_API_KEY estiver setado → Google direto (OpenAI-compat).
//   * Caso contrário → Lovable AI Gateway (que serve os mesmos modelos Gemini).
//   Ambos são OpenAI-compatíveis; só muda base URL, chave e o prefixo do modelo.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ----------------------------- Tipos públicos --------------------------------

export type AiStage =
  | "source_selection"
  | "question_generation"
  | "commentary_generation"
  | "legal_audit"
  | "heavy_reported_question_audit"
  | "json_repair";

export type AiProvider = "google" | "openrouter" | "deepseek" | "maritaca";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiRoute = {
  provider: AiProvider;
  model: string; // modelo "lógico" (ex.: gemini-2.5-flash) — normalizado por provedor
  temperature: number;
  maxOutputTokens: number;
  allowFallback: boolean;
  legalRisk: "low" | "medium" | "high";
};

export type AiAttempt = AiRoute & {
  attemptIndex: number;
  fallbackReason: string | null;
  jsonResponse: boolean; // pedir response_format json_object quando suportado
  serviceTier?: string; // Maritaca: "flex" (-50%) etc.
  timeoutMsOverride?: number; // timeout específico desta tentativa (ex.: Flex curto)
};

export type RunAiResult = {
  content: string;
  provider: AiProvider;
  model: string;
  attemptIndex: number;
  raw: any;
};

export type RunAiOptions = {
  jsonResponse?: boolean;
  questionId?: number | null;
  generationJobId?: string | null;
  metadata?: Record<string, unknown> | null;
  // permite sobrescrever pontualmente temperatura/tokens (sem mudar a política)
  temperatureOverride?: number;
  maxOutputTokensOverride?: number;
  timeoutMs?: number;
  // valida o conteúdo retornado; se retornar false, força fallback p/ próximo provedor
  contentValidator?: (content: string) => boolean;
  // complexidade da tarefa → escolhe o modelo Maritaca (high=sabia-4; medium/low=sabiazinho-4)
  complexity?: "high" | "medium" | "low";
};

// ----------------------------- Helpers de env --------------------------------

const env = (k: string): string | undefined => {
  const v = Deno.env.get(k);
  return v && v.length > 0 ? v : undefined;
};
const envNum = (k: string, d: number): number => {
  const v = env(k);
  if (v === undefined) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const envBool = (k: string, d: boolean): boolean => {
  const v = env(k);
  if (v === undefined) return d;
  return /^(1|true|yes|on)$/i.test(v);
};

export type RoutingMode = "quality_first" | "cost_saver" | "openrouter_fallback" | "maintenance_safe";

export function getRoutingMode(): RoutingMode {
  const m = (env("AI_ROUTING_MODE") ?? "quality_first").toLowerCase();
  if (m === "cost_saver" || m === "openrouter_fallback" || m === "maintenance_safe") return m;
  return "quality_first";
}

// Modelos lógicos por etapa (sem prefixo de provedor)
const MODELS = {
  light: () => env("AI_LIGHT_MODEL") ?? "gemini-2.5-flash-lite",
  generation: () => env("AI_GENERATION_MODEL") ?? "gemini-2.5-flash",
  commentary: () => env("AI_COMMENTARY_MODEL") ?? "gemini-2.5-flash",
  audit: () => env("AI_AUDIT_MODEL") ?? "gemini-2.5-flash",
  heavyAudit: () => env("AI_HEAVY_AUDIT_MODEL") ?? "gemini-2.5-pro",
  jsonRepair: () => env("AI_JSON_REPAIR_MODEL") ?? "gemini-2.5-flash-lite",
  openrouterGeneration: () => env("AI_OPENROUTER_GENERATION_MODEL") ?? "google/gemini-2.5-flash",
  openrouterAudit: () => env("AI_OPENROUTER_AUDIT_MODEL") ?? "google/gemini-2.5-flash",
  openrouterHeavyAudit: () => env("AI_OPENROUTER_HEAVY_AUDIT_MODEL") ?? "google/gemini-2.5-pro",
  deepseekLight: () => env("AI_DEEPSEEK_LIGHT_MODEL") ?? "deepseek-chat",
  deepseekJsonRepair: () => env("AI_DEEPSEEK_JSON_REPAIR_MODEL") ?? "deepseek-chat",
  // Geração premium: DeepSeek Reasoner (R1) mantém a complexidade jurídica "padrão banca elite".
  deepseekGeneration: () => env("AI_DEEPSEEK_GENERATION_MODEL") ?? "deepseek-reasoner",
  // Maritaca AI (Sabiá-4): gerador primário de questões. Fallback → DeepSeek Reasoner.
  // sabia-4 = alta complexidade (jurídico/normativo); sabiazinho-4 = média/baixa (interpretação de texto).
  maritacaGeneration: () => env("AI_MARITACA_GENERATION_MODEL") ?? "sabia-4",
  maritacaGenerationLight: () => env("AI_MARITACA_GENERATION_LIGHT_MODEL") ?? "sabiazinho-4",
};

// Tier de serviço da Maritaca: "flex" = -50% (síncrono, sujeito a fila/429). Padrão = sem desconto.
const MARITACA_SERVICE_TIER = () => env("AI_MARITACA_SERVICE_TIER") ?? "flex";
// Timeout curto na tentativa Flex: se a fila da Maritaca não liberar capacidade,
// abortamos e reexecutamos no tier padrão (ainda Maritaca) antes de cair p/ DeepSeek.
const MARITACA_FLEX_TIMEOUT_MS = () => envNum("AI_MARITACA_FLEX_TIMEOUT_MS", 55000);

const LIMITS = {
  maxOutputTokens: () => envNum("AI_MAX_OUTPUT_TOKENS", 8000),
  genTemp: () => envNum("AI_GENERATION_TEMPERATURE", 0.25),
  commentaryTemp: () => envNum("AI_COMMENTARY_TEMPERATURE", 0.2),
  auditTemp: () => envNum("AI_AUDIT_TEMPERATURE", 0.05),
  maxRetriesPerStep: () => envNum("AI_MAX_RETRIES_PER_STEP", 2),
};

const FLAGS = {
  openrouterEnabled: () => envBool("AI_OPENROUTER_ENABLED", !!env("OPENROUTER_API_KEY")),
  deepseekEnabled: () => envBool("AI_DEEPSEEK_ENABLED", !!env("DEEPSEEK_API_KEY")),
  maritacaEnabled: () => envBool("AI_MARITACA_ENABLED", !!env("MARITACA_API_KEY")),
  maritacaFlexEnabled: () => envBool("AI_MARITACA_FLEX_ENABLED", true),
  deepseekForFinalAudit: () => envBool("AI_ENABLE_DEEPSEEK_FOR_FINAL_AUDIT", false),
};

// --------------------- Disponibilidade / chaves por provedor ------------------

function googleIsDirect(): boolean {
  return !!(env("GOOGLE_GEMINI_API_KEY") ?? env("AI_PRIMARY_API_KEY"));
}

function providerAvailable(p: AiProvider): boolean {
  switch (p) {
    case "google":
      // Direto (Google) OU via Lovable Gateway. Um dos dois precisa existir.
      return googleIsDirect() || !!env("LOVABLE_API_KEY");
    case "openrouter":
      return FLAGS.openrouterEnabled() && !!env("OPENROUTER_API_KEY");
    case "deepseek":
      return FLAGS.deepseekEnabled() && !!env("DEEPSEEK_API_KEY");
    case "maritaca":
      return FLAGS.maritacaEnabled() && !!env("MARITACA_API_KEY");
  }
}

function providerEndpoint(p: AiProvider): { url: string; key: string } {
  switch (p) {
    case "google": {
      if (googleIsDirect()) {
        const base = env("AI_PRIMARY_BASE_URL") ?? "https://generativelanguage.googleapis.com";
        return {
          url: `${base.replace(/\/$/, "")}/v1beta/openai/chat/completions`,
          key: (env("GOOGLE_GEMINI_API_KEY") ?? env("AI_PRIMARY_API_KEY"))!,
        };
      }
      return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: env("LOVABLE_API_KEY")! };
    }
    case "openrouter": {
      const base = env("AI_OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1";
      return { url: `${base.replace(/\/$/, "")}/chat/completions`, key: env("OPENROUTER_API_KEY")! };
    }
    case "deepseek": {
      const base = env("AI_DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com";
      return { url: `${base.replace(/\/$/, "")}/v1/chat/completions`, key: env("DEEPSEEK_API_KEY")! };
    }
    case "maritaca": {
      // Maritaca AI é OpenAI-compatível. Base oficial: https://chat.maritaca.ai/api
      const base = env("AI_MARITACA_BASE_URL") ?? "https://chat.maritaca.ai/api";
      return { url: `${base.replace(/\/$/, "")}/chat/completions`, key: env("MARITACA_API_KEY")! };
    }
  }
}

// Normaliza o nome lógico do modelo para o id aceito por cada provedor.
function normalizeModelForProvider(p: AiProvider, logicalModel: string): string {
  const bare = logicalModel.replace(/^google\//, "");
  switch (p) {
    case "google":
      // Direto: "gemini-2.5-flash". Gateway: "google/gemini-2.5-flash".
      return googleIsDirect() ? bare : (bare.startsWith("gemini") ? `google/${bare}` : logicalModel);
    case "openrouter":
      // OpenRouter usa "google/gemini-...".
      return bare.startsWith("gemini") ? `google/${bare}` : logicalModel;
    case "deepseek":
      // DeepSeek ignora nomes Gemini — usa o modelo deepseek configurado.
      return logicalModel.startsWith("deepseek") ? logicalModel : MODELS.deepseekLight();
    case "maritaca":
      // Maritaca usa a família "sabia-*"; ignora nomes de outros provedores.
      return logicalModel.startsWith("sabia") ? logicalModel : MODELS.maritacaGeneration();
  }
}

// ----------------------------- Política de rota -------------------------------

export function resolveAiRoute(stage: AiStage): AiRoute {
  const maxOut = LIMITS.maxOutputTokens();
  switch (stage) {
    case "source_selection":
      return { provider: "google", model: MODELS.light(), temperature: 0.1, maxOutputTokens: 2000, allowFallback: true, legalRisk: "low" };
    case "question_generation":
      return { provider: "google", model: MODELS.generation(), temperature: LIMITS.genTemp(), maxOutputTokens: maxOut, allowFallback: true, legalRisk: "high" };
    case "commentary_generation":
      return { provider: "google", model: MODELS.commentary(), temperature: LIMITS.commentaryTemp(), maxOutputTokens: maxOut, allowFallback: true, legalRisk: "high" };
    case "legal_audit":
      return { provider: "google", model: MODELS.audit(), temperature: LIMITS.auditTemp(), maxOutputTokens: maxOut, allowFallback: true, legalRisk: "high" };
    case "heavy_reported_question_audit":
      return { provider: "google", model: MODELS.heavyAudit(), temperature: 0.02, maxOutputTokens: maxOut, allowFallback: true, legalRisk: "high" };
    case "json_repair":
      return { provider: "google", model: MODELS.jsonRepair(), temperature: 0, maxOutputTokens: 3000, allowFallback: true, legalRisk: "low" };
  }
}

// Constrói a cadeia ordenada de tentativas por etapa, respeitando o modo e o risco.
export function buildAttemptsForStage(stage: AiStage): AiAttempt[] {
  const mode = getRoutingMode();
  const base = resolveAiRoute(stage);
  const attempts: AiAttempt[] = [];

  const push = (
    provider: AiProvider,
    model: string,
    fallbackReason: string | null,
    over: Partial<AiAttempt> = {},
  ) => {
    if (!providerAvailable(provider)) return;
    attempts.push({
      provider,
      model,
      temperature: over.temperature ?? base.temperature,
      maxOutputTokens: over.maxOutputTokens ?? base.maxOutputTokens,
      allowFallback: base.allowFallback,
      legalRisk: base.legalRisk,
      attemptIndex: attempts.length,
      fallbackReason,
      jsonResponse: over.jsonResponse ?? true,
    });
  };

  const allowDeepseekFinal = FLAGS.deepseekForFinalAudit();

  switch (stage) {
    case "source_selection": {
      // Baixo risco: Gemini Flash-Lite → DeepSeek → OpenRouter econômico
      push("google", MODELS.light(), null);
      if (mode !== "openrouter_fallback") push("deepseek", MODELS.deepseekLight(), "primary_failed");
      push("openrouter", MODELS.openrouterGeneration(), "secondary_failed");
      break;
    }
    case "question_generation": {
      // Geração premium (alto risco jurídico). PRIMÁRIO: Maritaca AI (Sabiá-4) —
      // melhor fidelidade ao português jurídico brasileiro. Quando os créditos da
      // Maritaca acabarem (HTTP 402/429) ou falhar, cai para DeepSeek Reasoner (R1),
      // depois deepseek-chat → Gemini → OpenRouter. O motivo do fallback é logado.
      // Obs.: Maritaca NÃO suporta response_format json_object → jsonResponse:false.
      if (mode !== "openrouter_fallback") {
        push("maritaca", MODELS.maritacaGeneration(), null, { jsonResponse: false });
        push("deepseek", MODELS.deepseekGeneration(), "maritaca_failed");
        push("deepseek", MODELS.deepseekLight(), "reasoner_failed");
      }
      push("google", MODELS.generation(), "deepseek_failed");
      push("openrouter", MODELS.openrouterGeneration(), "secondary_failed");
      break;
    }
    case "commentary_generation": {
      push("google", MODELS.commentary(), null);
      push("openrouter", MODELS.openrouterAudit(), "primary_failed");
      push("google", MODELS.commentary(), "retry_shorter", { maxOutputTokens: Math.min(base.maxOutputTokens, 4000) });
      break;
    }
    case "legal_audit": {
      // Auditoria jurídica: Gemini Flash → Gemini Pro → OpenRouter Gemini (NUNCA DeepSeek por padrão)
      push("google", MODELS.audit(), null);
      push("google", MODELS.heavyAudit(), "escalate_to_pro");
      push("openrouter", MODELS.openrouterAudit(), "secondary_failed");
      if (allowDeepseekFinal) push("deepseek", MODELS.deepseekLight(), "deepseek_final_audit_optin");
      break;
    }
    case "heavy_reported_question_audit": {
      // Maior risco reputacional: Gemini Pro → Gemini Flash → OpenRouter modelo forte
      push("google", MODELS.heavyAudit(), null);
      push("google", MODELS.audit(), "downgrade_to_flash");
      push("openrouter", MODELS.openrouterHeavyAudit(), "secondary_failed");
      if (allowDeepseekFinal) push("deepseek", MODELS.deepseekLight(), "deepseek_final_audit_optin");
      break;
    }
    case "json_repair": {
      // Reparo de JSON (baixo risco): Gemini Flash-Lite → DeepSeek → OpenRouter
      push("google", MODELS.jsonRepair(), null);
      push("deepseek", MODELS.deepseekJsonRepair(), "primary_failed");
      push("openrouter", MODELS.openrouterGeneration(), "secondary_failed");
      break;
    }
  }

  // maintenance_safe: bloqueia geração/comentário em massa (apenas auditoria/reparo).
  if (mode === "maintenance_safe" && (stage === "question_generation" || stage === "commentary_generation")) {
    return [];
  }

  // Se nenhum provedor disponível, devolve ao menos a rota base (vai falhar com erro claro).
  if (attempts.length === 0 && providerAvailable(base.provider)) {
    push(base.provider, base.model, null);
  }
  return attempts;
}

// ----------------------------- Fonte única ------------------------------------

export function normalizeLegalText(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/** Garante que o recorte legal veio EXCLUSIVAMENTE do texto cadastrado na disciplina. */
export function assertLegalExcerptIsFromDisciplineText(legalExcerpt: string, disciplineLegalTextContent: string) {
  const normalizedExcerpt = normalizeLegalText(legalExcerpt);
  const normalizedSource = normalizeLegalText(disciplineLegalTextContent);
  if (!normalizedExcerpt) throw new Error("LEGAL_EXCERPT_EMPTY");
  if (!normalizedSource) throw new Error("DISCIPLINE_LEGAL_TEXT_EMPTY");
  if (!normalizedSource.includes(normalizedExcerpt)) {
    throw new Error("LEGAL_EXCERPT_NOT_FOUND_IN_DISCIPLINE_LEGAL_TEXTS");
  }
}

// ----------------------------- Logging ----------------------------------------

let _logClient: ReturnType<typeof createClient> | null = null;
function logClient() {
  if (_logClient) return _logClient;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _logClient = createClient(url, key);
  return _logClient;
}

async function logAiAttempt(row: {
  stage: AiStage;
  provider: AiProvider;
  model: string;
  success: boolean;
  attemptIndex: number;
  questionId?: number | null;
  generationJobId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number | null;
  fallbackReason?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const c = logClient();
    if (!c) return;
    await c.from("ai_provider_attempts").insert({
      stage: row.stage,
      provider: row.provider,
      model: row.model,
      routing_mode: getRoutingMode(),
      success: row.success,
      attempt_index: row.attemptIndex,
      question_id: row.questionId ?? null,
      generation_job_id: row.generationJobId ?? null,
      input_tokens: row.inputTokens ?? null,
      output_tokens: row.outputTokens ?? null,
      duration_ms: row.durationMs ?? null,
      fallback_reason: row.fallbackReason ?? null,
      error_message: row.errorMessage ? String(row.errorMessage).slice(0, 2000) : null,
      metadata: row.metadata ?? null,
    });
  } catch (_e) {
    // Logging nunca pode quebrar o pipeline.
  }
}

// ----------------------------- Execução ---------------------------------------

function approxTokens(s: string): number {
  return Math.ceil((s?.length ?? 0) / 4);
}

class AiProviderError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`AI provider HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

async function callProvider(
  attempt: AiAttempt,
  messages: ChatMessage[],
  opts: RunAiOptions,
): Promise<{ content: string; raw: any; inputTokens: number; outputTokens: number }> {
  const { url, key } = providerEndpoint(attempt.provider);
  const model = normalizeModelForProvider(attempt.provider, attempt.model);
  const isDeepseekReasoner = model === "deepseek-reasoner";
  const isMaritaca = attempt.provider === "maritaca";

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: opts.maxOutputTokensOverride ?? attempt.maxOutputTokens,
    stream: false,
  };
  // deepseek-reasoner NÃO aceita temperature/response_format.
  if (!isDeepseekReasoner) {
    body.temperature = opts.temperatureOverride ?? attempt.temperature;
    // Maritaca (Sabiá) NÃO suporta response_format json_object — só `tools`.
    // O JSON é garantido pelo prompt + pipeline de extração/reparo a jusante.
    if (attempt.jsonResponse && !isMaritaca) body.response_format = { type: "json_object" };
  }

  // -------------------------------------------------------------------------
  // Controle de "thinking" do Gemini (CRÍTICO p/ Google DIRETO).
  // Os modelos Gemini 2.5 gastam parte do orçamento de tokens em raciocínio
  // interno ("thinking"). Com max_tokens baixo (ex.: 1800-3000 na geração),
  // o thinking consome quase tudo e o JSON sai truncado (finish_reason=length)
  // → "IA retornou JSON inválido". O endpoint OpenAI-compat do Google aceita
  // `reasoning_effort` para limitar/desligar isso. Modelos *-pro sempre pensam
  // (não aceitam "none"), então usamos "low" para eles.
  if (attempt.provider === "google" && googleIsDirect()) {
    const isPro = /(-pro\b|pro$)/i.test(model);
    const def = isPro ? "low" : "none";
    const effort = (env("AI_GOOGLE_REASONING_EFFORT") ?? def).toLowerCase();
    if (effort !== "default") body.reasoning_effort = effort;
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await resp.text();
    if (!resp.ok) throw new AiProviderError(resp.status, text);
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiProviderError(resp.status, "INVALID_JSON_ENVELOPE: " + text.slice(0, 200));
    }
    let content: string = json?.choices?.[0]?.message?.content ?? "";
    // Remove blocos de raciocínio (DeepSeek reasoner etc.)
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const inputTokens = json?.usage?.prompt_tokens ?? approxTokens(messages.map(m => m.content).join("\n"));
    const outputTokens = json?.usage?.completion_tokens ?? approxTokens(content);
    return { content, raw: json, inputTokens, outputTokens };
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Executa uma etapa do pipeline tentando provedores em ordem (com fallback),
 * logando cada tentativa. Lança o último erro se todas as tentativas falharem.
 */
export async function runAiStage(
  stage: AiStage,
  messages: ChatMessage[],
  opts: RunAiOptions = {},
): Promise<RunAiResult> {
  const attempts = buildAttemptsForStage(stage);
  if (attempts.length === 0) {
    throw new Error(`NO_PROVIDER_AVAILABLE_FOR_STAGE:${stage} (mode=${getRoutingMode()})`);
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    const started = Date.now();
    try {
      const res = await callProvider(attempt, messages, {
        ...opts,
        jsonResponse: opts.jsonResponse ?? attempt.jsonResponse,
      });
      // Conteúdo vazio/inválido (ex.: lote "+0") → trata como falha e cai p/ próximo provedor
      if (opts.contentValidator && !opts.contentValidator(res.content)) {
        throw new Error("CONTENT_VALIDATION_FAILED: lote vazio/sem questões válidas");
      }
      await logAiAttempt({
        stage,
        provider: attempt.provider,
        model: normalizeModelForProvider(attempt.provider, attempt.model),
        success: true,
        attemptIndex: attempt.attemptIndex,
        questionId: opts.questionId ?? null,
        generationJobId: opts.generationJobId ?? null,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        durationMs: Date.now() - started,
        fallbackReason: attempt.fallbackReason,
        metadata: opts.metadata ?? null,
      });
      return {
        content: res.content,
        provider: attempt.provider,
        model: normalizeModelForProvider(attempt.provider, attempt.model),
        attemptIndex: attempt.attemptIndex,
        raw: res.raw,
      };
    } catch (error) {
      lastError = error;
      await logAiAttempt({
        stage,
        provider: attempt.provider,
        model: normalizeModelForProvider(attempt.provider, attempt.model),
        success: false,
        attemptIndex: attempt.attemptIndex,
        questionId: opts.questionId ?? null,
        generationJobId: opts.generationJobId ?? null,
        durationMs: Date.now() - started,
        fallbackReason: attempt.fallbackReason,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: opts.metadata ?? null,
      });
      // Erro de credenciais/credito/timeout → tenta próximo provedor (fallback seguro).
    }
  }
  throw lastError ?? new Error(`ALL_ATTEMPTS_FAILED:${stage}`);
}

export { AiProviderError };
