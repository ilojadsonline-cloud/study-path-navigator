// Estrutura compartilhada (lite) do Edital Verticalizado — usada por
// Edital, Mapas Mentais e Painel Admin. Mantenha em sincronia com src/pages/Edital.tsx.

export type DisciplinaLite = {
  id: string;
  title: string;
  subtitle: string;
  topics: string[];
};

export const disciplinasLite: DisciplinaLite[] = [
  {
    id: "estatuto",
    title: "Estatuto dos Policiais Militares e Bombeiros Militares do TO",
    subtitle: "Lei nº 2.578/2012",
    topics: [
      "Disposições Preliminares",
      "Ingresso, Hierarquia e Disciplina",
      "Deveres, Obrigações e Direitos",
      "Regime Disciplinar",
      "Movimentação e Lotação",
      "Afastamento e Licenciamento",
    ],
  },
  {
    id: "organizacao",
    title: "Organização Básica da PMTO",
    subtitle: "Lei Complementar nº 128/2021",
    topics: [
      "Estrutura e Missão Institucional",
      "Órgãos de Direção Geral",
      "Órgãos de Direção Setorial",
      "Órgãos de Execução",
      "Disposições Gerais e Transitórias",
    ],
  },
  {
    id: "promocoes",
    title: "Promoções na PMTO",
    subtitle: "Lei nº 2.575/2012",
    topics: [
      "Disposições Preliminares (Arts. 1º a 10)",
      "Comissões de Promoção (Arts. 11 a 20)",
      "Critérios de Promoção (Arts. 21 a 28)",
      "Quadros de Acesso e Interstício (Arts. 29 a 40)",
      "Avaliação Profissional e Moral (Arts. 41 a 46)",
      "Promoção por Bravura, Post Mortem, Tempo de Serviço e Invalidez (Arts. 49 a 57)",
      "Recursos e Cursos de Habilitação (Arts. 58 a 66)",
    ],
  },
  {
    id: "cppm",
    title: "Código de Processo Penal Militar (CPPM)",
    subtitle: "Decreto-Lei nº 1.002/1969",
    topics: [
      "Da Polícia Judiciária Militar (Arts. 8º a 11)",
      "Do Inquérito Policial Militar — IPM (Arts. 12 a 28)",
      "Da Prisão Provisória (Arts. 243 a 253)",
    ],
  },
  {
    id: "rdmeto",
    title: "Regulamento Disciplinar Militar do TO (RDMETO)",
    subtitle: "Decreto nº 4.994/2014",
    topics: [
      "Disposições Gerais e Princípios",
      "Transgressões Disciplinares",
      "Sanções Disciplinares",
      "Comportamento Militar",
      "Processo Disciplinar",
    ],
  },
  {
    id: "dir-penal-militar",
    title: "Noções de Direito Penal Militar",
    subtitle: "Código Penal Militar — Parte Geral",
    topics: [
      "Aplicação da Lei Penal Militar",
      "Crime Militar: Conceito e Elementos",
      "Excludentes e Circunstâncias",
      "Penas e Medidas de Segurança",
    ],
  },
  {
    id: "lei-organica-pm",
    title: "Lei Orgânica das Polícias Militares",
    subtitle: "Lei nº 14.751/2023",
    topics: [
      "Disposições Gerais e Princípios",
      "Organização e Estrutura",
      "Carreira e Direitos",
      "Regime Disciplinar e Deveres",
      "Atividade de Policiamento Ostensivo",
      "Disposições Finais e Transitórias",
    ],
  },
];

export function findDisciplina(id: string) {
  return disciplinasLite.find((d) => d.id === id);
}
