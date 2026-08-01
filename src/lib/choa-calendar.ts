// Cronograma oficial CHOA 2026 — estrutura editável para atualização futura.
// Cada evento segue: id, title, date, category, description, priority, isCritical.

export type ChoaEventCategory =
  | "prova"
  | "inscricao"
  | "recurso"
  | "avaliacao_medica"
  | "documentacao"
  | "resultado";

export type ChoaEvent = {
  id: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  category: ChoaEventCategory;
  description: string;
  priority: "alta" | "media" | "baixa";
  isCritical: boolean;
};

// Data principal do exame
export const EXAME_CONHECIMENTOS_DATE = "2026-07-29";

// Cronograma atualizado conforme Edital nº 003/2026 (Retificação e Reabertura de Inscrições) — 23/06/2026.
export const CHOA_EVENTS: ChoaEvent[] = [
  {
    id: "edital-003-reabertura",
    title: "Edital nº 003/2026 — Retificação e Reabertura de Inscrições",
    date: "2026-06-23",
    category: "inscricao",
    description: "Publicação da retificação do Edital nº 001/2026, ampliação para 100 vagas e reabertura das inscrições.",
    priority: "alta",
    isCritical: false,
  },
  {
    id: "inicio-inscricoes-2periodo",
    title: "Início das inscrições — 2º período",
    date: "2026-06-24",
    category: "inscricao",
    description: "Abertura do novo prazo de inscrições para o Exame de Conhecimentos — 1ª Fase.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "encerramento-inscricoes-2periodo",
    title: "Encerramento das inscrições — 2º período",
    date: "2026-06-30",
    category: "inscricao",
    description: "Último dia para realizar e confirmar a inscrição no 2º período do processo seletivo.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "homologacao-preliminar-consolidada",
    title: "Divulgação preliminar consolidada das inscrições",
    date: "2026-07-01",
    category: "inscricao",
    description: "Publicação da lista preliminar consolidada das inscrições homologadas (1º e 2º períodos).",
    priority: "media",
    isCritical: false,
  },
  {
    id: "recurso-inscricoes",
    title: "Prazo de recurso referente às inscrições",
    date: "2026-07-02",
    category: "recurso",
    description: "Abertura do prazo para interposição de recurso sobre as inscrições (encerra em 03/07).",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "homologacao-definitiva-inscricoes",
    title: "Homologação definitiva das inscrições",
    date: "2026-07-07",
    category: "inscricao",
    description: "Divulgação da lista definitiva de candidatos inscritos (1º e 2º períodos).",
    priority: "media",
    isCritical: false,
  },
  {
    id: "encerramento-condicoes-especiais",
    title: "Encerramento do prazo de condições especiais",
    date: "2026-07-22",
    category: "inscricao",
    description: "Último dia para solicitar condições especiais para a realização da prova.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "exame-conhecimentos",
    title: "Aplicação do Exame de Conhecimentos — 1ª Fase",
    date: EXAME_CONHECIMENTOS_DATE,
    category: "prova",
    description: "Realização da prova objetiva da 1ª fase do processo seletivo.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "gabarito-preliminar",
    title: "Divulgação do gabarito preliminar",
    date: "2026-07-29",
    category: "resultado",
    description: "Publicação do gabarito preliminar do Exame de Conhecimentos.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "recurso-gabarito",
    title: "Prazo de recurso ao gabarito preliminar",
    date: "2026-07-30",
    category: "recurso",
    description: "Prazo para interposição de recurso contra o gabarito preliminar (encerra em 31/07).",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "gabarito-definitivo",
    title: "Divulgação do gabarito definitivo",
    date: "2026-08-03",
    category: "resultado",
    description: "Publicação do gabarito definitivo e do resultado preliminar da 1ª Fase.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "resultado-final-1fase",
    title: "Homologação do resultado final da 1ª Fase",
    date: "2026-08-07",
    category: "resultado",
    description: "Divulgação do resultado final da 1ª fase e convocação para a Avaliação Médica.",
    priority: "alta",
    isCritical: false,
  },
  {
    id: "avaliacao-medica",
    title: "Avaliação Médica — 2ª Fase (Palmas/TO)",
    date: "2026-08-12",
    category: "avaliacao_medica",
    description: "Etapa de inspeção de saúde dos candidatos aprovados na 1ª fase.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "resultado-final-2fase",
    title: "Homologação do resultado final da 2ª Fase",
    date: "2026-08-19",
    category: "resultado",
    description: "Divulgação do resultado final da 2ª fase e início da apresentação de documentação.",
    priority: "alta",
    isCritical: false,
  },
  {
    id: "documentacao",
    title: "Apresentação de documentação — 3ª Fase",
    date: "2026-08-19",
    category: "documentacao",
    description: "Entrega da documentação exigida para a Análise de Requisitos Legais (encerra em 21/08).",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "resultado-final-3fase",
    title: "Homologação do resultado final da 3ª Fase",
    date: "2026-09-01",
    category: "resultado",
    description: "Divulgação do resultado final da Análise de Requisitos Legais — 3ª Fase.",
    priority: "alta",
    isCritical: false,
  },
  {
    id: "resultado-final",
    title: "Resultado final do Processo Seletivo — CHOA 2026",
    date: "2026-09-02",
    category: "resultado",
    description: "Homologação do resultado final do Processo Seletivo Interno CHOA 2026.",
    priority: "alta",
    isCritical: true,
  },
];

