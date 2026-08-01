// Disciplinas usadas na geração de questões por IA e no cadastro de textos legais.
// PMTO → Edital nº 001/2026 | CBMTO → Edital nº 1/2026/GABCOM (CHOA BM 2026).

export type DisciplinaFonte = { disciplina: string; lei_nome: string };

export const DISCIPLINAS_FONTE_PMTO: DisciplinaFonte[] = [
  { disciplina: "Lei nº 2.578/2012", lei_nome: "Estatuto dos Policiais Militares e Bombeiros Militares do TO" },
  { disciplina: "LC nº 128/2021", lei_nome: "Organização Básica da PMTO" },
  { disciplina: "Lei nº 2.575/2012", lei_nome: "Promoções na PMTO" },
  { disciplina: "CPPM", lei_nome: "Código de Processo Penal Militar (Arts. 8-28 e 243-253)" },
  { disciplina: "RDMETO", lei_nome: "Regulamento Disciplinar Militar do TO (Decreto 4.994/2014)" },
  { disciplina: "Língua Portuguesa", lei_nome: "Língua Portuguesa — Interpretação e Compreensão de Texto" },
  { disciplina: "Redação Oficial", lei_nome: "Manual de Redação Oficial da PMTO (itens 6.1 a 6.8)" },
  { disciplina: "POP", lei_nome: "Procedimento Operacional Padrão (POP) — Conteúdo Sigiloso (Restrito)" },
];

export const DISCIPLINAS_FONTE_CBMTO: DisciplinaFonte[] = [
  { disciplina: "Direito Penal Militar e Processual Penal Militar", lei_nome: "CPM e CPPM — recortes do Anexo III do Edital nº 1/2026/GABCOM" },
  { disciplina: "Redação Oficial", lei_nome: "Manual de Redação Oficial aplicável ao CBMTO" },
  { disciplina: "Combate a Incêndio Urbano", lei_nome: "Manual de Combate a Incêndio Urbano do CBMTO" },
  { disciplina: "NPCE", lei_nome: "Normas de Procedimentos Contra Emergências (NPCE) do CBMTO" },
  { disciplina: "Sistema de Comando de Incidentes", lei_nome: "Manual de Sistema de Comando de Incidentes (SCI)" },
  { disciplina: "Atendimento Pré-Hospitalar", lei_nome: "Manual de APH do CBMTO (retificação — Edital nº 7/2026/DEP)" },
  { disciplina: "Salvamento em Altura", lei_nome: "Manual de Salvamento em Altura do CBMTO" },
  { disciplina: "Salvamento Aquático", lei_nome: "Manual de Salvamento Aquático do CBMTO" },
  { disciplina: "Salvamento Terrestre", lei_nome: "Manual de Salvamento Terrestre / Veicular do CBMTO" },
  { disciplina: "Legislação Específica", lei_nome: "Legislação específica do CBMTO (organização, estatuto, disciplina e promoções)" },
];

export function getDisciplinasFonte(cursoSlug?: string | null): DisciplinaFonte[] {
  return (cursoSlug || "pmto").toLowerCase() === "cbmto" ? DISCIPLINAS_FONTE_CBMTO : DISCIPLINAS_FONTE_PMTO;
}

export function getDisciplinasGeracao(cursoSlug?: string | null): string[] {
  return getDisciplinasFonte(cursoSlug).map((d) => d.disciplina);
}
