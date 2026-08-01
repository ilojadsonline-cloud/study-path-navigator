// Distribuição oficial do Conteúdo Programático por curso.
// PMTO  → Anexo II, Edital nº 001/2026 (retificado pelo Edital nº 003/2026).
// CBMTO → Item 9.2 e Anexo III, Edital nº 1/2026/GABCOM (CHOA BM 2026).

export interface DisciplinaEdital {
  nome: string;
  questoes: number;
}

export interface EditalConfig {
  distribuicao: DisciplinaEdital[];
  disciplinasBanco: string[];
  aliases: Record<string, string>;
  valorQuestao: number;
  notaMinimaAprovacao: number;
  vagas: number;
  duracaoMinutos: number;
  /** Quantidade de alternativas da prova oficial (PMTO = 5 / CBMTO = 4). */
  alternativas: 4 | 5;
}

/* ─────────────────────────── PMTO ─────────────────────────── */

const PMTO_DISTRIBUICAO: DisciplinaEdital[] = [
  { nome: "Lei nº 2.578/2012", questoes: 9 },
  { nome: "Lei nº 2.575/2012", questoes: 8 },
  { nome: "LC nº 128/2021", questoes: 5 },
  { nome: "CPPM", questoes: 6 },
  { nome: "RDMETO", questoes: 5 },
  { nome: "POP", questoes: 7 },
  { nome: "Língua Portuguesa", questoes: 5 },
  { nome: "Redação Oficial", questoes: 5 },
];

const PMTO_ALIASES: Record<string, string> = {
  "lei 2.578/2012": "Lei nº 2.578/2012",
  "lei nº 2.578/2012": "Lei nº 2.578/2012",
  "lei n 2.578/2012": "Lei nº 2.578/2012",
  "lei 2578": "Lei nº 2.578/2012",
  "lei 2.575/2012": "Lei nº 2.575/2012",
  "lei nº 2.575/2012": "Lei nº 2.575/2012",
  "lei n 2.575/2012": "Lei nº 2.575/2012",
  "lei 2575": "Lei nº 2.575/2012",
  "lc 128/2021": "LC nº 128/2021",
  "lc nº 128/2021": "LC nº 128/2021",
  "lei complementar 128/2021": "LC nº 128/2021",
  "lei complementar nº 128/2021": "LC nº 128/2021",
  cppm: "CPPM",
  rdmeto: "RDMETO",
  pop: "POP",
  "lingua portuguesa": "Língua Portuguesa",
  "língua portuguesa": "Língua Portuguesa",
  portugues: "Língua Portuguesa",
  português: "Língua Portuguesa",
  "redacao oficial": "Redação Oficial",
  "redação oficial": "Redação Oficial",
};

export const EDITAL_CONFIG_PMTO: EditalConfig = {
  distribuicao: PMTO_DISTRIBUICAO,
  disciplinasBanco: PMTO_DISTRIBUICAO.map((d) => d.nome),
  aliases: PMTO_ALIASES,
  valorQuestao: 2.0,
  notaMinimaAprovacao: 60,
  vagas: 100, // Edital nº 003/2026 — ampliação de 50 → 100 vagas
  duracaoMinutos: 240,
  alternativas: 5,
};

/* ─────────────────────────── CBMTO ────────────────────────── */

const CBMTO_DISTRIBUICAO: DisciplinaEdital[] = [
  { nome: "CPM — Código Penal Militar", questoes: 2 },
  { nome: "CPPM — Código de Processo Penal Militar", questoes: 2 },
  { nome: "Redação Oficial", questoes: 3 },
  { nome: "Combate a Incêndio Urbano", questoes: 5 },
  { nome: "NPCE", questoes: 5 },
  { nome: "Sistema de Comando de Incidentes", questoes: 5 },
  { nome: "Atendimento Pré-Hospitalar", questoes: 5 },
  { nome: "Salvamento em Altura", questoes: 5 },
  { nome: "Salvamento Aquático", questoes: 5 },
  { nome: "Salvamento Terrestre", questoes: 5 },
  { nome: "Lei nº 2.578/2012 — Estatuto dos Militares do TO", questoes: 2 },
  { nome: "LC nº 131/2021 — Organização Básica do CBMTO", questoes: 2 },
  { nome: "Lei nº 2.665/2012 — Promoções no CBMTO", questoes: 2 },
  { nome: "Lei nº 3.798/2021 — Segurança Contra Incêndio", questoes: 2 },
];