/* ─────────── CHOA BM 2026 (CBMTO) — Edital nº 1/2026/GABCOM, Anexo I ─────────── */

export const EXAME_CONHECIMENTOS_DATE_CBMTO = "2026-09-04";

export const CHOA_EVENTS_CBMTO: ChoaEvent[] = [
  {
    id: "cbm-inscricoes",
    title: "Período de inscrições",
    date: "2026-07-03",
    category: "inscricao",
    description: "Inscrições pela intranet do CBMTO, das 8h de 03/07 às 18h de 12/07/2026.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "cbm-encerramento-inscricoes",
    title: "Encerramento das inscrições",
    date: "2026-07-12",
    category: "inscricao",
    description: "Último dia para inscrição e envio das certidões exigidas no item 3.7 do edital.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "cbm-divulgacao-inscricoes",
    title: "Divulgação das inscrições deferidas e indeferidas",
    date: "2026-07-15",
    category: "inscricao",
    description: "Edital nº 7/2026/DEP — resultado da análise das inscrições e retificação do conteúdo programático.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-recurso-inscricao",
    title: "Recurso contra o indeferimento da inscrição",
    date: "2026-07-17",
    category: "recurso",
    description: "Envio exclusivo por e-mail (csichoa2026@gmail.com), aos cuidados do Presidente da CSI.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "cbm-homologacao-inscricoes",
    title: "Homologação das inscrições",
    date: "2026-07-21",
    category: "inscricao",
    description: "Publicação da lista definitiva de inscrições homologadas.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-condicoes-especiais",
    title: "Solicitação de condições especiais para a prova",
    date: "2026-07-22",
    category: "documentacao",
    description: "Prazo de 22 e 23/07/2026 para requerer condições especiais (Anexo II do edital).",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-resultado-prelim-condicoes",
    title: "Resultado preliminar das condições especiais",
    date: "2026-07-27",
    category: "resultado",
    description: "Divulgação do resultado preliminar dos pedidos de condições especiais.",
    priority: "baixa",
    isCritical: false,
  },
  {
    id: "cbm-recurso-condicoes",
    title: "Recurso contra o indeferimento das condições especiais",
    date: "2026-07-29",
    category: "recurso",
    description: "Prazo para interposição de recurso quanto às condições especiais.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-resultado-final-condicoes",
    title: "Resultado final dos pedidos de condições especiais",
    date: "2026-08-03",
    category: "resultado",
    description: "Divulgação definitiva sobre os pedidos de condições especiais.",
    priority: "baixa",
    isCritical: false,
  },
  {
    id: "cbm-locais-prova",
    title: "Divulgação dos locais da prova objetiva",
    date: "2026-08-05",
    category: "prova",
    description: "Publicação dos locais de prova da segunda etapa, em Palmas-TO.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-prova-objetiva",
    title: "Prova objetiva — 2ª etapa",
    date: EXAME_CONHECIMENTOS_DATE_CBMTO,
    category: "prova",
    description: "50 questões (4 alternativas), 2,0 pontos cada, das 8h às 12h. Portões fecham às 7h50.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "cbm-gabarito-preliminar",
    title: "Gabarito preliminar da prova objetiva",
    date: "2026-09-04",
    category: "resultado",
    description: "Publicação do gabarito preliminar no mesmo dia da prova.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-recurso-gabarito",
    title: "Recurso contra o gabarito preliminar",
    date: "2026-09-07",
    category: "recurso",
    description: "Prazo para interposição de recurso contra o gabarito preliminar.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "cbm-gabarito-definitivo",
    title: "Gabarito definitivo e resultado preliminar",
    date: "2026-09-11",
    category: "resultado",
    description: "Divulgação do gabarito definitivo e do resultado preliminar da prova objetiva.",
    priority: "alta",
    isCritical: false,
  },
  {
    id: "cbm-recurso-resultado",
    title: "Recurso contra o resultado preliminar da prova objetiva",
    date: "2026-09-16",
    category: "recurso",
    description: "Prazo para recurso quanto ao resultado preliminar da segunda etapa.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-resultado-final-objetiva",
    title: "Resultado final da prova objetiva e convocação médica",
    date: "2026-09-18",
    category: "resultado",
    description: "Convocação dos 15 primeiros classificados para a inspeção de saúde.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "cbm-inspecao-medica",
    title: "Inspeção médica oficial — 3ª etapa",
    date: "2026-09-23",
    category: "avaliacao_medica",
    description: "Apresentação na DISAS (403 Sul, Palmas-TO) com os exames exigidos no edital.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "cbm-resultado-prelim-3etapa",
    title: "Resultado preliminar da terceira etapa",
    date: "2026-09-24",
    category: "resultado",
    description: "Divulgação do resultado preliminar da inspeção de saúde.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-recurso-3etapa",
    title: "Recurso contra o resultado preliminar da terceira etapa",
    date: "2026-09-25",
    category: "recurso",
    description: "Prazo para interposição de recurso quanto à inspeção de saúde.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "cbm-resultado-final",
    title: "Resultado final da seleção interna — CHOA BM 2026",
    date: "2026-09-29",
    category: "resultado",
    description: "Resultado definitivo da terceira etapa e resultado final do processo seletivo (15 vagas).",
    priority: "alta",
    isCritical: true,
  },
];

