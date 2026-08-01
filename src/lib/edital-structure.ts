// Estrutura compartilhada (lite) do Edital Verticalizado — usada por
// Edital, Mapas Mentais e Painel Admin. Mantenha em sincronia com src/pages/Edital.tsx.
import { disciplinasCbmto } from "./edital-verticalizado-cbmto";

export type DisciplinaLite = {
  id: string;
  title: string;
  subtitle: string;
  topics: string[];
  comingSoon?: boolean;
  restricted?: boolean;
};

export const disciplinasLite: DisciplinaLite[] = [
  {
    id: "estatuto",
    title: "Estatuto dos Militares Estaduais do TO",
    subtitle: "Lei nº 2.578/2012",
    topics: [
      "Parte geral e ingresso",
      "Hierarquia e disciplina",
      "Obrigações dos militares",
      "Disciplina e transgressões",
      "Processos administrativos disciplinares",
      "Direitos e remuneração",
      "Situações funcionais e prerrogativas",
    ],
  },
  {
    id: "promocoes",
    title: "Lei de Promoções da PMTO",
    subtitle: "Lei nº 2.575/2012",
    topics: [
      "Disposições iniciais",
      "Comissões de promoção",
      "Critérios de promoção",
      "Quadros de acesso",
      "Avaliação profissional e moral",
      "Recursos, cursos e CHOA",
    ],
  },
  {
    id: "organizacao",
    title: "Organização Básica da PMTO",
    subtitle: "Lei Complementar nº 128/2021",
    topics: [
      "Disposições gerais",
      "Estrutura geral",
      "Unidades de direção",
      "Unidades de apoio",
      "Execução, efetivo e disposições finais",
    ],
  },
  {
    id: "cppm",
    title: "CPPM — PJM, IPM e APF",
    subtitle: "Decreto-Lei nº 1.002/1969",
    topics: [
      "IPM — arts. 8º a 28",
      "APF — arts. 243 a 253",
    ],
  },
  {
    id: "rdmeto",
    title: "Regulamento Disciplinar (RDMETO)",
    subtitle: "Decreto nº 4.994/2014",
    topics: [
      "Parte geral e deontologia",
      "Sindicância",
      "Sindicância e recursos",
    ],
  },
  {
    id: "pop",
    title: "POP — Uso Seletivo da Força e Abordagens Policiais",
    subtitle: "Procedimento Operacional Padrão • Documento sigiloso",
    restricted: true,
    topics: [
      "Módulo I — Processo 108",
      "Módulo II — Processos 201 a 214",
    ],
  },
  {
    id: "portugues",
    title: "Língua Portuguesa",
    subtitle: "Interpretação e compreensão de texto",
    comingSoon: true,
    topics: [
      "Interpretação de texto",
    ],
  },
  {
    id: "redacao",
    title: "Manual de Redação Oficial da PMTO",
    subtitle: "Itens 6.1 a 6.8",
    comingSoon: true,
    topics: [
      "6.1 — Atos de correspondência",
      "6.2 — Atos normativos",
      "6.3 — Atos ordinatórios",
      "6.4 — Atos enunciativos",
      "6.5 — Atos negociais",
      "6.6 — Atos comprobatórios",
      "6.7 — Atos de divulgação",
      "6.8 — Atos de serviço",
    ],
  },
];

export function findDisciplina(id: string) {
  return disciplinasLite.find((d) => d.id === id);
}

// Disciplinas que podem receber conteúdo (exclui documentos sigilosos como o POP)
export const disciplinasSelecionaveis = disciplinasLite.filter((d) => !d.restricted);

// Tópico especial exclusivo das BizuAulas: análise estratégica do edital.
// Fica em destaque (primeiro da lista) e não aparece no Edital/Mapas Mentais.
export const ANALISE_EDITAL_DISC: DisciplinaLite = {
  id: "analise-edital",
  title: "Análise do Edital",
  subtitle: "Visão geral e estratégia do CHOA/2026",
  topics: ["Análise completa do edital"],
};

// Lista de disciplinas usada nas BizuAulas (Análise do Edital sempre em primeiro).
export const bizuAulaDisciplinas: DisciplinaLite[] = [ANALISE_EDITAL_DISC, ...disciplinasLite];

// Selecionáveis no admin das BizuAulas (exclui sigilosos como o POP).
export const bizuAulaSelecionaveis = bizuAulaDisciplinas.filter((d) => !d.restricted);

/* ─────────────── Estrutura por curso (PMTO / CBMTO) ─────────────── */

export const disciplinasLitePmto = disciplinasLite;

export const disciplinasLiteCbmto: DisciplinaLite[] = disciplinasCbmto.map((d) => ({
  id: d.id,
  title: d.title,
  subtitle: d.subtitle,
  topics: d.items.map((i) => i.topic),
  comingSoon: d.comingSoon,
  restricted: d.restricted,
}));

const LITE_POR_CURSO: Record<string, DisciplinaLite[]> = {
  pmto: disciplinasLitePmto,
  cbmto: disciplinasLiteCbmto,
};

export function getDisciplinasLite(cursoSlug?: string | null): DisciplinaLite[] {
  return LITE_POR_CURSO[(cursoSlug || "pmto").toLowerCase()] ?? disciplinasLitePmto;
}

export function getDisciplinasSelecionaveis(cursoSlug?: string | null): DisciplinaLite[] {
  return getDisciplinasLite(cursoSlug).filter((d) => !d.restricted);
}

export function findDisciplinaByCurso(id: string, cursoSlug?: string | null) {
  return getDisciplinasLite(cursoSlug).find((d) => d.id === id);
}

export function getBizuAulaDisciplinas(cursoSlug?: string | null): DisciplinaLite[] {
  return [ANALISE_EDITAL_DISC, ...getDisciplinasLite(cursoSlug)];
}

export function getBizuAulaSelecionaveis(cursoSlug?: string | null): DisciplinaLite[] {
  return getBizuAulaDisciplinas(cursoSlug).filter((d) => !d.restricted);
}

