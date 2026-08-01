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
  { disciplina: "CPM — Código Penal Militar", lei_nome: "Decreto-Lei nº 1.001/1969 — recortes do Anexo III do Edital nº 1/2026/GABCOM" },
  { disciplina: "CPPM — Código de Processo Penal Militar", lei_nome: "Decreto-Lei nº 1.002/1969 — recortes do Anexo III do Edital nº 1/2026/GABCOM" },
  { disciplina: "Redação Oficial", lei_nome: "Manual de Redação Oficial aplicável ao CBMTO" },
  { disciplina: "Combate a Incêndio Urbano", lei_nome: "Manual de Combate a Incêndio Urbano do CBMTO" },
  { disciplina: "NPCE", lei_nome: "Normas de Procedimentos Contra Emergências (NPCE) do CBMTO" },
  { disciplina: "Sistema de Comando de Incidentes", lei_nome: "Manual de Sistema de Comando de Incidentes (SCI)" },
  { disciplina: "Atendimento Pré-Hospitalar", lei_nome: "Manual de APH do CBMTO (retificação — Edital nº 7/2026/DEP)" },
  { disciplina: "Salvamento em Altura", lei_nome: "Manual de Salvamento em Altura do CBMTO" },
  { disciplina: "Salvamento Aquático", lei_nome: "Manual de Salvamento Aquático do CBMTO" },
  { disciplina: "Salvamento Terrestre", lei_nome: "Manual de Salvamento Terrestre / Veicular do CBMTO" },
  { disciplina: "Lei nº 2.578/2012 — Estatuto dos Militares do TO", lei_nome: "Lei nº 2.578/2012 — Estatuto dos Militares Estaduais do Tocantins" },
  { disciplina: "LC nº 131/2021 — Organização Básica do CBMTO", lei_nome: "Lei Complementar nº 131/2021 — Organização Básica do CBMTO" },
  { disciplina: "Lei nº 2.665/2012 — Promoções no CBMTO", lei_nome: "Lei nº 2.665/2012 — Promoções de praças do CBMTO" },
  { disciplina: "Lei nº 3.798/2021 — Segurança Contra Incêndio", lei_nome: "Lei nº 3.798/2021 — Código de Segurança Contra Incêndio e Emergência do TO" },
];

export function getDisciplinasFonte(cursoSlug?: string | null): DisciplinaFonte[] {
  return (cursoSlug || "pmto").toLowerCase() === "cbmto" ? DISCIPLINAS_FONTE_CBMTO : DISCIPLINAS_FONTE_PMTO;
}

export function getDisciplinasGeracao(cursoSlug?: string | null): string[] {
  return getDisciplinasFonte(cursoSlug).map((d) => d.disciplina);
}