const CBMTO_ALIASES: Record<string, string> = {
  cpm: "CPM — Código Penal Militar",
  "codigo penal militar": "CPM — Código Penal Militar",
  "código penal militar": "CPM — Código Penal Militar",
  "direito penal militar": "CPM — Código Penal Militar",
  "penal militar": "CPM — Código Penal Militar",
  "dl 1.001/1969": "CPM — Código Penal Militar",
  cppm: "CPPM — Código de Processo Penal Militar",
  "codigo de processo penal militar": "CPPM — Código de Processo Penal Militar",
  "código de processo penal militar": "CPPM — Código de Processo Penal Militar",
  "direito processual penal militar": "CPPM — Código de Processo Penal Militar",
  "processual penal militar": "CPPM — Código de Processo Penal Militar",
  "dl 1.002/1969": "CPPM — Código de Processo Penal Militar",
  "redacao oficial": "Redação Oficial",
  "redação oficial": "Redação Oficial",
  "combate a incendio urbano": "Combate a Incêndio Urbano",
  "combate a incêndio urbano": "Combate a Incêndio Urbano",
  "combate a incendio": "Combate a Incêndio Urbano",
  incendio: "Combate a Incêndio Urbano",
  npce: "NPCE",
  "normas para o planejamento e conduta do ensino": "NPCE",
  "planejamento e conduta do ensino": "NPCE",
  sci: "Sistema de Comando de Incidentes",
  "sistema de comando de incidentes": "Sistema de Comando de Incidentes",
  aph: "Atendimento Pré-Hospitalar",
  "atendimento pre-hospitalar": "Atendimento Pré-Hospitalar",
  "atendimento pré-hospitalar": "Atendimento Pré-Hospitalar",
  "atendimento pre hospitalar": "Atendimento Pré-Hospitalar",
  "salvamento em altura": "Salvamento em Altura",
  "salvamento altura": "Salvamento em Altura",
  "salvamento aquatico": "Salvamento Aquático",
  "salvamento aquático": "Salvamento Aquático",
  "guarda vidas": "Salvamento Aquático",
  "salvamento terrestre": "Salvamento Terrestre",
  "lei 2.578/2012": "Lei nº 2.578/2012 — Estatuto dos Militares do TO",
  "lei nº 2.578/2012": "Lei nº 2.578/2012 — Estatuto dos Militares do TO",
  "lei 2578": "Lei nº 2.578/2012 — Estatuto dos Militares do TO",
  estatuto: "Lei nº 2.578/2012 — Estatuto dos Militares do TO",
  "lc 131/2021": "LC nº 131/2021 — Organização Básica do CBMTO",
  "lc nº 131/2021": "LC nº 131/2021 — Organização Básica do CBMTO",
  "lei complementar 131/2021": "LC nº 131/2021 — Organização Básica do CBMTO",
  "organizacao basica": "LC nº 131/2021 — Organização Básica do CBMTO",
  "organização básica": "LC nº 131/2021 — Organização Básica do CBMTO",
  "lei 2.665/2012": "Lei nº 2.665/2012 — Promoções no CBMTO",
  "lei nº 2.665/2012": "Lei nº 2.665/2012 — Promoções no CBMTO",
  "lei 2665": "Lei nº 2.665/2012 — Promoções no CBMTO",
  promocoes: "Lei nº 2.665/2012 — Promoções no CBMTO",
  promoções: "Lei nº 2.665/2012 — Promoções no CBMTO",
  "lei 3.798/2021": "Lei nº 3.798/2021 — Segurança Contra Incêndio",
  "lei nº 3.798/2021": "Lei nº 3.798/2021 — Segurança Contra Incêndio",
  "lei 3798": "Lei nº 3.798/2021 — Segurança Contra Incêndio",
  "codigo de seguranca contra incendio e emergencia": "Lei nº 3.798/2021 — Segurança Contra Incêndio",
  "código de segurança contra incêndio e emergência": "Lei nº 3.798/2021 — Segurança Contra Incêndio",
  coscie: "Lei nº 3.798/2021 — Segurança Contra Incêndio",

};