const EVENTS_POR_CURSO: Record<string, ChoaEvent[]> = {
  pmto: CHOA_EVENTS,
  cbmto: CHOA_EVENTS_CBMTO,
};

const EXAME_DATE_POR_CURSO: Record<string, string> = {
  pmto: EXAME_CONHECIMENTOS_DATE,
  cbmto: EXAME_CONHECIMENTOS_DATE_CBMTO,
};

export function getChoaEvents(cursoSlug?: string | null): ChoaEvent[] {
  return EVENTS_POR_CURSO[(cursoSlug || "pmto").toLowerCase()] ?? CHOA_EVENTS;
}

export function getExameDate(cursoSlug?: string | null): string {
  return EXAME_DATE_POR_CURSO[(cursoSlug || "pmto").toLowerCase()] ?? EXAME_CONHECIMENTOS_DATE;
}



export const CATEGORY_LABELS: Record<ChoaEventCategory, string> = {
  prova: "Prova",
  inscricao: "Inscrição",
  recurso: "Recurso",
  avaliacao_medica: "Avaliação Médica",
  documentacao: "Documentação",
  resultado: "Resultado",
};

export type UrgencyLevel = "hoje" | "amanha" | "critico" | "atencao" | "em_breve" | "concluido";

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  hoje: "Hoje",
  amanha: "Amanhã",
  critico: "Prazo crítico",
  atencao: "Atenção",
  em_breve: "Em breve",
  concluido: "Concluído",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseEventDate(date: string): Date {
  // Trata a string como data local (evita deslocamento de fuso)
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getDaysUntil(date: string, now: Date = new Date()): number {
  const today = startOfDay(now).getTime();
  const target = startOfDay(parseEventDate(date)).getTime();
  return Math.round((target - today) / 86400000);
}

export function getUrgency(date: string, now: Date = new Date()): UrgencyLevel {
  const days = getDaysUntil(date, now);
  if (days < 0) return "concluido";
  if (days === 0) return "hoje";
  if (days === 1) return "amanha";
  if (days <= 3) return "critico";
  if (days <= 7) return "atencao";
  return "em_breve";
}

// Categorias com prioridade visual maior
const HIGH_PRIORITY_CATEGORIES: ChoaEventCategory[] = [
  "inscricao",
  "recurso",
  "prova",
  "avaliacao_medica",
  "documentacao",
];

export function isHighPriorityCategory(category: ChoaEventCategory): boolean {
  return HIGH_PRIORITY_CATEGORIES.includes(category);
}

export function getSortedEvents(events: ChoaEvent[] = CHOA_EVENTS): ChoaEvent[] {
  return [...events].sort(
    (a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime(),
  );
}

export function getUpcomingEvents(
  events: ChoaEvent[] = CHOA_EVENTS,
  now: Date = new Date(),
): ChoaEvent[] {
  return getSortedEvents(events).filter((e) => getDaysUntil(e.date, now) >= 0);
}

// Próximo evento relevante ainda não concluído (prioriza eventos críticos/prova)
export function getNextMainEvent(
  events: ChoaEvent[] = CHOA_EVENTS,
  now: Date = new Date(),
): ChoaEvent | null {
  const upcoming = getUpcomingEvents(events, now);
  if (upcoming.length === 0) return null;
  // Antes da prova, o evento principal é o Exame de Conhecimentos
  const exame = upcoming.find((e) => e.category === "prova");
  if (exame) return exame;
  // Depois da prova, o próximo evento futuro mais próximo
  return upcoming[0];
}
