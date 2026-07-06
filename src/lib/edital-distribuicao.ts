// Distribuição oficial do Conteúdo Programático — Anexo II, Edital nº 001/2026.
// Total: 50 questões × 2,0 pontos = 100 pontos.

export interface DisciplinaEdital {
  nome: string;
  questoes: number;
}

export const EDITAL_DISTRIBUICAO: DisciplinaEdital[] = [
  { nome: "Lei nº 2.578/2012", questoes: 9 },
  { nome: "Lei nº 2.575/2012", questoes: 8 },
  { nome: "LC nº 128/2021", questoes: 5 },
  { nome: "CPPM", questoes: 6 },
  { nome: "RDMETO", questoes: 5 },
  { nome: "POP", questoes: 7 },
  { nome: "Língua Portuguesa", questoes: 5 },
  { nome: "Redação Oficial", questoes: 5 },
];

export const TOTAL_QUESTOES_SIMULADO = EDITAL_DISTRIBUICAO.reduce((s, d) => s + d.questoes, 0); // 50
export const VALOR_QUESTAO = 2.0;
export const PONTUACAO_TOTAL = TOTAL_QUESTOES_SIMULADO * VALOR_QUESTAO; // 100
export const NOTA_MINIMA_APROVACAO = 60; // 60,0 pontos
export const VAGAS_CLASSIFICACAO = 100; // Edital nº 003/2026 — ampliação de 50 → 100 vagas
export const DURACAO_PADRAO_MINUTOS = 240; // 4 horas

// Disciplinas aceitas no banco de questões (inclui POP).
export const DISCIPLINAS_BANCO = [
  "Lei nº 2.578/2012",
  "Lei nº 2.575/2012",
  "LC nº 128/2021",
  "CPPM",
  "RDMETO",
  "POP",
  "Língua Portuguesa",
  "Redação Oficial",
];

// Normaliza nomes de disciplina equivalentes para o padrão do banco.
const ALIASES: Record<string, string> = {
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
  "cppm": "CPPM",
  "rdmeto": "RDMETO",
  "pop": "POP",
  "lingua portuguesa": "Língua Portuguesa",
  "língua portuguesa": "Língua Portuguesa",
  "portugues": "Língua Portuguesa",
  "português": "Língua Portuguesa",
  "redacao oficial": "Redação Oficial",
  "redação oficial": "Redação Oficial",
};

export function normalizarDisciplina(raw: string): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  // Exato (case-sensitive já no padrão)
  if (DISCIPLINAS_BANCO.includes(t)) return t;
  const key = t.toLowerCase().replace(/\s+/g, " ").trim();
  if (ALIASES[key]) return ALIASES[key];
  // Tenta casar por inclusão (ex.: "Lei nº 2.578/2012 e alterações")
  for (const d of DISCIPLINAS_BANCO) {
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