export const EDITAL_CONFIG_CBMTO: EditalConfig = {
  distribuicao: CBMTO_DISTRIBUICAO,
  disciplinasBanco: CBMTO_DISTRIBUICAO.map((d) => d.nome),
  aliases: CBMTO_ALIASES,
  valorQuestao: 2.0,
  notaMinimaAprovacao: 50, // item 9.7 — eliminado abaixo de 50% dos 100 pontos
  vagas: 15, // item 1.1
  duracaoMinutos: 240, // item 9.3 — 8h às 12h
  alternativas: 4, // item 9.1 — alternativas a, b, c, d
};

/* ───────────────────────── Seletores ──────────────────────── */

export const EDITAL_CONFIGS: Record<string, EditalConfig> = {
  pmto: EDITAL_CONFIG_PMTO,
  cbmto: EDITAL_CONFIG_CBMTO,
};

export function getEditalConfig(cursoSlug?: string | null): EditalConfig {
  return EDITAL_CONFIGS[(cursoSlug || "pmto").toLowerCase()] ?? EDITAL_CONFIG_PMTO;
}

export const getDistribuicao = (slug?: string | null) => getEditalConfig(slug).distribuicao;
export const getDisciplinasBanco = (slug?: string | null) => getEditalConfig(slug).disciplinasBanco;
export const getTotalQuestoes = (slug?: string | null) =>
  getEditalConfig(slug).distribuicao.reduce((s, d) => s + d.questoes, 0);
export const getPontuacaoTotal = (slug?: string | null) =>
  getTotalQuestoes(slug) * getEditalConfig(slug).valorQuestao;
export const getNotaMinima = (slug?: string | null) => getEditalConfig(slug).notaMinimaAprovacao;
export const getVagas = (slug?: string | null) => getEditalConfig(slug).vagas;
export const getDuracaoMinutos = (slug?: string | null) => getEditalConfig(slug).duracaoMinutos;
export const getQtdAlternativas = (slug?: string | null) => getEditalConfig(slug).alternativas;

// Normaliza nomes de disciplina equivalentes para o padrão do banco do curso.
export function normalizarDisciplina(raw: string, cursoSlug?: string | null): string | null {
  const cfg = getEditalConfig(cursoSlug);
  const t = (raw || "").trim();
  if (!t) return null;
  if (cfg.disciplinasBanco.includes(t)) return t;
  const key = t.toLowerCase().replace(/\s+/g, " ").trim();
  if (cfg.aliases[key]) return cfg.aliases[key];
  for (const d of cfg.disciplinasBanco) {
    if (key.includes(d.toLowerCase())) return d;
  }
  return null;
}

export const situacaoLabel = (s: string) =>
  s === "classificado"
    ? "Classificado"
    : s === "aprovado_nao_classificado"
    ? "Aprovado (não classificado)"
    : "Reprovado";

/* ── Compatibilidade (padrão PMTO) ── */
export const EDITAL_DISTRIBUICAO = PMTO_DISTRIBUICAO;
export const TOTAL_QUESTOES_SIMULADO = getTotalQuestoes("pmto"); // 50
export const VALOR_QUESTAO = EDITAL_CONFIG_PMTO.valorQuestao;
export const PONTUACAO_TOTAL = getPontuacaoTotal("pmto"); // 100
export const NOTA_MINIMA_APROVACAO = EDITAL_CONFIG_PMTO.notaMinimaAprovacao;
export const VAGAS_CLASSIFICACAO = EDITAL_CONFIG_PMTO.vagas;
export const DURACAO_PADRAO_MINUTOS = EDITAL_CONFIG_PMTO.duracaoMinutos;
export const DISCIPLINAS_BANCO = EDITAL_CONFIG_PMTO.disciplinasBanco;
