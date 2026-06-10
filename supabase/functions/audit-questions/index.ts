import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { runAiStage, type ChatMessage } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const MARITACA_API_KEY = Deno.env.get("MARITACA_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const AUTO_FIX_CONFIDENCE = 0.85;
const AUTO_FIX_RISK_ALLOWED = ["low", "medium"]; // só "high" exige humano
const MAX_PER_INVOCATION = 4; // mais ritmo sem sacrificar qualidade
const PROCESS_CONCURRENCY = 2; // 2 chamadas IA em paralelo, dentro do limite de 150s
const PAGE_Q = 250;
const OPEN_AUDIT_STATUSES = ["manual_review", "pending", "error"];

// Limite a partir do qual um distrator é considerado longo demais frente aos demais
const DISTRATOR_LEN_RATIO = 1.7;

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

type ArticleBlock = { artNum: string; text: string; normText: string };

function normalizeLegalText(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[§º°ª.,;:!?()\[\]\-–—""''\"\']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArticleBlocks(lawText: string): ArticleBlock[] {
  const positions: Array<{ num: string; pos: number }> = [];
  const re = /\bArt\.?\s*(\d+)(?:º|°|o)?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(lawText)) !== null) {
    positions.push({ num: match[1], pos: match.index });
  }
  return positions.map((p, idx) => {
    const end = idx + 1 < positions.length ? positions[idx + 1].pos : lawText.length;
    const text = lawText.slice(p.pos, end).trim();
    return { artNum: p.num, text, normText: normalizeLegalText(text) };
  });
}

function extractArticleNumbers(text: unknown): string[] {
  const out = new Set<string>();
  const re = /\b(?:Art\.?|artigo)\s*(\d+)(?:º|°|o)?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(String(text ?? ""))) !== null) out.add(match[1]);
  return [...out];
}

