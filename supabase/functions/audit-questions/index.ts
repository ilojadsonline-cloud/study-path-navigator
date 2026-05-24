import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

function stripThinkTags(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

/** DeepSeek — DIAGNÓSTICO ESTRUTURADO (sem patch). Identifica defeitos e indica campo/evidência/sugestão. */
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
              "Você é AUDITOR-DIAGNOSTICADOR de questões objetivas para concursos militares (PMTO, CFO/CHOA) e jurídicos (FGV/CESPE/VUNESP). Sua FUNÇÃO ÚNICA é DIAGNOSTICAR defeitos — NÃO REESCREVA conteúdo. A reescrita será feita por outra IA jurídica especializada. Leia enunciado, A–E, gabarito e comentário INTEGRALMENTE e confronte com o TEXTO LEGAL DE REFERÊNCIA. Detecte SEM AMOSTRAGEM: (a) questões repetidas/duplicadas que abordam exatamente o mesmo assunto/dispositivo; (b) DUAS OU MAIS alternativas corretas à luz da lei; (c) NENHUMA alternativa correta (gabarito aponta errada e nenhuma outra serve); (d) ALUCINAÇÃO JURÍDICA — artigo/inciso/§ inexistente, fundamento inventado, dispositivo revogado; (e) violação de hierarquia funcional (posto/graduação/competência incompatível); (f) função incompatível com o posto citado; (g) gabarito visualmente identificável (única longa/curta/técnica/com ressalva); (h) padrão antiético length_bias (correta é a mais longa OU mais curta — único caso); (i) distratores fracos/óbvios/absurdos; (j) DISTRATORES LONGOS DEMAIS (algum distrator com mais de 1.7× o tamanho médio dos demais — type='distrator_longo'); (k) comentário ausente, em loop, ou que não analisa cada alternativa errada individualmente; (l) enunciado/alternativas/comentário desalinhados; (m) texto legal desatualizado/revogado; (n) bug estrutural (alt vazia, duplicada, formatação corrompida); (o) duas técnicas de distração insuficientes (<2 — insufficient_distractors). Para CADA issue obrigatoriamente preencha: type, severity, field ('enunciado'|'alt_a'|'alt_b'|'alt_c'|'alt_d'|'alt_e'|'gabarito'|'comentario'|'questao_inteira'), evidence (trecho EXATO do conteúdo problemático em ≤200 chars) e suggestion (instrução curta e ACIONÁVEL para a IA reescritora: 'reescrever distrator B mais curto preservando erro de prazo', 'corrigir gabarito para C porque art. 12 prevê...', 'remover citação de Art. 999 inexistente', 'reescrever comentário no estilo professor 4 movimentos'). Em duplicata e em irrecuperável, defina needs_human_review=false e indique no ai_summary 'AUTO_DELETE: <motivo>'. NUNCA emita proposed_patch — sempre null. NÃO reescreva nada. Sua saída é apenas DIAGNÓSTICO. Responda APENAS JSON válido.",
          },
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

