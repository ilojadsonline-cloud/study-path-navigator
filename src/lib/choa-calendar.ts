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

export const CHOA_EVENTS: ChoaEvent[] = [
  {
    id: "encerramento-inscricoes",
    title: "Encerramento das inscrições",
    date: "2026-06-15",
    category: "inscricao",
    description: "Último dia para realizar e confirmar a inscrição no processo seletivo.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "homologacao-preliminar",
    title: "Divulgação preliminar das inscrições homologadas",
    date: "2026-06-17",
    category: "inscricao",
    description: "Publicação da lista preliminar de inscrições homologadas.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "recurso-inscricoes",
    title: "Início do prazo de recurso das inscrições",
    date: "2026-06-18",
    category: "recurso",
    description: "Abertura do prazo para interposição de recurso sobre as inscrições.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "homologacao-final",
    title: "Homologação final das inscrições",
    date: "2026-06-25",
    category: "inscricao",
    description: "Divulgação da lista definitiva de candidatos inscritos.",
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
    date: "2026-07-31",
    category: "resultado",
    description: "Publicação do gabarito preliminar do Exame de Conhecimentos.",
    priority: "media",
    isCritical: false,
  },
  {
    id: "recurso-gabarito",
    title: "Recurso ao gabarito preliminar",
    date: "2026-08-03",
    category: "recurso",
    description: "Prazo para interposição de recurso contra o gabarito preliminar.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "resultado-1fase",
    title: "Resultado da 1ª Fase",
    date: "2026-08-17",
    category: "resultado",
    description: "Divulgação do resultado final da 1ª fase do processo seletivo.",
    priority: "alta",
    isCritical: false,
  },
  {
    id: "avaliacao-medica",
    title: "Avaliação Médica",
    date: "2026-08-31",
    category: "avaliacao_medica",
    description: "Etapa de inspeção de saúde dos candidatos aprovados na 1ª fase.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "documentacao",
    title: "Apresentação de documentação",
    date: "2026-09-14",
    category: "documentacao",
    description: "Entrega da documentação exigida para a continuidade no processo.",
    priority: "alta",
    isCritical: true,
  },
  {
    id: "resultado-final",
    title: "Resultado final",
    date: "2026-09-28",
    category: "resultado",
    description: "Divulgação do resultado final do processo seletivo CHOA 2026.",
    priority: "alta",
    isCritical: false,
  },
];

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