function stripThinkTags(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

/** Prompt de sistema do AUDITOR-DIAGNOSTICADOR (apenas diagnóstico, sem reescrita). */
const DIAGNOSTIC_SYSTEM_PROMPT =
  "Você é AUDITOR-DIAGNOSTICADOR de questões objetivas para concursos militares (PMTO, CFO/CHOA) e jurídicos (FGV/CESPE/VUNESP). Sua FUNÇÃO ÚNICA é DIAGNOSTICAR defeitos — NÃO REESCREVA conteúdo. A reescrita será feita por outra IA jurídica especializada. Leia enunciado, A–E, gabarito e comentário INTEGRALMENTE e confronte com o TEXTO LEGAL DE REFERÊNCIA. Detecte SEM AMOSTRAGEM: (a) questões repetidas/duplicadas que abordam exatamente o mesmo assunto/dispositivo; (b) DUAS OU MAIS alternativas corretas/defensáveis à luz da lei; (c) NENHUMA alternativa correta (gabarito aponta errada e nenhuma outra serve); (d) ALUCINAÇÃO JURÍDICA — artigo/inciso/§ inexistente, fundamento inventado, dispositivo revogado; (e) violação de hierarquia funcional (posto/graduação/competência incompatível); (f) função incompatível com o posto citado; (g) gabarito visualmente identificável (única longa/curta/técnica/com ressalva); (h) padrão antiético length_bias (correta é a mais longa OU mais curta — único caso); (i) distratores fracos/óbvios/absurdos/não plausíveis; (j) DISTRATORES LONGOS DEMAIS (algum distrator com mais de 1.7× o tamanho médio dos demais — type='distrator_longo'); (k) comentário ausente, em loop, ou que não analisa cada alternativa errada individualmente; (l) enunciado/alternativas/comentário desalinhados; (m) texto legal desatualizado/revogado; (n) bug estrutural (alt vazia, duplicada, formatação corrompida); (o) duas técnicas de distração insuficientes (<2 — insufficient_distractors); (p) QUESTÃO FÁCIL DEMAIS — óbvia, de mera memorização, resolvível por eliminação grosseira, sem exigir interpretação jurídica real (type='facil_demais', severity='high') — tolere literalidade APENAS quando o dispositivo exigir (definição fechada, prazo numérico, enumeração taxativa); (q) ENUNCIADO COPIADO — cópia literal de longo trecho da lei sem virar pergunta de banca, entregando a resposta (type='enunciado_copiado', severity='high'); (r) DEPENDÊNCIA DE FONTE EXTERNA — questão que só se sustenta com Constituição Federal, doutrina, jurisprudência, internet, PDF, outra lei fora do TEXTO LEGAL DE REFERÊNCIA ou conhecimento geral do modelo (type='dependencia_fonte_externa', severity='high'). Questões com qualquer issue 'high' NUNCA podem ser publicadas automaticamente — devem ir para correção (pending_patch) ou revisão manual. Para CADA issue obrigatoriamente preencha: type, severity, field ('enunciado'|'alt_a'|'alt_b'|'alt_c'|'alt_d'|'alt_e'|'gabarito'|'comentario'|'questao_inteira'), evidence (trecho EXATO do conteúdo problemático em ≤200 chars) e suggestion (instrução curta e ACIONÁVEL para a IA reescritora: 'reescrever distrator B mais curto preservando erro de prazo', 'corrigir gabarito para C porque art. 12 prevê...', 'remover citação de Art. 999 inexistente', 'elevar dificuldade exigindo interpretação da exceção do §', 'reescrever comentário no estilo professor 4 movimentos'). Em duplicata e em irrecuperável, defina needs_human_review=false e indique no ai_summary 'AUTO_DELETE: <motivo>'. NUNCA emita proposed_patch — sempre null. NÃO reescreva nada. Sua saída é apenas DIAGNÓSTICO. Responda APENAS JSON válido.";

/** DeepSeek direto — fallback de baixo nível para o DIAGNÓSTICO (sem router). */
async function callDeepSeekDirect(prompt: string, timeoutMs = 55000): Promise<string> {
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
          { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
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

/**
 * DIAGNÓSTICO ESTRUTURADO via router (etapa 'legal_audit'): Gemini Flash → Gemini
 * Pro → OpenRouter Gemini. DeepSeek direto só como último recurso determinístico.
 */
async function callDeepSeek(
  prompt: string,
  questionId?: number | null,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];
  try {
    const r = await runAiStage("legal_audit", messages, {
      jsonResponse: true,
      questionId: questionId ?? null,
      timeoutMs: 90_000,
      metadata: { task: "audit_diagnostic" },
    });
    return stripThinkTags(r.content);
  } catch (e) {
    console.warn("[audit-questions] router legal_audit falhou, usando DeepSeek direto:", e instanceof Error ? e.message : e);
    if (!DEEPSEEK_API_KEY) throw e;
    return await callDeepSeekDirect(prompt);
  }
}



/** Erro lançado quando o provedor sinaliza falta de créditos/saldo. */
class NoCreditsError extends Error {
  provider: string;
  status: number;
  detail: string;
  constructor(provider: string, status: number, detail: string) {
    super(`${provider} sem créditos (HTTP ${status}): ${detail}`);
    this.provider = provider;
    this.status = status;
    this.detail = detail;
  }
}

function looksLikeNoCredits(status: number, body: string): boolean {
  if (status === 402) return true;
  const hasKeyword = /insufficient|no credits|sem cr[eé]ditos|saldo|quota|billing|payment required|exhaust|insufficient_quota/i.test(body);
  return hasKeyword && (status === 401 || status === 402 || status === 403 || status === 429);
}

const REWRITER_SYSTEM_PROMPT =
  "Você é PROFESSOR-REESCRITOR JURÍDICO de altíssimo nível especializado em concursos militares (PMTO, CFO/CHOA) e bancas CESPE/CEBRASPE/FGV/VUNESP. Recebe uma QUESTÃO defeituosa, o DIAGNÓSTICO formal de outro auditor (IA) e o TEXTO LEGAL DE REFERÊNCIA. Sua missão é CORRIGIR a questão exigindo o MÁXIMO de conhecimento e interpretação jurídica — não invente nada fora do texto legal. Regras: (1) corrija TODOS os defeitos listados pelo diagnóstico; (2) preserve a essência didática quando possível; (3) ANTI-LENGTH-BIAS: a alternativa correta NUNCA pode ser a única mais longa nem a única mais curta — paridade ±25%; (4) DISTRATORES LONGOS DEMAIS devem ser ENCURTADOS preservando o erro típico (troca de prazo/autoridade/conectivo) e a plausibilidade; (5) cada distrator usa uma técnica DIFERENTE de erro (≥2 técnicas no conjunto); (6) gabarito 0–4; (7) COMENTÁRIO no PADRÃO BANCA DE ELITE — cada questão é uma AULA CURTA. Consolide no campo comentario, nesta ordem e com estes rótulos em negrito markdown: '**Comentário do professor:**' (por que o gabarito está correto + citação literal e curta do dispositivo + a pegadinha/técnica usada); '**Análise das alternativas:**' (CADA alternativa A–E comentada individualmente, uma por linha, no formato '**A)** ...', '**B)** ...', ... — NUNCA escreva 'as demais estão erradas'); '**Dica de prova:**' (resumo estratégico/alerta de pegadinha/frase de fixação curta); '**Base normativa:**' (norma/artigo/inciso/§/item, sempre presente no TEXTO LEGAL DE REFERÊNCIA); (8) 900–2400 caracteres no comentário, sem comentário raso ou que apenas repita o gabarito; (9) RESPEITE a hierarquia militar e atribua competências exatamente como a lei fixa; (10) se citar lei DIFERENTE da lei principal, mencione o diploma por extenso (ex.: 'art. 9º do CPM', 'art. 5º, LV, da CF'); (11) se a questão for IRRECUPERÁVEL juridicamente (sem alternativa correta possível à luz da lei, sem base legal etc.), devolva unrecoverable=true. Responda APENAS JSON válido com o patch.";

/** Maritaca Sabiá 4 — REESCRITOR jurídico PRIMÁRIO. */
async function callMaritaca(prompt: string, timeoutMs = 70000): Promise<string> {
  if (!MARITACA_API_KEY) throw new NoCreditsError("Maritaca", 0, "MARITACA_API_KEY não configurada");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://chat.maritaca.ai/api/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MARITACA_API_KEY}`,
        // Flex tier (-50% custo) — tolera latência maior; ideal para auditoria assíncrona.
        "X-Service-Tier": "flex",
      },
      body: JSON.stringify({
        model: "sabia-4",
        // Também envia no body para compatibilidade com o gateway OpenAI-like da Maritaca.
        service_tier: "flex",
        messages: [
          { role: "system", content: REWRITER_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        top_p: 0.92,
        max_tokens: 4500,
      }),

      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (looksLikeNoCredits(res.status, body)) {
        throw new NoCreditsError("Maritaca", res.status, body.slice(0, 200));
      }
      throw new Error(`Maritaca HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return stripThinkTags(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

/** DeepSeek REASONER — REESCRITOR jurídico PRIMÁRIO (raciocínio profundo). */
async function callDeepSeekRewriter(prompt: string, timeoutMs = 120000): Promise<string> {
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
        model: "deepseek-reasoner",
        messages: [
          { role: "system", content: REWRITER_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 6000,
        // deepseek-reasoner NÃO aceita temperature/top_p/response_format
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (looksLikeNoCredits(res.status, body)) {
        throw new NoCreditsError("DeepSeek", res.status, body.slice(0, 200));
      }
      throw new Error(`DeepSeek(reasoner) HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return stripThinkTags(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

/**
 * Bloco-mestre de auditoria conforme o Edital nº 001/2026 — CHOA/2026 PMTO.
 * Define a matriz oficial, o roteamento por disciplina (Regra Zero), os recortes
 * de escopo e a filosofia "corrigir antes de excluir". Viaja junto da mensagem
 * do usuário (não no system prompt) para manter o roteamento por questão.
 */
const CHOA_EDITAL_AUDIT_RULES = `### MATRIZ OFICIAL DO EDITAL CHOA/2026 PMTO (8 disciplinas) — use para identificar a disciplina REAL e o recorte permitido:
01 Lei nº 2.578/2012 — Estatuto dos Militares Estaduais (ingresso, direitos, deveres, hierarquia/disciplina, cargo×função, movimentação, licenciamento, reserva, reforma).
02 Lei nº 2.575/2012 — Lei de Promoções (CPO×CPP, QA/QAA/QAM/QAE, interstício, merecimento×antiguidade, requisitos do CHOA, seleção interna).
03 Lei Complementar nº 128/2021 — Organização Básica da PMTO (estrutura, Comando-Geral, Estado-Maior, diretorias, quadros, competências de órgãos).
04 CPPM — Polícia Judiciária Militar, IPM, prisão em flagrante e APF, LIMITADO aos arts. 8º a 28 e 243 a 253. Conteúdo fora desse recorte = fora do edital.
05 RDMETO — Decreto nº 4.994/2014 e Anexo Único (transgressão disciplinar, sindicância, autoridade, prazos, sanções, comportamento, tabela de punições).
06 POP — Portaria Normativa nº 001/2024 (Processo 108 e Processos 201 a 214). Processo fora desse recorte = fora do edital.
07 Língua Portuguesa — interpretação e compreensão de texto. EXIGE texto-base; resposta deve estar sustentada pelo texto. Gramática pura = fora do foco.
08 Manual de Redação Oficial da PMTO — Item 6, subitens 6.1 a 6.8. ESCOPO ESTRITO: SÓ aspectos CONCEITUAIS — definição, finalidade e hipóteses de utilização dos atos de correspondência (6.1), normativos (6.2), ordinatórios (6.3), enunciativos (6.4), negociais (6.5), comprobatórios (6.6), de divulgação (6.7) e de serviço (6.8). É PROIBIDO cobrar estrutura, formatação, partes constitutivas, cabeçalho, fonte, margens, espaçamento, epígrafe, vocativo, fecho, ementa, diagramação, assinatura, modelos ou pronomes de tratamento. Questão de Redação que cobre estrutura/formatação/partes do documento é IRRECUPERÁVEL (não há como reescrever sem trocar o tema) → AUTO_DELETE.

### REGRA ZERO (roteamento): identifique a disciplina REAL pelo conteúdo cobrado, mesmo que o campo "Disciplina" esteja errado. Se a disciplina declarada divergir da real e o conteúdo for juridicamente correto, emita issue type='disciplina_incorreta' (severity='medium', fix simples: sugira a disciplina certa). Se houver mistura indevida de duas disciplinas sem base para correção → revisão manual.

### RECORTE DO EDITAL: se a questão cobrar dispositivo/processo/assunto FORA do recorte da sua disciplina (ex.: CPPM fora de 8-28/243-253; POP fora de 108/201-214; Redação fora de 6.1-6.8 ou cobrando formatação; Português sem texto-base ou exigindo gramática), emita issue type='fora_do_edital' (severity='high').

### PROIBIÇÃO DE COBRANÇA DE NÚMERO DE ARTIGO: questões cujo OBJETO central é decorar número de artigo/inciso/§/alínea/processo ("em qual artigo", "qual artigo trata de", alternativas formadas só por "Art. N") devem ser sinalizadas type='cobranca_numero_artigo' (severity='high'). Citar o artigo na base normativa/comentário é permitido e desejável — proibido é cobrar o NÚMERO como resposta. Correção preferencial: reescrever para cobrar o CONTEÚDO jurídico do dispositivo.

### FILOSOFIA: CORRIGIR ANTES DE EXCLUIR. Preserve o banco sempre que houver base normativa para reescrever. Só classifique como irrecuperável (AUTO_DELETE) quando: totalmente fora do edital, incoerente a ponto de impedir reescrita, duplicata literal sem ganho pedagógico, OU questão de Redação Oficial que cobra estrutura/formatação/partes constitutivas/cabeçalho/margem/fonte/espaçamento/epígrafe/vocativo/fecho/diagramação/assinatura/modelo/pronome de tratamento (essas NÃO podem ser reescritas para o viés conceitual sem inventar a questão — devem ser EXCLUÍDAS, ai_summary começando com 'AUTO_DELETE: Redação fora do escopo conceitual'). Havendo dúvida jurídica (alucinação, conflito de vigência, sem base na lei carregada) → needs_human_review=true (revisão manual), NUNCA exclusão automática.

`;

function buildAuditPrompt(q: Questao, legalText: string | null): string {
  const alts = ["A", "B", "C", "D", "E"].map(
    (l, i) => `${l}) ${(q as any)[`alt_${l.toLowerCase()}`]}`
  ).join("\n");
  const correta = ["A", "B", "C", "D", "E"][q.gabarito] ?? "?";
  const blocks = legalText ? parseArticleBlocks(legalText) : [];
  const cited = extractArticleNumbers([q.enunciado, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e, q.comentario, q.artigo_principal].join("\n"));
  const relevantNums = [...new Set([...cited, ...(q.artigo_principal ? extractArticleNumbers(q.artigo_principal) : [])])];
  const relevantBlocks = relevantNums
    .map((num) => blocks.find((b) => b.artNum === num))
    .filter(Boolean) as ArticleBlock[];
  const articleIndex = blocks.length
    ? `ÍNDICE DETERMINÍSTICO DA LEI CARREGADA: ${blocks.map((b) => `Art. ${b.artNum}`).join(", ")}\n`
    : "";
  const relevantBlock = relevantBlocks.length
    ? `DISPOSITIVOS CITADOS NA QUESTÃO E ENCONTRADOS NA LEI (priorize esta prova determinística antes de acusar alucinação):\n${relevantBlocks.map((b) => b.text.slice(0, 2500)).join("\n\n")}\n`
    : "";

  const legalBlock = legalText
    ? `${articleIndex}${relevantBlock}TEXTO LEGAL DE REFERÊNCIA (FONTE ÚNICA E EXCLUSIVA de verdade; pode estar truncado por limite técnico, então o ÍNDICE acima prevalece para EXISTÊNCIA de artigo). PROIBIDO usar PDFs, anexos, sites, memória do modelo, conhecimento jurídico geral ou outras leis fora deste texto:\n"""${legalText.slice(0, 9000)}"""\n`
    : "BLOQUEIO OPERACIONAL: Não há texto legal oficial cadastrado em discipline_legal_texts para esta disciplina. NÃO use conhecimento geral, PDFs, anexos ou memória do modelo. Sinalize NO_LEGAL_TEXT e marque para revisão manual.\n";

  return `${CHOA_EDITAL_AUDIT_RULES}${legalBlock}
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

DIAGNOSTIQUE INTEGRALMENTE esta questão. Você NÃO REESCREVE — apenas identifica defeitos. A reescrita será feita por outra IA jurídica especializada (Sabiá 4). Verifique TODOS os defeitos abaixo:

A. DUPLICADA — questão idêntica em sentido a outra já existente (mesmo dispositivo, mesma armadilha). type='duplicada'.
B. DUAS+ ALTERNATIVAS CORRETAS — mais de uma alternativa é defensável à luz da lei. type='multiplas_corretas'.
C. NENHUMA ALTERNATIVA CORRETA — gabarito atual está errado E nenhuma das outras serve. type='sem_correta'.
D. ALUCINAÇÃO JURÍDICA — artigo/inciso/§ inexistente na lei, fundamento legal inventado, dispositivo revogado. type='alucinacao_juridica'.
E. GABARITO ERRADO — gabarito aponta alternativa errada mas outra É correta. type='gabarito_errado'.
F. VIOLAÇÃO DE HIERARQUIA — atribui competência/função/posto/graduação de forma diferente do que a lei determina. type='hierarquia_violada'.
G. FUNÇÃO INCONSISTENTE com o posto/graduação citado. type='funcao_inconsistente'.
H. LENGTH_BIAS — alternativa correta é a única mais longa OU a única mais curta. type='length_bias'.
I. DISTRATORES FRACOS/ÓBVIOS — alternativas absurdas, óbvias, "todas/nenhuma das anteriores", n.d.a., palavras-âncora isoladas. type='distrator_fraco'.
J. DISTRATORES LONGOS DEMAIS — algum distrator com mais de 1.7× o tamanho médio dos demais. type='distrator_longo' (cite no field o alt_X afetado e em suggestion 'encurtar preservando erro típico').
K. INSUFFICIENT_DISTRACTORS — menos de 2 técnicas de distração diferentes. type='insufficient_distractors'.
L. BUG ESTRUTURAL — campo vazio, alternativa duplicada, formatação corrompida, enunciado truncado. type='bug_estrutural'.
M. SEM_COMENTARIO — comentário vazio/placeholder. type='sem_comentario'.
N. COMENTARIO_LOOP — texto circular, parafraseia o enunciado sem explicar. type='comentario_loop'.
O. COMENTARIO_INCOMPLETO — comentário raso, genérico, que apenas repete o gabarito, OU que não traz as 4 seções do PADRÃO BANCA DE ELITE: '**Comentário do professor:**' (fundamento do gabarito + pegadinha), '**Análise das alternativas:**' (CADA alternativa A–E comentada individualmente — não vale 'as demais estão erradas'), '**Dica de prova:**' e '**Base normativa:**'. type='comentario_incompleto'.
P. DESALINHAMENTO — comentário cita correta diferente do gabarito, ou enunciado pergunta X e alternativas respondem Y. type='desalinhamento'.
Q. TEXTO_LEGAL_DESATUALIZADO — questão baseada em dispositivo revogado/alterado/substituído. type='texto_legal_desatualizado'.
R. INCOERENTE — premissa contraditória, situação juridicamente inviável. type='incoerente' (irrecuperável).
S. FÁCIL DEMAIS — questão óbvia, de mera memorização, resolvível por eliminação grosseira ou que não exige interpretação jurídica real. NÃO tem padrão de banca de alto nível (CHOA/PMTO). type='facil_demais' severity='high'. (Tolere literalidade apenas quando o dispositivo EXIGIR literalidade: definição fechada, prazo numérico, enumeração taxativa.)
T. ENUNCIADO COPIADO — enunciado e/ou alternativa correta são cópia literal de longo trecho da lei sem transformação em pergunta de banca, entregando a resposta. type='enunciado_copiado' severity='high'.
U. DISTRATOR ABSURDO — distratores não são tecnicamente próximos/plausíveis; algum é claramente absurdo, fora do tema ou eliminável sem ler a lei. type='distrator_absurdo' severity='high'.
V. DEPENDÊNCIA DE FONTE EXTERNA — a questão só se sustenta com Constituição Federal, doutrina, jurisprudência, internet, PDF externo, outra lei não incluída no TEXTO LEGAL DE REFERÊNCIA ou conhecimento geral do modelo. type='dependencia_fonte_externa' severity='high'.
W. COBRANÇA DE NÚMERO DE ARTIGO — o objeto CENTRAL é decorar número de artigo/inciso/§/alínea/processo ("em qual artigo", "qual artigo trata de", alternativas formadas só por "Art. N"). type='cobranca_numero_artigo' severity='high'. Correção: reescrever para cobrar o CONTEÚDO jurídico do dispositivo (citar o número só na base/comentário).
X. DISCIPLINA INCORRETA — a disciplina declarada NÃO corresponde à disciplina real identificada pelo conteúdo (Regra Zero/matriz do edital). type='disciplina_incorreta' severity='medium'; em suggestion indique a disciplina correta.
Y. FORA DO EDITAL/RECORTE — conteúdo fora das 8 disciplinas oficiais ou fora do recorte permitido (CPPM 8-28/243-253; POP 108/201-214; Redação 6.1-6.8 só definição/finalidade/uso; Português exige texto-base). type='fora_do_edital' severity='high'.


REGRA INTERPRETATIVA: paráfrase, interpretação e combinação de dispositivos SÃO VÁLIDAS — só marque alucinação quando a afirmação CONTRARIAR a lei ou inventar requisito/prazo/autoridade.
REGRA ANTI-FALSO-POSITIVO: se um artigo aparece no ÍNDICE DETERMINÍSTICO ou no bloco "DISPOSITIVOS CITADOS...", é PROIBIDO dizer que esse artigo não existe. Nesse caso, se houver problema, classifique como desalinhamento, gabarito_errado ou comentario_incompleto — nunca como alucinacao_juridica por inexistência do artigo.
REGRA DE OURO: se gabarito correto, 5 alternativas plausíveis e equilibradas, enunciado claro e comentário coerente — APROVE com issues=[].

OBRIGATÓRIO PARA CADA ISSUE:
- type: código da lista acima
- severity: low | medium | high
- field: 'enunciado' | 'alt_a' | 'alt_b' | 'alt_c' | 'alt_d' | 'alt_e' | 'gabarito' | 'comentario' | 'questao_inteira'
- evidence: trecho EXATO do conteúdo problemático (até 200 chars).
- description: explicação técnica do defeito.
- suggestion: instrução curta e ACIONÁVEL para a IA reescritora.
- fix_complexity: "simple" | "complex". Use "simple" APENAS quando a correção for mecânica e NÃO exigir reescrita de prosa jurídica. SÃO SIMPLES somente:
   • gabarito_errado (basta trocar o índice do gabarito)
   • bug_estrutural trivial (remover espaço/caractere, deduplicar alternativa idêntica, cortar truncamento óbvio)
   • formatação/pontuação isolada
  Tudo mais é "complex" (length_bias, distrator_longo, distrator_fraco, alucinacao_juridica, multiplas_corretas, sem_correta, hierarquia_violada, funcao_inconsistente, desalinhamento, comentario_*, texto_legal_desatualizado, insufficient_distractors, incoerente, duplicada).

REGRA DE ROTEAMENTO:
- Se TODAS as issues forem "simple": EMITA "proposed_patch" contendo APENAS os campos a alterar (ex.: { "gabarito": 2 }). NÃO reescreva prosa nem comentário.
- Se houver QUALQUER issue "complex": "proposed_patch" DEVE ser null — a reescrita ficará a cargo da IA jurídica Sabiá 4.

EM DUPLICADA ou INCOERENTE (irrecuperável): needs_human_review=false, proposed_patch=null, ai_summary começa com 'AUTO_DELETE: <motivo>'.

Retorne JSON ESTRITO:
{
  "confidence": 0.0-1.0,
  "risk_level": "low" | "medium" | "high",
  "issues": [
    { "type": "...", "severity": "low|medium|high", "field": "...", "evidence": "...", "description": "...", "suggestion": "...", "fix_complexity": "simple|complex" }
  ],
  "proposed_patch": null | { "gabarito"?: 0-4, "alt_a"?: "...", "alt_b"?: "...", "alt_c"?: "...", "alt_d"?: "...", "alt_e"?: "...", "enunciado"?: "..." },
  "needs_human_review": true|false,
  "ai_summary": "1-2 frases"
}

Se a questão estiver perfeita: confidence alta, issues=[], proposed_patch=null, needs_human_review=false.`;
}

/** Detecta distrator com mais de DISTRATOR_LEN_RATIO× o tamanho médio dos demais (incluindo a correta). */
function detectOversizedDistractors(q: Pick<Questao, "alt_a"|"alt_b"|"alt_c"|"alt_d"|"alt_e"|"gabarito">): Array<{ field: string; len: number; mean: number }> {
  const keys = ["alt_a","alt_b","alt_c","alt_d","alt_e"];
  const lens = keys.map((k) => String((q as any)[k] ?? "").trim().length);
  const g = q.gabarito;
  const out: Array<{ field: string; len: number; mean: number }> = [];
  for (let i = 0; i < 5; i++) {
    if (i === g) continue;
    const others = lens.filter((_, j) => j !== i);
    const mean = others.reduce((a, b) => a + b, 0) / others.length;
    if (mean > 0 && lens[i] >= mean * DISTRATOR_LEN_RATIO && lens[i] >= 200) {
      out.push({ field: keys[i], len: lens[i], mean: Math.round(mean) });
    }
  }
  return out;
}

/** Verifica se o gabarito é a alternativa mais longa OU mais curta do conjunto. */
function detectLengthBias(q: Pick<Questao, "alt_a"|"alt_b"|"alt_c"|"alt_d"|"alt_e"|"gabarito">): boolean {
  const lens = ["alt_a","alt_b","alt_c","alt_d","alt_e"].map((k) => String((q as any)[k] ?? "").trim().length);
  const g = q.gabarito;
  if (g < 0 || g > 4) return false;
  const max = Math.max(...lens);
  const min = Math.min(...lens);
  // Se há empate no extremo, não é viés (não é única).
  const isUniqueMax = lens[g] === max && lens.filter((l) => l === max).length === 1;
  const isUniqueMin = lens[g] === min && lens.filter((l) => l === min).length === 1;
  return isUniqueMax || isUniqueMin;
}

/**
 * Detecta COBRANÇA DE NÚMERO DE ARTIGO (Regra Especial do Edital CHOA/2026):
 *  - enunciado cujo objeto central é decorar a localização formal da norma; ou
 *  - alternativas formadas SOMENTE por "Art. N" / "inciso" / "§" sem conteúdo.
 */
function detectArticleNumberCobranca(
  q: Pick<Questao, "enunciado" | "alt_a" | "alt_b" | "alt_c" | "alt_d" | "alt_e">,
): { hit: boolean; reason: string } {
  const enun = String(q.enunciado ?? "");
  const enunNorm = enun.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const enunciadoPatterns = [
    /\bqual\s+artigo\b/, /\bem\s+qual\s+artigo\b/, /\bqual\s+o\s+artigo\b/,
    /\bassinale\s+o\s+(?:numero|n[º°]?)\s+do\s+artigo\b/, /\bqual\s+(?:o\s+)?inciso\b/,
    /\bem\s+qual\s+(?:inciso|paragrafo|item|processo)\b/,
    /\bo\s+art(?:igo|\.)?\s*\d+\s+(?:trata|disp[oõ]e|prev[êe])\b/,
    /\b(?:artigo|art\.?)\s+correspondente\s+(?:e|é)\b/,
    /\bapresenta\s+(?:corretamente\s+)?o\s+artigo\b/,
    /\bindica\s+(?:corretamente\s+)?o\s+(?:numero\s+do\s+)?artigo\b/,
  ];
  if (enunciadoPatterns.some((re) => re.test(enunNorm))) {
    return { hit: true, reason: "enunciado cobra a localização/número do dispositivo como objeto central" };
  }
  // Alternativas formadas apenas por referência seca (Art. N, inciso, §) — sem conteúdo jurídico.
  const alts = [q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e].map((a) => String(a ?? "").trim());
  const isBareRef = (s: string) =>
    s.length > 0 && /^(?:art(?:igo|\.)?\s*\d+[ºo°a]?\s*)+(?:[,;e/]+\s*(?:inciso|§|paragrafo|alinea|item)?\s*[ivxlcdm\d]*\.?\s*)*$/i.test(
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );
  const bare = alts.filter(isBareRef).length;
  if (bare >= 4) {
    return { hit: true, reason: `${bare} de 5 alternativas são apenas referências de artigo/inciso sem conteúdo` };
  }
  return { hit: false, reason: "" };
}

/**
 * Detecta questões de REDAÇÃO OFICIAL fora do escopo CONCEITUAL do edital.
 * O edital (Item 6, 6.1–6.8) cobra APENAS definição, finalidade e hipóteses de
 * utilização dos documentos. Questões que cobram estrutura, formatação, partes
 * constitutivas, cabeçalho, margem, fonte, espaçamento, epígrafe, vocativo, fecho,
 * diagramação, assinatura, modelos ou pronomes de tratamento são IRRECUPERÁVEIS
 * (não há como reescrever para o viés conceitual sem mudar o tema) → AUTO_DELETE.
 */
function isRedacaoOficial(disciplina: string | null | undefined): boolean {
  const d = String(disciplina ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return d.includes("redacao oficial") || d.includes("redacao") || d.includes("manual de redacao");
}

function detectRedacaoForaDeEscopo(
  q: Pick<Questao, "disciplina" | "enunciado" | "alt_a" | "alt_b" | "alt_c" | "alt_d" | "alt_e">,
): { hit: boolean; reason: string } {
  if (!isRedacaoOficial(q.disciplina)) return { hit: false, reason: "" };
  const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const enun = norm(q.enunciado);
  const alts = [q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e].map(norm).join(" \u2022 ");
  const haystack = `${enun} \u2022 ${alts}`;

  // Termos que caracterizam cobrança de estrutura/formatação (fora do escopo conceitual).
  const formatTerms: Array<[RegExp, string]> = [
    [/\bpartes?\s+(?:constitutivas?|integrantes?|componentes?|que\s+comp[oõ]em|do\s+(?:oficio|memorando|documento|ato|texto|expediente))/, "partes constitutivas do documento"],
    [/\bestrutura\s+(?:do|da|de|correta|formal|interna|basica|de\s+um|de\s+uma)/, "estrutura do documento"],
    [/\bcomo\s+(?:se\s+)?(?:estrutura|estruturar|formata|formatar|diagrama|organiza\s+graficamente)\b/, "como se estrutura/formata"],
    [/\bordem\s+(?:correta\s+)?(?:das\s+partes|dos\s+elementos|de\s+apresentacao)\b/, "ordem das partes"],
    [/\bformatac/, "formatação"],
    [/\bdiagramac/, "diagramação"],
    [/\bcabecalho\b/, "cabeçalho"],
    [/\bespacamento\b/, "espaçamento"],
    [/\bentrelinhas?\b/, "entrelinhas"],
    [/\bepigrafe\b/, "epígrafe"],
    [/\bvocativo\b/, "vocativo"],
    [/\bementa\b/, "ementa"],
    [/\bfecho\b/, "fecho"],
    [/\bmargens?\b/, "margens"],
    [/\brodape\b/, "rodapé"],
    [/\balinhamento\b/, "alinhamento"],
    [/\bnumeracao\s+(?:de\s+paragrafos?|das?\s+pagina|dos?\s+itens)\b/, "numeração de parágrafos/páginas"],
    [/\b(?:tipo|tamanho|corpo)\s+(?:de\s+)?(?:da\s+)?fonte\b/, "tipo/tamanho de fonte"],
    [/\bfonte\s+(?:arial|times|calibri|tipografica|sem\s+serifa)\b/, "fonte tipográfica"],
    [/\bpronomes?\s+de\s+tratamento\b/, "pronomes de tratamento"],
    [/\bdisposicao\s+grafica\b/, "disposição gráfica"],
    [/\b(?:modelo|leiaute|layout|padrao\s+grafico)\s+(?:do|de|correto)\b/, "modelo/leiaute do documento"],
  ];
  for (const [re, label] of formatTerms) {
    if (re.test(haystack)) return { hit: true, reason: `cobra ${label} (fora do escopo conceitual do edital 6.1–6.8)` };
  }
  return { hit: false, reason: "" };
}

function articleExists(legalText: string | null, artNum: string): boolean {
  if (!legalText) return false;
  return parseArticleBlocks(legalText).some((b) => b.artNum === artNum);
}

function getReferencedExistingArticles(q: Questao, legalText: string | null): Set<string> {
  const refs = extractArticleNumbers([
    q.artigo_principal,
    q.enunciado,
    q.alt_a,
    q.alt_b,
    q.alt_c,
    q.alt_d,
    q.alt_e,
    q.comentario,
  ].join("\n"));
  return new Set(refs.filter((num) => articleExists(legalText, num)));
}

function removeFalseHallucinationIssues(issues: any[], q: Questao, legalText: string | null): { issues: any[]; removed: string[] } {
  const existingRefs = getReferencedExistingArticles(q, legalText);
  if (!existingRefs.size) return { issues, removed: [] };
  const removed: string[] = [];
  const MISSING_ARTICLE_DERIVED_TYPES = new Set(["alucinacao_juridica", "texto_legal_desatualizado", "sem_correta", "gabarito_errado", "comentario_incompleto"]);
  const filtered = issues.filter((issue: any) => {
    const type = String(issue?.type ?? "");
    if (!MISSING_ARTICLE_DERIVED_TYPES.has(type)) return true;
    const text = [issue?.description, issue?.evidence, issue?.suggestion].map((v) => String(v ?? "")).join(" ");
    const citedInIssue = extractArticleNumbers(text);
    const saysMissing = /n[aã]o\s+(?:existe|possui|consta|prev[êe]|pode\s+ser\s+verificad[ao])|inexistente|inventad[ao]|alucina|sem\s+base\s+legal|carece(?:m)?\s+de\s+fundamento/i.test(text);
    const onlyExisting = citedInIssue.length > 0 && citedInIssue.every((num) => existingRefs.has(num));
    if (saysMissing && onlyExisting) {
      removed.push(citedInIssue.map((n) => `Art. ${n}`).join(", "));
      return false;
    }
    return true;
  });
  return { issues: filtered, removed };
}

/** Reescritor Maritaca: recebe questão + diagnóstico + lei e devolve patch jurídico de alta qualidade. */
async function rewriteWithMaritaca(
  q: Questao,
  diagnosis: { issues: any[]; ai_summary: string },
  legalText: string | null,
): Promise<{ patch: any | null; unrecoverable: boolean; summary: string }> {
  const alts = ["A","B","C","D","E"].map((l) => `${l}) ${(q as any)[`alt_${l.toLowerCase()}`]}`).join("\n");
  const correctaLetra = ["A","B","C","D","E"][q.gabarito] ?? "?";
  const blocks = legalText ? parseArticleBlocks(legalText) : [];
  const cited = extractArticleNumbers([q.enunciado, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e, q.comentario, q.artigo_principal].join("\n"));
  const relevantBlocks = cited.map((num) => blocks.find((b) => b.artNum === num)).filter(Boolean) as ArticleBlock[];
  const legalBlock = legalText
    ? `${relevantBlocks.length ? `DISPOSITIVOS CITADOS E ENCONTRADOS NA LEI:\n${relevantBlocks.map((b) => b.text.slice(0, 2500)).join("\n\n")}\n` : ""}TEXTO LEGAL DE REFERÊNCIA — FONTE ÚNICA E EXCLUSIVA. PROIBIDO usar PDFs, sites, memória do modelo, conhecimento geral ou outras leis fora deste texto:\n"""${legalText.slice(0, 10000)}"""\n`
    : "BLOQUEIO OPERACIONAL: sem texto legal oficial cadastrado. NÃO reescreva — devolva unrecoverable=true.\n";

  const issuesTxt = (diagnosis.issues || []).map((i: any, idx: number) =>
    `${idx + 1}. [${i.type} | severity=${i.severity} | field=${i.field ?? "?"}] ${i.description ?? ""}${i.evidence ? ` | EVIDÊNCIA: "${String(i.evidence).slice(0, 200)}"` : ""}${i.suggestion ? ` | SUGESTÃO: ${i.suggestion}` : ""}`
  ).join("\n");

  const prompt = `${legalBlock}
QUESTÃO #${q.id}
Disciplina: ${q.disciplina}
Assunto: ${q.assunto}
Artigo declarado: ${q.artigo_principal ?? "(não informado)"}

Enunciado:
${q.enunciado}

Alternativas:
${alts}

Gabarito atual: ${correctaLetra} (índice ${q.gabarito})

Comentário atual:
${q.comentario}

DIAGNÓSTICO DO AUDITOR (DeepSeek) — RESUMO: ${diagnosis.ai_summary ?? "(sem resumo)"}
ISSUES IDENTIFICADAS:
${issuesTxt || "(nenhuma)"}

TAREFA: produza um PATCH que corrija TODOS os defeitos diagnosticados. Aplique o máximo de conhecimento e interpretação jurídica.

REGRAS DE REESCRITA:
1. Corrija EXATAMENTE os campos apontados em "field" do diagnóstico. Preserve o restante quando possível.
2. ANTI-LENGTH-BIAS: a alternativa correta NUNCA pode ser a única mais longa nem a única mais curta. Paridade ±25%.
3. DISTRATORES LONGOS: encurte mantendo o erro típico (troca de prazo, autoridade, conectivo, regra/exceção).
4. CADA DISTRATOR usa uma técnica DIFERENTE de erro (≥2 técnicas no conjunto).
5. PROIBIDO "todas/nenhuma das anteriores", "n.d.a.", duplicatas, alternativa que contradiz o enunciado.
6. Gabarito = inteiro 0-4. Se trocar a alternativa correta, ajuste o gabarito.
7. HIERARQUIA militar: cargos/postos/competências fiéis à lei. Cite lei externa por extenso ("art. 9º do CPM").
8. COMENTÁRIO em 4 movimentos OBRIGATÓRIOS, parágrafos fluidos, 600-1500 chars:
   (i) "A alternativa correta é a [X], pois..." + citação literal curta do dispositivo.
   (ii) "A pegadinha desta questão está em..." + nomeia a técnica.
   (iii) Análise INDIVIDUAL de cada alternativa errada: "Alternativa [Y]: incorreta porque ... Vide [art. Z]". NUNCA "as demais estão erradas".
   (iv) "Lembre-se: segundo o [art. X da Lei Y], [regra geral]".
9. Se a questão for IRRECUPERÁVEL juridicamente (ex.: nenhuma alternativa pode ser correta à luz da lei, ou diagnóstico AUTO_DELETE), devolva unrecoverable=true e patch=null.

Retorne JSON ESTRITO:
{
  "patch": {
    "enunciado"?: "...",
    "alt_a"?: "...", "alt_b"?: "...", "alt_c"?: "...", "alt_d"?: "...", "alt_e"?: "...",
    "gabarito"?: 0-4,
    "comentario"?: "..."
  } | null,
  "techniques_used": ["..."],
  "unrecoverable": true|false,
  "summary": "1-2 frases sobre o que foi corrigido"
}`;

  let raw = "";
  let usedProvider = "Router (heavy_reported_question_audit)";
  let fallbackReason = "";

  // 1ª via — Router jurídico de ALTO risco: Gemini Pro → Gemini Flash → OpenRouter.
  try {
    const r = await runAiStage(
      "heavy_reported_question_audit",
      [
        { role: "system", content: REWRITER_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      {
        jsonResponse: true,
        questionId: q.id ?? null,
        timeoutMs: 120_000,
        metadata: { task: "audit_rewrite" },
      },
    );
    raw = r.content;
    usedProvider = `Router (${r.provider}:${r.model})`;
  } catch (eRouter) {
    fallbackReason = `Router de reescrita indisponível (${eRouter instanceof Error ? eRouter.message : eRouter}). Acionando DeepSeek Reasoner.`;
    console.warn("[audit-questions]", fallbackReason);
    // 2ª via — DeepSeek Reasoner direto.
    try {
      raw = await callDeepSeekRewriter(prompt);
      usedProvider = "DeepSeek Reasoner (fallback)";
    } catch (e) {
      const isNoCredits = e instanceof NoCreditsError;
      if (isNoCredits || /HTTP\s+(401|402|403|429|5\d\d)/i.test(e instanceof Error ? e.message : "")) {
        // 3ª via — Maritaca.
        if (!MARITACA_API_KEY) {
          return { patch: null, unrecoverable: false, summary: `Falha router/DeepSeek Reasoner e Maritaca não configurada: ${e instanceof Error ? e.message : e}` };
        }
        try {
          raw = await callMaritaca(prompt);
          usedProvider = "Maritaca (fallback)";
        } catch (e2) {
          return { patch: null, unrecoverable: false, summary: `Falha router, DeepSeek e Maritaca: ${e2 instanceof Error ? e2.message : e2}` };
        }
      } else {
        return { patch: null, unrecoverable: false, summary: `Falha router e DeepSeek Reasoner: ${e instanceof Error ? e.message : e}` };
      }
    }
  }

  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return { patch: null, unrecoverable: false, summary: `${usedProvider} retornou JSON inválido${fallbackReason ? ` (${fallbackReason})` : ""}` };
  }
  if (parsed.unrecoverable === true) {
    return { patch: null, unrecoverable: true, summary: String(parsed.summary ?? `${usedProvider} classificou como irrecuperável`) };
  }
  let patch = parsed.patch && typeof parsed.patch === "object" ? parsed.patch : null;
  if (patch) {
    const allowed = ["gabarito","comentario","alt_a","alt_b","alt_c","alt_d","alt_e","enunciado"];
    const clean: any = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    if ("gabarito" in clean) {
      const g = Number(clean.gabarito);
      if (!Number.isInteger(g) || g < 0 || g > 4) delete clean.gabarito;
    }
    patch = Object.keys(clean).length ? clean : null;
  }
  const techniques = Array.isArray(parsed.techniques_used) ? parsed.techniques_used.map((t: any) => String(t)).slice(0, 10) : [];
  (patch ?? {}).__techniques = techniques;
  const baseSummary = String(parsed.summary ?? `Patch gerado por ${usedProvider}`);
  return { patch, unrecoverable: false, summary: fallbackReason ? `[${usedProvider}] ${baseSummary}` : baseSummary };
}

async function auditOne(q: Questao, legalText: string | null, userReports: string[] = []): Promise<AuditResult> {
  const reportsBlock = userReports.length
    ? `\n\nREPORTES DE USUÁRIOS SOBRE ESTA QUESTÃO (ALERTA OBRIGATÓRIO — confronte cada alegação com o texto legal):\n${userReports.map((m, i) => `[Reporte ${i + 1}] ${m}`).join("\n")}\nSe um reporte apontar gabarito errado/conteúdo invertido E o texto legal confirmar, registre issue com type='reporte_usuario', field=campo afetado, evidence=trecho, suggestion=correção necessária.\n`
    : "";

  // ── ETAPA 1: DeepSeek DIAGNOSTICA defeitos com field/evidence/suggestion. ──
  const raw = await callDeepSeek(buildAuditPrompt(q, legalText) + reportsBlock, q.id ?? null);
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return {
      confidence: 0,
      risk_level: "high",
      issues: [{ type: "outros", severity: "high", field: "questao_inteira", description: "DeepSeek retornou resposta inválida", suggestion: "Tentar novamente ou revisar manualmente" }],
      proposed_patch: null,
      needs_human_review: true,
      ai_summary: "Falha de parse do diagnóstico DeepSeek",
      techniques_used: [],
    };
  }
  const conf = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
  const risk = ["low", "medium", "high"].includes(parsed.risk_level) ? parsed.risk_level : "medium";
  let issues: any[] = Array.isArray(parsed.issues) ? parsed.issues : [];
  let aiSummary = String(parsed.ai_summary ?? "");
  const falseHallucinations = removeFalseHallucinationIssues(issues, q, legalText);
  issues = falseHallucinations.issues;
  if (falseHallucinations.removed.length) {
    aiSummary = aiSummary.replace(/^AUTO_DELETE:/i, "Falso AUTO_DELETE bloqueado:");
    aiSummary = `${aiSummary} | Falso positivo removido: artigo existente na lei (${[...new Set(falseHallucinations.removed)].join(", ")}).`.trim();
  }

  // ── Detecções determinísticas que complementam o DeepSeek ──
  if (detectLengthBias(q) && !issues.some((i: any) => i?.type === "length_bias")) {
    const lens = ["alt_a","alt_b","alt_c","alt_d","alt_e"].map((k) => String((q as any)[k] ?? "").length);
    const isMax = lens[q.gabarito] === Math.max(...lens);
    issues.push({
      type: "length_bias",
      severity: "high",
      field: `alt_${["a","b","c","d","e"][q.gabarito]}`,
      evidence: `tamanho da correta=${lens[q.gabarito]}; outros=${lens.filter((_, i) => i !== q.gabarito).join(",")}`,
      description: `Alternativa correta é a única ${isMax ? "mais longa" : "mais curta"} — padrão previsível.`,
      suggestion: "Reescrever distratores para paridade ±25% sem alterar o gabarito.",
    });
  }
  for (const o of detectOversizedDistractors(q)) {
    if (!issues.some((i: any) => i?.type === "distrator_longo" && i?.field === o.field)) {
      issues.push({
        type: "distrator_longo",
        severity: "medium",
        field: o.field,
        evidence: `${o.field} tem ${o.len} chars (média das demais ≈ ${o.mean}, ratio ${(o.len/o.mean).toFixed(2)}×)`,
        description: `Distrator desproporcionalmente longo frente aos demais — torna a questão previsível.`,
        suggestion: `Encurtar ${o.field} para ~${o.mean} chars preservando o erro típico (troca de prazo/autoridade/conectivo).`,
      });
    }
  }
  // Cobrança de número de artigo (Regra Especial do edital) — detecção determinística.
  {
    const art = detectArticleNumberCobranca(q);
    if (art.hit && !issues.some((i: any) => i?.type === "cobranca_numero_artigo")) {
      issues.push({
        type: "cobranca_numero_artigo",
        severity: "high",
        field: "questao_inteira",
        evidence: art.reason,
        description: "Questão cobra memorização do número do dispositivo como objeto central — proibido pelo edital CHOA/2026.",
        suggestion: "Reescrever para cobrar o CONTEÚDO jurídico do dispositivo; citar o número apenas na base normativa/comentário.",
      });
    }
  }

  // Redação Oficial fora do escopo conceitual (estrutura/formatação/partes) — detecção
  // determinística que força AUTO_DELETE (irrecuperável: não dá para reescrever para o
  // viés conceitual sem trocar o tema da questão).
  {
    const red = detectRedacaoForaDeEscopo(q);
    if (red.hit) {
      if (!issues.some((i: any) => i?.type === "fora_do_edital")) {
        issues.push({
          type: "fora_do_edital",
          severity: "high",
          field: "questao_inteira",
          evidence: red.reason,
          description: "Questão de Redação Oficial cobra estrutura/formatação/partes do documento — fora do escopo conceitual (definição, finalidade e hipóteses de uso) do edital CHOA/2026, Item 6 (6.1–6.8).",
          suggestion: "Excluir: não é possível reescrever para o viés conceitual sem inventar nova questão.",
        });
      }
      if (!/^AUTO_DELETE:/i.test(aiSummary)) {
        aiSummary = `AUTO_DELETE: Redação fora do escopo conceitual — ${red.reason}.${aiSummary ? " " + aiSummary : ""}`;
      }
    }
  }


  // Issues SIMPLES (mecânicas) → DeepSeek já entregou o patch.
  // Issues COMPLEXAS (prosa jurídica) → Maritaca Sabiá 4 reescreve.
  const SIMPLE_TYPES = new Set(["gabarito_errado", "bug_estrutural", "formatacao", "disciplina_incorreta"]);
  const FORCED_COMPLEX_TYPES = new Set([
    "length_bias", "distrator_longo", "distrator_fraco", "alucinacao_juridica",
    "multiplas_corretas", "sem_correta", "hierarquia_violada", "funcao_inconsistente",
    "desalinhamento", "sem_comentario", "comentario_loop", "comentario_incompleto",
    "texto_legal_desatualizado", "insufficient_distractors", "incoerente", "duplicada",
    "reporte_usuario", "cobranca_numero_artigo", "fora_do_edital",
  ]);
  // Normaliza fix_complexity de cada issue (DeepSeek pode errar — código tem a palavra final).
  for (const i of issues) {
    const t = String(i?.type ?? "");
    if (FORCED_COMPLEX_TYPES.has(t)) i.fix_complexity = "complex";
    else if (SIMPLE_TYPES.has(t) && i.fix_complexity !== "complex") i.fix_complexity = "simple";
    else if (!i.fix_complexity) i.fix_complexity = "complex";
  }

  let patch: any = null;
  let techniques: string[] = [];
  let rewriteSummary = "";
  const isAutoDelete = /^AUTO_DELETE:/i.test(aiSummary);
  const hasIrrecoverable = issues.some((i: any) => i?.type === "incoerente" || i?.type === "duplicada" || i?.type === "unrecoverable");
  const hasRealDefect = issues.some((i: any) => i?.severity === "medium" || i?.severity === "high");
  const hasComplex = issues.some((i: any) => i?.fix_complexity === "complex");
  const hasSimple = issues.some((i: any) => i?.fix_complexity === "simple");

  if (!isAutoDelete && !hasIrrecoverable && hasRealDefect) {
    if (!hasComplex && hasSimple) {
      // ── Caminho rápido: DeepSeek aplica correção mecânica. ──
      const ds = parsed.proposed_patch && typeof parsed.proposed_patch === "object" ? parsed.proposed_patch : null;
      if (ds) {
        const allowed = ["gabarito","alt_a","alt_b","alt_c","alt_d","alt_e","enunciado"];
        const clean: any = {};
        for (const k of allowed) if (k in ds) clean[k] = (ds as any)[k];
        if ("gabarito" in clean) {
          const g = Number(clean.gabarito);
          if (!Number.isInteger(g) || g < 0 || g > 4) delete clean.gabarito;
        }
        if (Object.keys(clean).length) {
          patch = clean;
          rewriteSummary = "Correção simples aplicada pelo DeepSeek (sem reescrita de prosa).";
        }
      }
      // Se DeepSeek não entregou patch utilizável, cai para revisão manual (não chama Maritaca à toa).
    } else if (hasComplex && (DEEPSEEK_API_KEY || MARITACA_API_KEY)) {
      // ── Caminho jurídico: DeepSeek Reasoner (primário) reescreve; Maritaca fica como fallback. ──
      const r = await rewriteWithMaritaca(q, { issues, ai_summary: aiSummary }, legalText);
      rewriteSummary = `Reescrita: ${r.summary}`;
      if (r.unrecoverable) {
        issues.push({
          type: "unrecoverable",
          severity: "high",
          field: "questao_inteira",
          description: "IA reescritora classificou a questão como irrecuperável após análise jurídica.",
          suggestion: "Exclusão recomendada.",
          fix_complexity: "complex",
        });
      } else if (r.patch) {
        techniques = (r.patch.__techniques as string[]) ?? [];
        delete r.patch.__techniques;
        patch = r.patch;
      }
    }
  }


  // Re-verifica length_bias no estado FINAL (após patch).
  if (patch) {
    const finalAlts = {
      alt_a: patch.alt_a ?? q.alt_a,
      alt_b: patch.alt_b ?? q.alt_b,
      alt_c: patch.alt_c ?? q.alt_c,
      alt_d: patch.alt_d ?? q.alt_d,
      alt_e: patch.alt_e ?? q.alt_e,
      gabarito: typeof patch.gabarito === "number" ? patch.gabarito : q.gabarito,
    };
    if (detectLengthBias(finalAlts) && !issues.some((i: any) => i?.type === "length_bias_persistente")) {
      issues.push({
        type: "length_bias_persistente",
        severity: "high",
        field: "questao_inteira",
        description: "Após reescrita da IA o length_bias persistiu.",
        suggestion: "Revisar manualmente o equilíbrio das alternativas.",
      });
    }
  }

  return {
    confidence: conf,
    risk_level: risk,
    issues,
    proposed_patch: patch,
    needs_human_review: Boolean(parsed.needs_human_review) || issues.some((i: any) => i?.severity === "high" && i?.type !== "length_bias" && i?.type !== "distrator_longo"),
    ai_summary: [aiSummary, rewriteSummary].filter(Boolean).join(" | "),
    techniques_used: techniques,
  };
}

/**
 * 2ª passagem: se a questão (após patch) AINDA tem length_bias, pede à IA
 * para reescrever APENAS os distratores (mantendo a correta) equilibrando o
 * tamanho. Se a IA conseguir, devolvemos novo patch + status auto_fix; se
 * declarar irrecuperável, devolvemos null para cair em manual_review.
 */
async function rewriteDistractorsForLengthBias(
  q: Questao,
  currentPatch: any | null,
  legalText: string | null,
): Promise<{ patch: any | null; unrecoverable: boolean; summary: string }> {
  const merged = {
    enunciado: currentPatch?.enunciado ?? q.enunciado,
    alt_a: currentPatch?.alt_a ?? q.alt_a,
    alt_b: currentPatch?.alt_b ?? q.alt_b,
    alt_c: currentPatch?.alt_c ?? q.alt_c,
    alt_d: currentPatch?.alt_d ?? q.alt_d,
    alt_e: currentPatch?.alt_e ?? q.alt_e,
    gabarito: typeof currentPatch?.gabarito === "number" ? currentPatch.gabarito : q.gabarito,
    comentario: currentPatch?.comentario ?? q.comentario,
  };
  const letras = ["A","B","C","D","E"];
  const altsTxt = letras.map((l,i) => `${l}) ${(merged as any)[`alt_${l.toLowerCase()}`]}`).join("\n");
  const correctaLetra = letras[merged.gabarito] ?? "?";
  const correctaTxt = (merged as any)[`alt_${correctaLetra.toLowerCase()}`] ?? "";
  const targetLen = String(correctaTxt).trim().length;
  const minLen = Math.floor(targetLen * 0.8);
  const maxLen = Math.ceil(targetLen * 1.25);

  const legalBlock = legalText
    ? `TEXTO LEGAL DE REFERÊNCIA:\n"""${legalText.slice(0, 7000)}"""\n`
    : "";

  const prompt = `${legalBlock}
QUESTÃO #${q.id} — REESCRITA DE DISTRATORES PARA ELIMINAR LENGTH BIAS
Disciplina: ${q.disciplina} | Assunto: ${q.assunto}

Enunciado: ${merged.enunciado}

Alternativas atuais:
${altsTxt}

Gabarito: ${correctaLetra} (índice ${merged.gabarito})
Alternativa correta (NÃO ALTERE seu sentido nem sua posição): "${correctaTxt}"
Tamanho-alvo: ${targetLen} caracteres. Cada distrator deve ter entre ${minLen} e ${maxLen} caracteres.

TAREFA:
1. Reescreva APENAS as 4 alternativas INCORRETAS para que TODAS as 5 fiquem com tamanho similar (±25% da correta) e mesmo registro técnico-jurídico.
2. Cada distrator deve permanecer juridicamente plausível mas claramente incorreto frente ao texto legal acima (use técnicas: troca de prazo, troca de autoridade, inversão regra/exceção, troca de conectivo, posto/cargo trocado, etc.).
3. Mantenha o gabarito ${correctaLetra}. Mantenha a alternativa correta EXATAMENTE como está.
4. NÃO mexa em enunciado nem comentário.
5. Se for impossível reescrever os distratores preservando coerência jurídica e equilíbrio (ex.: a própria correta é tão curta/longa que não dá para equilibrar sem perder sentido), devolva unrecoverable=true.

Retorne JSON ESTRITO:
{
  "alt_a": "...", "alt_b": "...", "alt_c": "...", "alt_d": "...", "alt_e": "...",
  "unrecoverable": true|false,
  "summary": "1 frase sobre o que foi reescrito ou por que é irrecuperável"
}`;

  let raw = "";
  try { raw = await callDeepSeek(prompt, q.id ?? null); } catch (e) {
    return { patch: null, unrecoverable: false, summary: `Falha rewrite IA: ${e instanceof Error ? e.message : e}` };
  }
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return { patch: null, unrecoverable: false, summary: "Rewrite IA retornou JSON inválido" };
  }
  if (parsed.unrecoverable === true) {
    return { patch: null, unrecoverable: true, summary: String(parsed.summary ?? "IA classificou como irrecuperável") };
  }
  const newPatch: any = {};
  for (const k of ["alt_a","alt_b","alt_c","alt_d","alt_e"]) {
    if (typeof parsed[k] === "string" && parsed[k].trim()) newPatch[k] = parsed[k].trim();
  }
  // Preserva a correta literalmente
  const correctaKey = `alt_${correctaLetra.toLowerCase()}`;
  newPatch[correctaKey] = correctaTxt;
  // Merge com patch anterior (preserva enunciado/comentario/gabarito)
  const combinedPatch = { ...(currentPatch ?? {}), ...newPatch };

  // Verifica se resolveu o bias
  const check = {
    alt_a: combinedPatch.alt_a ?? q.alt_a,
    alt_b: combinedPatch.alt_b ?? q.alt_b,
    alt_c: combinedPatch.alt_c ?? q.alt_c,
    alt_d: combinedPatch.alt_d ?? q.alt_d,
    alt_e: combinedPatch.alt_e ?? q.alt_e,
    gabarito: combinedPatch.gabarito ?? q.gabarito,
  };
  if (detectLengthBias(check)) {
    return { patch: null, unrecoverable: true, summary: "Rewrite não eliminou o length_bias" };
  }
  return { patch: combinedPatch, unrecoverable: false, summary: String(parsed.summary ?? "Distratores reescritos para equilibrar tamanho") };
}

// ──────────────────────────────────────────────────────────────────────────
// P1.4 / P1.5 — MODO REPAIR DEDICADO + PROOF_MATRIX ESTRUTURADA + VALIDAÇÃO
// ──────────────────────────────────────────────────────────────────────────

/** Encontra a literal_evidence dentro do legalText normalizado.
 *  Retorna {found, snippet} — snippet é o trecho casado (até 240 chars) no original. */
function evidenceInLegalText(evidence: string, legalText: string): { found: boolean; snippet: string | null } {
  const ev = String(evidence ?? "").trim();
  if (ev.length < 20) return { found: false, snippet: null };
  const normEv = normalizeLegalText(ev);
  const normLaw = normalizeLegalText(legalText);
  if (!normEv || !normLaw) return { found: false, snippet: null };
  // Exato (após normalização)
  if (normLaw.includes(normEv)) {
    return { found: true, snippet: ev.slice(0, 240) };
  }
  // Tolerante: ao menos 40 chars seguidos da evidência (núcleo) aparecem na lei.
  if (normEv.length >= 40) {
    const core = normEv.slice(0, Math.min(120, normEv.length));
    if (normLaw.includes(core)) return { found: true, snippet: ev.slice(0, 240) };
  }
  return { found: false, snippet: null };
}

type ProofMatrixEntry = {
  letter: string;
  text: string;
  verdict: boolean;
  literal_evidence: string;
  source_article?: string | null;
};

type ProofMatrixValidation = {
  valid: boolean;
  errors: string[];
  trueCount: number;
  evidenceFound: number;
  normalized: ProofMatrixEntry[];
};

/** P1.5 — Valida programaticamente a matriz de prova literal por alternativa. */
function validateProofMatrix(matrix: unknown, legalText: string | null): ProofMatrixValidation {
  const errors: string[] = [];
  const normalized: ProofMatrixEntry[] = [];
  if (!Array.isArray(matrix)) {
    return { valid: false, errors: ["proof_matrix ausente ou não é array"], trueCount: 0, evidenceFound: 0, normalized: [] };
  }
  if (matrix.length !== 5) {
    errors.push(`proof_matrix deve ter exatamente 5 entradas (recebeu ${matrix.length})`);
  }
  const seenLetters = new Set<string>();
  let trueCount = 0;
  let evidenceFound = 0;
  for (let i = 0; i < matrix.length; i++) {
    const raw = matrix[i] as any;
    const letter = String(raw?.letter ?? "").trim().toUpperCase();
    const text = String(raw?.text ?? "").trim();
    const verdict = raw?.verdict === true;
    const literal_evidence = String(raw?.literal_evidence ?? "").trim();
    const source_article = raw?.source_article ? String(raw.source_article).trim() : null;
    if (!["A","B","C","D","E"].includes(letter)) {
      errors.push(`entrada #${i + 1}: letter inválida ("${letter}")`);
    } else if (seenLetters.has(letter)) {
      errors.push(`entrada #${i + 1}: letter "${letter}" duplicada`);
    } else {
      seenLetters.add(letter);
    }
    if (text.length < 3) errors.push(`entrada ${letter || `#${i + 1}`}: text vazio/curto`);
    if (typeof raw?.verdict !== "boolean") errors.push(`entrada ${letter || `#${i + 1}`}: verdict deve ser booleano`);
    if (literal_evidence.length < 20) {
      errors.push(`entrada ${letter || `#${i + 1}`}: literal_evidence < 20 chars (sem prova literal suficiente)`);
    } else if (legalText) {
      const { found } = evidenceInLegalText(literal_evidence, legalText);
      if (!found) {
        errors.push(`entrada ${letter || `#${i + 1}`}: literal_evidence NÃO encontrada no texto legal cadastrado`);
      } else {
        evidenceFound++;
      }
    }
    if (verdict) trueCount++;
    normalized.push({ letter, text, verdict, literal_evidence, source_article });
  }
  if (trueCount !== 1) {
    errors.push(`proof_matrix deve ter EXATAMENTE 1 entrada com verdict=true (recebeu ${trueCount})`);
  }
  return { valid: errors.length === 0, errors, trueCount, evidenceFound, normalized };
}

/** P1.4 — Constrói o prompt do modo REPAIR (rewriter exige proof_matrix literal). */
function buildRepairPrompt(q: Questao, diagnosis: { issues: any[]; ai_summary: string } | null, legalText: string): string {
  const alts = ["A","B","C","D","E"].map((l) => `${l}) ${(q as any)[`alt_${l.toLowerCase()}`]}`).join("\n");
  const correctaLetra = ["A","B","C","D","E"][q.gabarito] ?? "?";
  const blocks = parseArticleBlocks(legalText);
  const cited = extractArticleNumbers([q.enunciado, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e, q.comentario, q.artigo_principal].join("\n"));
  const relevantBlocks = cited.map((num) => blocks.find((b) => b.artNum === num)).filter(Boolean) as ArticleBlock[];
  const legalBlock = `${relevantBlocks.length ? `DISPOSITIVOS CITADOS E ENCONTRADOS NA LEI:\n${relevantBlocks.map((b) => b.text.slice(0, 2500)).join("\n\n")}\n` : ""}TEXTO LEGAL DE REFERÊNCIA — FONTE ÚNICA E EXCLUSIVA. Toda literal_evidence DEVE ser um trecho LITERAL deste texto. PROIBIDO inventar, parafrasear como se fosse literal, usar PDFs, sites, memória ou outras leis:\n"""${legalText.slice(0, 10000)}"""\n`;

  const issuesTxt = (diagnosis?.issues || []).map((i: any, idx: number) =>
    `${idx + 1}. [${i.type} | severity=${i.severity} | field=${i.field ?? "?"}] ${i.description ?? ""}${i.evidence ? ` | EVIDÊNCIA: "${String(i.evidence).slice(0, 200)}"` : ""}${i.suggestion ? ` | SUGESTÃO: ${i.suggestion}` : ""}`
  ).join("\n");

  return `${legalBlock}
QUESTÃO #${q.id}
Disciplina: ${q.disciplina}
Assunto: ${q.assunto}
Artigo declarado: ${q.artigo_principal ?? "(não informado)"}

Enunciado:
${q.enunciado}

Alternativas:
${alts}

Gabarito atual: ${correctaLetra} (índice ${q.gabarito})

Comentário atual:
${q.comentario}

${diagnosis ? `DIAGNÓSTICO DO AUDITOR — RESUMO: ${diagnosis.ai_summary ?? "(sem resumo)"}\nISSUES IDENTIFICADAS:\n${issuesTxt || "(nenhuma)"}\n` : ""}

MODO: REPAIR ESTRUTURADO. Você é um REESCRITOR jurídico de elite (concursos militares + CESPE/FGV). Produza um PATCH que corrija TODOS os defeitos E uma PROOF_MATRIX literal obrigatória.

REGRAS DE REESCRITA:
1. Corrija EXATAMENTE os campos apontados em "field" do diagnóstico (quando houver). Preserve o restante quando possível.
2. ANTI-LENGTH-BIAS: a alternativa correta NUNCA pode ser a única mais longa nem a única mais curta. Paridade ±25%.
3. CADA distrator usa uma técnica DIFERENTE de erro (≥2 técnicas no conjunto). Encurte distratores longos preservando o erro típico.
4. PROIBIDO "todas/nenhuma das anteriores", "n.d.a.", duplicatas, alternativa que contradiz o enunciado.
5. Gabarito = inteiro 0-4. Se trocar a correta, ajuste o gabarito coerentemente.
6. HIERARQUIA militar fiel à lei. Cite lei externa por extenso quando inevitável.
7. COMENTÁRIO em 4 movimentos OBRIGATÓRIOS, parágrafos fluidos, 600-1500 chars.

PROOF_MATRIX (OBRIGATÓRIA, 5 entradas — uma por alternativa A,B,C,D,E na ordem):
Cada entrada DEVE conter:
- letter: "A" | "B" | "C" | "D" | "E"
- text: o texto FINAL da alternativa após o patch (idêntico ao patch.alt_X correspondente)
- verdict: true se for a alternativa CORRETA; false se for distrator. EXATAMENTE UMA entrada deve ter verdict=true.
- literal_evidence: trecho LITERAL (≥40 chars) copiado do TEXTO LEGAL acima que prove o verdict (para a correta, prove por que é correta; para distrator, prove por que está errado/contradiz a lei). PROIBIDO parafrasear — deve ser cópia literal verificável.
- source_article: "Art. X" (opcional mas recomendado) que contém a literal_evidence.

REPAIR_TYPE: classifique a correção realizada em uma destas tags: "gabarito_swap" | "distrator_rewrite" | "comentario_rewrite" | "enunciado_rewrite" | "multi_field" | "none".

RISCO: classifique o risco da reescrita: "low" (mudança mecânica/comprovada literalmente) | "medium" (reescrita de prosa com prova literal sólida) | "high" (mudança estrutural, troca de gabarito, ou qualquer dúvida).

CONFIANÇA: 0.0-1.0. Use ≥0.9 SOMENTE quando toda alternativa tem literal_evidence verificável copiada da lei e não há ambiguidade.

NEEDS_HUMAN_REVIEW: true se houver QUALQUER dúvida, se for trocar gabarito sem certeza absoluta, se a literal_evidence depender de interpretação extensiva, ou se você não conseguir cobrir as 5 alternativas com prova literal sólida. Caso contrário false.

RECOVERABLE: false se a questão for IRRECUPERÁVEL à luz da lei (sem alternativa correta possível, sem base legal, premissa contraditória). Nesse caso patch=null e proof_matrix=[].

Retorne JSON ESTRITO:
{
  "recoverable": true|false,
  "confidence": 0.0-1.0,
  "risk_level": "low" | "medium" | "high",
  "diagnosis": "1-2 frases descrevendo o defeito principal corrigido",
  "repair_type": "gabarito_swap|distrator_rewrite|comentario_rewrite|enunciado_rewrite|multi_field|none",
  "source_articles": ["Art. X", "Art. Y"],
  "proof_matrix": [
    { "letter": "A", "text": "...", "verdict": false|true, "literal_evidence": "...", "source_article": "Art. X" },
    { "letter": "B", ... }, { "letter": "C", ... }, { "letter": "D", ... }, { "letter": "E", ... }
  ],
  "patch": {
    "enunciado"?: "...",
    "alt_a"?: "...", "alt_b"?: "...", "alt_c"?: "...", "alt_d"?: "...", "alt_e"?: "...",
    "gabarito"?: 0-4,
    "comentario"?: "..."
  } | null,
  "needs_human_review": true|false,
  "summary": "1-2 frases sobre o que foi corrigido"
}`;
}

/** P1.4 — Executa o modo REPAIR completo para UMA questão. */
async function repairQuestion(
  supabase: ReturnType<typeof createClient>,
  questionId: number,
  opts?: { skipAudit?: boolean },
): Promise<{
  ok: boolean;
  audit_id: number | null;
  applied: boolean;
  recoverable: boolean;
  needs_human_review: boolean;
  proof_validation: ProofMatrixValidation | null;
  summary: string;
  diagnosis?: any;
  patch?: any;
  proof_matrix?: ProofMatrixEntry[];
  error?: string;
}> {
  // 1) Carrega questão
  const { data: q, error: qErr } = await supabase.from("questoes").select("*").eq("id", questionId).single();
  if (qErr || !q) {
    return { ok: false, audit_id: null, applied: false, recoverable: false, needs_human_review: true, proof_validation: null, summary: "Questão não encontrada", error: qErr?.message ?? "not_found" };
  }
  const questao = q as Questao;

  // 2) Carrega texto legal da disciplina
  const { data: legalRows } = await supabase
    .from("discipline_legal_texts")
    .select("content")
    .eq("disciplina", questao.disciplina)
    .limit(5);
  const legalText = (legalRows ?? []).map((r: any) => r.content).join("\n\n").slice(0, 18000);
  if (!legalText || legalText.trim().length < 500) {
    const { data: audIns } = await supabase.from("question_audits").insert({
      questao_id: questionId,
      status: "manual_review",
      confidence: 0,
      risk_level: "high",
      issues: [{ type: "NO_LEGAL_TEXT", severity: "high", description: "Repair bloqueado: texto legal oficial insuficiente." }],
      ai_summary: "Repair não executado por ausência de fonte legal estruturada.",
    }).select("id").single();
    await setQuestionAuditStatus(supabase, questionId, Q_STATUS.MANUAL);
    return { ok: false, audit_id: audIns?.id ?? null, applied: false, recoverable: false, needs_human_review: true, proof_validation: null, summary: "Sem texto legal suficiente para repair." };
  }

  // 3) Diagnóstico opcional (reusa auditOne)
  let diagnosis: { issues: any[]; ai_summary: string } | null = null;
  if (!opts?.skipAudit) {
    try {
      const r = await auditOne(questao, legalText, []);
      diagnosis = { issues: r.issues ?? [], ai_summary: r.ai_summary ?? "" };
    } catch (e) {
      console.warn("[repair] auditOne falhou, seguindo sem diagnóstico:", e instanceof Error ? e.message : e);
    }
  }

  // 4) Chama o REASONER com prompt de repair estruturado
  const prompt = buildRepairPrompt(questao, diagnosis, legalText);
  let raw = "";
  let usedProvider: "DeepSeek Reasoner" | "Maritaca (fallback)" = "DeepSeek Reasoner";
  try {
    raw = await callDeepSeekRewriter(prompt);
  } catch (e) {
    if (e instanceof NoCreditsError && MARITACA_API_KEY) {
      try {
        raw = await callMaritaca(prompt);
        usedProvider = "Maritaca (fallback)";
      } catch (e2) {
        return { ok: false, audit_id: null, applied: false, recoverable: false, needs_human_review: true, proof_validation: null, summary: `Falha DeepSeek+Maritaca: ${e2 instanceof Error ? e2.message : e2}` };
      }
    } else {
      return { ok: false, audit_id: null, applied: false, recoverable: false, needs_human_review: true, proof_validation: null, summary: `Falha repair: ${e instanceof Error ? e.message : e}` };
    }
  }
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, audit_id: null, applied: false, recoverable: false, needs_human_review: true, proof_validation: null, summary: `${usedProvider} retornou JSON inválido` };
  }

  // 5) Caso IA classifique como irrecuperável
  if (parsed.recoverable === false) {
    const { data: audIns } = await supabase.from("question_audits").insert({
      questao_id: questionId,
      status: "manual_review",
      confidence: Number(parsed.confidence ?? 0),
      risk_level: String(parsed.risk_level ?? "high"),
      issues: [{ type: "unrecoverable", severity: "high", description: String(parsed.diagnosis ?? parsed.summary ?? "Classificada como irrecuperável") }],
      proposed_patch: null,
      ai_summary: `[REPAIR/${usedProvider}] IRRECUPERÁVEL: ${parsed.summary ?? parsed.diagnosis ?? ""}`,
    }).select("id").single();
    await setQuestionAuditStatus(supabase, questionId, Q_STATUS.MANUAL);
    return { ok: true, audit_id: audIns?.id ?? null, applied: false, recoverable: false, needs_human_review: true, proof_validation: null, summary: String(parsed.summary ?? "Irrecuperável") };
  }

  // 6) Sanitiza patch
  const rawPatch = (parsed.patch && typeof parsed.patch === "object") ? parsed.patch : null;
  let patch: any = null;
  if (rawPatch) {
    const allowed = ["enunciado","alt_a","alt_b","alt_c","alt_d","alt_e","gabarito","comentario"];
    patch = {};
    for (const k of allowed) if (k in rawPatch) patch[k] = (rawPatch as any)[k];
    if ("gabarito" in patch) {
      const g = Number(patch.gabarito);
      if (!Number.isInteger(g) || g < 0 || g > 4) delete patch.gabarito;
    }
    if (!Object.keys(patch).length) patch = null;
  }

  // 7) VALIDA proof_matrix (P1.5)
  const validation = validateProofMatrix(parsed.proof_matrix, legalText);

  // 8) Checagem cruzada: gabarito (efetivo após patch) bate com o índice cuja proof_matrix.verdict é true?
  const effectiveGabarito = typeof patch?.gabarito === "number" ? patch.gabarito : questao.gabarito;
  const trueEntry = validation.normalized.find((e) => e.verdict === true);
  const trueIdx = trueEntry ? ["A","B","C","D","E"].indexOf(trueEntry.letter) : -1;
  const gabaritoConsistente = trueIdx !== -1 && trueIdx === effectiveGabarito;
  if (validation.valid && !gabaritoConsistente) {
    validation.errors.push(`gabarito final (${effectiveGabarito}) não bate com a alternativa marcada verdict=true na proof_matrix (${trueEntry?.letter ?? "?"})`);
    validation.valid = false;
  }

  // 9) Decisão de auto-aplicação
  const confidence = Number(parsed.confidence ?? 0);
  const riskLevel = String(parsed.risk_level ?? "medium");
  const aiNeedsHuman = Boolean(parsed.needs_human_review);
  const canAutoApply = validation.valid
    && patch
    && confidence >= 0.9
    && riskLevel === "low"
    && !aiNeedsHuman;

  // 10) Persiste auditoria com proposed_patch + proof_matrix sempre
  const auditPayload = {
    questao_id: questionId,
    status: canAutoApply ? "auto_fixed" : "manual_review",
    confidence,
    risk_level: riskLevel,
    issues: [
      ...(diagnosis?.issues ?? []),
      ...validation.errors.map((msg) => ({ type: "proof_matrix_invalid", severity: "high", description: msg })),
    ],
    proposed_patch: patch ? { ...patch, __proof_matrix: validation.normalized, __repair_type: String(parsed.repair_type ?? "none"), __source_articles: Array.isArray(parsed.source_articles) ? parsed.source_articles : [] } : null,
    applied_patch: null as any,
    ai_summary: `[REPAIR/${usedProvider}] ${parsed.summary ?? parsed.diagnosis ?? ""} | proof_matrix=${validation.evidenceFound}/${validation.normalized.length} literal, ${validation.valid ? "OK" : "INVÁLIDA"}`,
  };

  if (canAutoApply) {
    // snapshot + apply
    const { data: audIns } = await supabase.from("question_audits").insert({ ...auditPayload, applied_patch: patch }).select("id").single();
    await supabase.from("question_versions").insert({
      questao_id: questionId,
      snapshot: questao,
      change_reason: "auto_apply_repair",
      audit_id: audIns?.id ?? null,
    } as any);
    await supabase.from("questoes").update(patch).eq("id", questionId);
    await setQuestionAuditStatus(supabase, questionId, Q_STATUS.AUTO_CORRECTED);
    return {
      ok: true, audit_id: audIns?.id ?? null, applied: true, recoverable: true,
      needs_human_review: false, proof_validation: validation,
      summary: `Auto-aplicado (confidence=${confidence}, risk=${riskLevel}, ${validation.evidenceFound}/5 provas literais).`,
      diagnosis, patch, proof_matrix: validation.normalized,
    };
  }

  const { data: audIns } = await supabase.from("question_audits").insert(auditPayload).select("id").single();
  await setQuestionAuditStatus(supabase, questionId, Q_STATUS.MANUAL);
  return {
    ok: true, audit_id: audIns?.id ?? null, applied: false, recoverable: true,
    needs_human_review: true, proof_validation: validation,
    summary: validation.valid
      ? `Patch enviado para revisão humana (confidence=${confidence}, risk=${riskLevel}).`
      : `Proof_matrix inválida — revisão humana obrigatória: ${validation.errors.slice(0, 3).join("; ")}`,
    diagnosis, patch, proof_matrix: validation.normalized,
  };
}

async function processQuestion(
  supabase: ReturnType<typeof createClient>,
  q: Questao,
  legalCache: Map<string, string | null>,
  opts?: { keepPending?: boolean },
): Promise<{ status: string; auto_fixed: boolean; flagged: boolean; deleted: boolean }> {
  // keepPending: aplica correções no conteúdo, mas mantém audit_status='pending'
  // (questão continua na lista de pendentes para publicação/exclusão manual pelo admin).
  const keepPending = opts?.keepPending === true;
  const okStatus = keepPending ? Q_STATUS.PENDING : Q_STATUS.APPROVED;
  const flagStatus = keepPending ? Q_STATUS.PENDING : Q_STATUS.MANUAL;
  const correctedStatus = keepPending ? Q_STATUS.PENDING : Q_STATUS.AUTO_CORRECTED;
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

  // BLOQUEIO OPERACIONAL: sem texto legal cadastrado suficiente, NÃO usar conhecimento geral.
  // Marca a questão como manual_review e devolve sem chamar IA.
  if (!legal || legal.trim().length < 500) {
    await supabase.from("question_audits").insert({
      questao_id: q.id,
      status: "manual_review",
      confidence: 0,
      risk_level: "high",
      issues: [{
        type: "NO_LEGAL_TEXT",
        severity: "high",
        description: "Auditoria bloqueada: não há texto legal oficial suficiente cadastrado em discipline_legal_texts para esta disciplina. PDFs, fontes externas e conhecimento geral do modelo são proibidos como fonte normativa.",
      }],
      ai_summary: "Auditoria não executada por ausência de fonte legal oficial estruturada.",
    });
    await setQuestionAuditStatus(supabase, q.id, Q_STATUS.MANUAL);
    return { status: "manual_review", auto_fixed: false, flagged: true, deleted: false };
  }

  // Reportes de usuários pendentes — sinal forte de defeito real.
  const { data: repsData } = await supabase
    .from("question_reports")
    .select("motivo, status")
    .eq("questao_id", q.id)
    .in("status", ["pendente", "em_analise"])
    .limit(10);
  const userReports: string[] = (repsData ?? []).map((r: any) => String(r.motivo ?? "").trim()).filter(Boolean);
  const hasUserReports = userReports.length > 0;

  let result: AuditResult;
  try {
    result = await auditOne(q, legal, userReports);
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
    await setQuestionAuditStatus(supabase, q.id, Q_STATUS.MANUAL);
    return { status: "error", auto_fixed: false, flagged: false, deleted: false };
  }

  // Endurecimento: qualquer reporte pendente impede aprovação silenciosa e
  // restringe auto_fix a casos com altíssima confiança e baixo risco.
  if (hasUserReports) {
    if (!result.issues.some((i: any) => i?.type === "reporte_usuario")) {
      result.issues.push({
        type: "reporte_usuario",
        severity: "high",
        description: `Questão possui ${userReports.length} reporte(s) de usuário pendente(s) — exige verificação.`,
      });
    }
    if (result.risk_level === "low") result.risk_level = "medium";
    // Se a IA quer mexer no gabarito ou está abaixo de 0.95 → revisão humana.
    const wantsGabaritoChange = result.proposed_patch && typeof (result.proposed_patch as any).gabarito === "number" && (result.proposed_patch as any).gabarito !== q.gabarito;
    if (wantsGabaritoChange || result.confidence < 0.95) {
      result.needs_human_review = true;
    }
  }


  // PRESERVAÇÃO DE DADOS: NUNCA apagar fisicamente em automático.
  // Duplicatas e questões irrecuperáveis recebem audit_status='deleted' (lógico),
  // preservando histórico e respostas dos usuários para auditoria humana posterior.
  const isDuplicate = result.issues.some((i: any) => i?.type === "duplicada");
  const isUnrecoverable = result.issues.some((i: any) => i?.type === "unrecoverable" || i?.type === "incoerente");
  const aiAutoDelete = /^AUTO_DELETE:/i.test(result.ai_summary || "");
  if (aiAutoDelete || isDuplicate || isUnrecoverable) {
    await supabase.from("question_audits").insert({
      questao_id: q.id,
      status: "soft_deleted",
      confidence: result.confidence,
      risk_level: result.risk_level,
      issues: result.issues,
      proposed_patch: null,
      applied_patch: null,
      ai_summary: result.ai_summary || (isDuplicate ? "Duplicata de menor qualidade (status lógico 'deleted', registro preservado)" : "Questão irrecuperável (status lógico 'deleted', registro preservado)"),
    });
    await supabase
      .from("question_audits")
      .update({ status: "superseded" })
      .eq("questao_id", q.id)
      .in("status", OPEN_AUDIT_STATUSES);
    // Soft delete: marca status lógico 'deleted' em vez de remover do banco.
    await setQuestionAuditStatus(supabase, q.id, Q_STATUS.DELETED);
    return { status: "deleted", auto_fixed: false, flagged: false, deleted: true };
  }

  // LENGTH BIAS: tenta reescrever distratores antes de marcar para revisão manual.
  const hasLengthBias = result.issues.some((i: any) => i?.type === "length_bias");
  if (hasLengthBias) {
    const post = {
      alt_a: result.proposed_patch?.alt_a ?? q.alt_a,
      alt_b: result.proposed_patch?.alt_b ?? q.alt_b,
      alt_c: result.proposed_patch?.alt_c ?? q.alt_c,
      alt_d: result.proposed_patch?.alt_d ?? q.alt_d,
      alt_e: result.proposed_patch?.alt_e ?? q.alt_e,
      gabarito: typeof result.proposed_patch?.gabarito === "number" ? result.proposed_patch.gabarito : q.gabarito,
    };
    if (detectLengthBias(post)) {
      const r = await rewriteDistractorsForLengthBias(q, result.proposed_patch, legal);
      if (r.patch) {
        result.proposed_patch = r.patch;
        result.confidence = Math.max(result.confidence, 0.9);
        result.risk_level = "low";
        result.needs_human_review = false;
        result.ai_summary = `${result.ai_summary} | length_bias corrigido: ${r.summary}`.trim();
        result.issues = result.issues.filter((i: any) => i?.type !== "length_bias");
      } else if (r.unrecoverable) {
        result.needs_human_review = true;
        result.ai_summary = `${result.ai_summary} | length_bias IRRECUPERÁVEL: ${r.summary}`.trim();
      } else {
        result.ai_summary = `${result.ai_summary} | rewrite falhou: ${r.summary}`.trim();
      }
    } else {
      result.issues = result.issues.filter((i: any) => i?.type !== "length_bias");
    }
  }

  const hasRealDefect = result.issues.some(
    (i: any) => i?.severity === "medium" || i?.severity === "high",
  );
  // Alucinações jurídicas, questões sem base legal ou sem alternativa correta
  // NUNCA são auto-corrigidas — sempre vão para revisão manual humana.
  const HALLUCINATION_TYPES = new Set([
    "alucinacao_juridica",
    "extra_legal",
    "sem_correta",
    "texto_legal_desatualizado",
    "hierarquia_violada",
    "reporte_usuario",
  ]);
  const hasHallucination = result.issues.some((i: any) => HALLUCINATION_TYPES.has(i?.type));
  if (hasHallucination) {
    result.needs_human_review = true;
  }
  const noIssues = !hasRealDefect && !result.proposed_patch;
  const canAutoFix =
    hasRealDefect &&
    !!result.proposed_patch &&
    result.confidence >= AUTO_FIX_CONFIDENCE &&
    AUTO_FIX_RISK_ALLOWED.includes(result.risk_level) &&
    !result.needs_human_review &&
    !hasHallucination;

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
    await setQuestionAuditStatus(supabase, q.id, Q_STATUS.AUTO_CORRECTED, result.techniques_used);
    return { status: "auto_fixed", auto_fixed: true, flagged: false, deleted: false };
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

  await setQuestionAuditStatus(
    supabase,
    q.id,
    finalStatus === "approved" ? Q_STATUS.APPROVED : Q_STATUS.MANUAL,
    result.techniques_used,
  );

  return {
    status: finalStatus,
    auto_fixed: false,
    flagged: finalStatus === "manual_review",
    deleted: false,
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

    // Ações: start (cria job), run (processa lote), status, cancel, clear_resolved, summary
    if (action === "clear_resolved") {
      // Reseta questões já marcadas como admin_resolved para a fila de auditoria.
      const { error, count } = await supabase
        .from("questoes")
        .update({ audit_status: Q_STATUS.PENDING, audit_status_updated_at: new Date().toISOString() }, { count: "exact" })
        .eq("audit_status", Q_STATUS.ADMIN_RESOLVED);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, reset: count ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "summary") {
      // Resumo do estado atual da fila de auditoria.
      const counts: Record<string, number> = {};
      for (const s of [Q_STATUS.PENDING, Q_STATUS.APPROVED, Q_STATUS.AUTO_CORRECTED, Q_STATUS.MANUAL, Q_STATUS.ADMIN_RESOLVED]) {
        const { count } = await supabase
          .from("questoes")
          .select("id", { count: "exact", head: true })
          .eq("audit_status", s);
        counts[s] = count ?? 0;
      }
      return new Response(JSON.stringify({ counts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // P1.4 — Modo REPAIR dedicado. Body: { action: "repair", question_id: number, skip_audit?: boolean }
    if (action === "repair") {
      const qid = Number(body.question_id);
      if (!Number.isInteger(qid) || qid <= 0) {
        return new Response(JSON.stringify({ error: "question_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await repairQuestion(supabase, qid, { skipAudit: Boolean(body.skip_audit) });
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start") {
      // mode: 'all' | 'discipline' | 'unaudited' | 'reported' | 'selected'
      const mode: "all" | "discipline" | "unaudited" | "reported" | "selected" =
        ["all", "discipline", "unaudited", "reported", "selected"].includes(body.mode) ? body.mode : "all";
      const scope: any = {
        mode,
        disciplinas: Array.isArray(body.disciplinas) ? body.disciplinas : null,
        only_unaudited: mode === "unaudited",
        limit: Math.min(Number(body.limit ?? 200), 100000),
        // keep_pending: audita e CORRIGE o conteúdo, mas mantém audit_status='pending'
        // (não publica nem oculta). Usado pelo fluxo manual da lista de pendentes:
        // o admin revisa e publica/exclui manualmente depois da auditoria.
        keep_pending: body.keep_pending === true,
      };


      if (mode === "selected") {
        // Audita apenas as questões selecionadas (ids enviados pelo admin).
        const ids = Array.isArray(body.question_ids)
          ? body.question_ids.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];
        scope.question_ids = ids;
        scope.limit = Math.min(scope.limit, Math.max(ids.length, 1));
        // Reset em lotes para entrar na fila (vence teto de itens por chamada do .in()).
        const CHUNK = 500;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const slice = ids.slice(i, i + CHUNK);
          await supabase
            .from("questoes")
            .update({ audit_status: Q_STATUS.PENDING, audit_status_updated_at: new Date().toISOString() })
            .in("id", slice)
            .neq("audit_status", Q_STATUS.DELETED);
        }
      } else if (mode === "reported") {
        // Modo "reported": questões com reportes pendentes são forçadas à fila.
        const { data: reps } = await supabase
          .from("question_reports")
          .select("questao_id")
          .eq("status", "pendente")
          .limit(100000);
        const ids = Array.from(new Set((reps ?? []).map((r: any) => r.questao_id))).filter(Boolean);
        scope.question_ids = ids;
        if (ids.length) {
          await supabase
            .from("questoes")
            .update({ audit_status: Q_STATUS.PENDING, audit_status_updated_at: new Date().toISOString() })
            .in("id", ids);
        }
      } else if (mode === "all" || mode === "discipline") {
        // LITERALIDADE DO ESCOPO (pedido do admin):
        // - "Todo o banco" reaudita TODAS as questões (inclusive approved / auto_corrected /
        //   admin_resolved), exceto as logicamente excluídas (deleted).
        // - "Disciplina(s)" reaudita TODAS as questões da(s) disciplina(s) selecionada(s).
        // Reset paginado (UPDATE ... > cursor) para vencer o teto de 1000 linhas por chamada
        // e garantir que o banco inteiro entre na fila, sem amostragem.
        let resetCursor = 0;
        const RESET_PAGE = 1000;
        while (true) {
          let pageSel = supabase
            .from("questoes")
            .select("id")
            .neq("audit_status", Q_STATUS.DELETED)
            .gt("id", resetCursor)
            .order("id", { ascending: true })
            .limit(RESET_PAGE);
          if (scope.disciplinas?.length) pageSel = pageSel.in("disciplina", scope.disciplinas);
          const { data: pageRows, error: pageErr } = await pageSel;
          if (pageErr || !pageRows || pageRows.length === 0) break;
          const pageIds = (pageRows as any[]).map((r) => r.id);
          await supabase
            .from("questoes")
            .update({ audit_status: Q_STATUS.PENDING, audit_status_updated_at: new Date().toISOString() })
            .in("id", pageIds);
          resetCursor = pageIds[pageIds.length - 1];
          if (pageRows.length < RESET_PAGE) break;
        }
      }
      // mode === "unaudited": não altera status; loop filtra por only_unaudited.

      let countQ = supabase
        .from("questoes")
        .select("id", { count: "exact", head: true })
        .eq("audit_status", Q_STATUS.PENDING);
      if (scope.disciplinas?.length) countQ = countQ.in("disciplina", scope.disciplinas);
      if (scope.question_ids?.length) countQ = countQ.in("id", scope.question_ids);
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
        .eq("audit_status", Q_STATUS.PENDING)
        .limit(PAGE_Q);
      if (job.scope?.disciplinas?.length) qBuilder = qBuilder.in("disciplina", job.scope.disciplinas);
      if (job.scope?.question_ids?.length) qBuilder = qBuilder.in("id", job.scope.question_ids);
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
    let processed = 0, autoFixed = 0, flagged = 0, errors = 0, deleted = 0;
    let lastBatchError: string | null = null;

    const keepPending = job.scope?.keep_pending === true;
    for (let i = 0; i < pending.length; i += PROCESS_CONCURRENCY) {
      const chunk = pending.slice(i, i + PROCESS_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((q) => processQuestion(supabase, q as Questao, legalCache, { keepPending })),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const r = result.value;
          processed++;
          if (r.auto_fixed) autoFixed++;
          if (r.flagged) flagged++;
          if (r.deleted) deleted++;
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
      deleted_in_batch: deleted,
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