/** Maritaca Sabiá 4 — REESCRITOR jurídico. Recebe questão + diagnóstico do DeepSeek + lei e devolve patch. */
async function callMaritaca(prompt: string, timeoutMs = 70000): Promise<string> {
  if (!MARITACA_API_KEY) throw new Error("MARITACA_API_KEY não configurada");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://chat.maritaca.ai/api/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MARITACA_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sabia-4",
        messages: [
          {
            role: "system",
            content:
              "Você é PROFESSOR-REESCRITOR JURÍDICO de altíssimo nível especializado em concursos militares (PMTO, CFO/CHOA) e bancas CESPE/CEBRASPE/FGV/VUNESP. Recebe uma QUESTÃO defeituosa, o DIAGNÓSTICO formal de outro auditor (IA) e o TEXTO LEGAL DE REFERÊNCIA. Sua missão é CORRIGIR a questão exigindo o MÁXIMO de conhecimento e interpretação jurídica — não invente nada fora do texto legal. Regras: (1) corrija TODOS os defeitos listados pelo diagnóstico; (2) preserve a essência didática quando possível; (3) ANTI-LENGTH-BIAS: a alternativa correta NUNCA pode ser a única mais longa nem a única mais curta — paridade ±25%; (4) DISTRATORES LONGOS DEMAIS devem ser ENCURTADOS preservando o erro típico (troca de prazo/autoridade/conectivo) e a plausibilidade; (5) cada distrator usa uma técnica DIFERENTE de erro (≥2 técnicas no conjunto); (6) gabarito 0–4; (7) COMENTÁRIO no estilo professor orientador em 4 movimentos OBRIGATÓRIOS — (i) 'A alternativa correta é a [X], pois...' + citação literal e curta do dispositivo; (ii) 'A pegadinha desta questão está em...' nomeando a técnica; (iii) análise INDIVIDUAL de cada alternativa errada no formato 'Alternativa [Y]: incorreta porque ... Vide [art. Z]'; (iv) 'Lembre-se: segundo o [art. X da Lei Y], [regra geral]'; (8) 600–1500 caracteres no comentário; (9) RESPEITE a hierarquia militar e atribua competências exatamente como a lei fixa; (10) se citar lei DIFERENTE da lei principal, mencione o diploma por extenso (ex.: 'art. 9º do CPM', 'art. 5º, LV, da CF'); (11) se a questão for IRRECUPERÁVEL juridicamente (sem alternativa correta possível à luz da lei, sem base legal etc.), devolva unrecoverable=true. Responda APENAS JSON válido com o patch.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        top_p: 0.92,
        max_tokens: 4500,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Maritaca HTTP ${res.status}`);
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
O. COMENTARIO_INCOMPLETO — não analisa cada alternativa errada individualmente, falta um dos 4 movimentos (confirmação+citação / pegadinha / análise alt-a-alt / lembrete). type='comentario_incompleto'.
P. DESALINHAMENTO — comentário cita correta diferente do gabarito, ou enunciado pergunta X e alternativas respondem Y. type='desalinhamento'.
Q. TEXTO_LEGAL_DESATUALIZADO — questão baseada em dispositivo revogado/alterado/substituído. type='texto_legal_desatualizado'.
R. INCOERENTE — premissa contraditória, situação juridicamente inviável. type='incoerente' (irrecuperável).

REGRA INTERPRETATIVA: paráfrase, interpretação e combinação de dispositivos SÃO VÁLIDAS — só marque alucinação quando a afirmação CONTRARIAR a lei ou inventar requisito/prazo/autoridade.
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

/** Reescritor Maritaca: recebe questão + diagnóstico + lei e devolve patch jurídico de alta qualidade. */
async function rewriteWithMaritaca(
  q: Questao,
  diagnosis: { issues: any[]; ai_summary: string },
  legalText: string | null,
): Promise<{ patch: any | null; unrecoverable: boolean; summary: string }> {
  const alts = ["A","B","C","D","E"].map((l) => `${l}) ${(q as any)[`alt_${l.toLowerCase()}`]}`).join("\n");
  const correctaLetra = ["A","B","C","D","E"][q.gabarito] ?? "?";
  const legalBlock = legalText
    ? `TEXTO LEGAL DE REFERÊNCIA (ÚNICA fonte de verdade):\n"""${legalText.slice(0, 10000)}"""\n`
    : "ATENÇÃO: sem texto legal disponível. Use o conhecimento jurídico geral com cautela.\n";

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
  try {
    raw = await callMaritaca(prompt);
  } catch (e) {
    return { patch: null, unrecoverable: false, summary: `Falha Maritaca: ${e instanceof Error ? e.message : e}` };
  }
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return { patch: null, unrecoverable: false, summary: "Maritaca retornou JSON inválido" };
  }
  if (parsed.unrecoverable === true) {
    return { patch: null, unrecoverable: true, summary: String(parsed.summary ?? "Maritaca classificou como irrecuperável") };
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
  return { patch, unrecoverable: false, summary: String(parsed.summary ?? "Patch gerado pela Maritaca") };
}

async function auditOne(q: Questao, legalText: string | null, userReports: string[] = []): Promise<AuditResult> {
  const reportsBlock = userReports.length
    ? `\n\nREPORTES DE USUÁRIOS SOBRE ESTA QUESTÃO (ALERTA OBRIGATÓRIO — confronte cada alegação com o texto legal):\n${userReports.map((m, i) => `[Reporte ${i + 1}] ${m}`).join("\n")}\nSe um reporte apontar gabarito errado/conteúdo invertido E o texto legal confirmar, registre issue com type='reporte_usuario', field=campo afetado, evidence=trecho, suggestion=correção necessária.\n`
    : "";

  // ── ETAPA 1: DeepSeek DIAGNOSTICA defeitos com field/evidence/suggestion. ──
  const raw = await callDeepSeek(buildAuditPrompt(q, legalText) + reportsBlock);
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
  const issues: any[] = Array.isArray(parsed.issues) ? parsed.issues : [];
  const aiSummary = String(parsed.ai_summary ?? "");

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

  // ── ETAPA 2: se há defeitos reais, Maritaca REESCREVE. ──
  let patch: any = null;
  let techniques: string[] = [];
  let rewriteSummary = "";
  const isAutoDelete = /^AUTO_DELETE:/i.test(aiSummary);
  const hasIrrecoverable = issues.some((i: any) => i?.type === "incoerente" || i?.type === "duplicada" || i?.type === "unrecoverable");
  const hasRealDefect = issues.some((i: any) => i?.severity === "medium" || i?.severity === "high");

  if (hasRealDefect && !isAutoDelete && !hasIrrecoverable && MARITACA_API_KEY) {
    const r = await rewriteWithMaritaca(q, { issues, ai_summary: aiSummary }, legalText);
    rewriteSummary = r.summary;
    if (r.unrecoverable) {
      issues.push({
        type: "unrecoverable",
        severity: "high",
        field: "questao_inteira",
        description: "Maritaca classificou a questão como irrecuperável após análise jurídica.",
        suggestion: "Exclusão recomendada.",
      });
    } else if (r.patch) {
      techniques = (r.patch.__techniques as string[]) ?? [];
      delete r.patch.__techniques;
      patch = r.patch;
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
        description: "Após reescrita da Maritaca o length_bias persistiu.",
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
    ai_summary: [aiSummary, rewriteSummary && `Reescrita (Maritaca): ${rewriteSummary}`].filter(Boolean).join(" | "),
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
  try { raw = await callDeepSeek(prompt, 45000); } catch (e) {
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

async function processQuestion(
  supabase: ReturnType<typeof createClient>,
  q: Questao,
  legalCache: Map<string, string | null>,
): Promise<{ status: string; auto_fixed: boolean; flagged: boolean; deleted: boolean }> {
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


  // AUTO-DELETE: duplicada ou irrecuperável.
  const isDuplicate = result.issues.some((i: any) => i?.type === "duplicada");
  const isUnrecoverable = result.issues.some((i: any) => i?.type === "unrecoverable" || i?.type === "incoerente");
  const aiAutoDelete = /^AUTO_DELETE:/i.test(result.ai_summary || "");
  if (aiAutoDelete || isDuplicate || isUnrecoverable) {
    await supabase.from("question_audits").insert({
      questao_id: q.id,
      status: "auto_deleted",
      confidence: result.confidence,
      risk_level: result.risk_level,
      issues: result.issues,
      proposed_patch: null,
      applied_patch: null,
      ai_summary: result.ai_summary || (isDuplicate ? "Duplicata de menor qualidade" : "Questão irrecuperável"),
    });
    await supabase
      .from("question_audits")
      .update({ status: "superseded" })
      .eq("questao_id", q.id)
      .in("status", OPEN_AUDIT_STATUSES);
    await supabase.from("questoes").delete().eq("id", q.id);
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

    if (action === "start") {
      // mode: 'all' | 'discipline' | 'unaudited' | 'reported'
      const mode: "all" | "discipline" | "unaudited" | "reported" =
        ["all", "discipline", "unaudited", "reported"].includes(body.mode) ? body.mode : "all";
      const scope: any = {
        mode,
        disciplinas: Array.isArray(body.disciplinas) ? body.disciplinas : null,
        only_unaudited: mode === "unaudited",
        limit: Math.min(Number(body.limit ?? 200), 100000),
      };

      if (mode === "reported") {
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
        // RESET TOTAL do escopo: em nova auditoria ampla, TODA questão existente volta para 'pending'.
        // O bug dos "300 e poucas" ocorria porque manual_review/error ficavam fora da contagem.
        let resetQ = supabase
          .from("questoes")
          .update({ audit_status: Q_STATUS.PENDING, audit_status_updated_at: new Date().toISOString() })
          .neq("audit_status", Q_STATUS.DELETED);
        if (scope.disciplinas?.length) resetQ = resetQ.in("disciplina", scope.disciplinas);
        await resetQ;
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
