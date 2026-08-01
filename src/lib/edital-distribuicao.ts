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
  { nome: "Direito Penal Militar e Processual Penal Militar", questoes: 4 },
  { nome: "Redação Oficial", questoes: 3 },
  { nome: "Combate a Incêndio Urbano", questoes: 5 },
  { nome: "NPCE", questoes: 5 },
  { nome: "Sistema de Comando de Incidentes", questoes: 5 },
  { nome: "Atendimento Pré-Hospitalar", questoes: 5 },
  { nome: "Salvamento em Altura", questoes: 5 },
  { nome: "Salvamento Aquático", questoes: 5 },
  { nome: "Salvamento Terrestre", questoes: 5 },
  { nome: "Legislação Específica", questoes: 8 },
];

const CBMTO_ALIASES: Record<string, string> = {
  "direito penal militar": "Direito Penal Militar e Processual Penal Militar",
  "direito processual penal militar": "Direito Penal Militar e Processual Penal Militar",
  "direito penal militar e processual penal militar":
    "Direito Penal Militar e Processual Penal Militar",
  "penal militar": "Direito Penal Militar e Processual Penal Militar",
  cpm: "Direito Penal Militar e Processual Penal Militar",
  cppm: "Direito Penal Militar e Processual Penal Militar",
  "nocoes de direito": "Direito Penal Militar e Processual Penal Militar",
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
  "legislacao especifica": "Legislação Específica",
  "legislação específica": "Legislação Específica",
  "lei 2.578/2012": "Legislação Específica",
  "lei 2.665/2012": "Legislação Específica",
  "lc 131/2021": "Legislação Específica",
  "lei 3.798/2021": "Legislação Específica",
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
