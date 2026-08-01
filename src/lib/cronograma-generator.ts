// Schedule generation logic

export type DisciplinaCronograma = { nome: string; cor: string };

// CHOA PMTO — Edital nº 001/2026
export const DISCIPLINAS_PMTO: DisciplinaCronograma[] = [
  { nome: "RDMETO", cor: "#22C55E" },
  { nome: "Lei 2.578", cor: "#F97316" },
  { nome: "LC 128", cor: "#3B82F6" },
  { nome: "Lei 2.575", cor: "#EAB308" },
  { nome: "CPPM", cor: "#EF4444" },
  { nome: "POP", cor: "#A855F7" },
  { nome: "Português", cor: "#EC4899" },
  { nome: "Redação Oficial", cor: "#14B8A6" },
];

// CHOA BM CBMTO — Edital nº 1/2026/GABCOM
export const DISCIPLINAS_CBMTO: DisciplinaCronograma[] = [
  { nome: "Direito Penal Militar e Processual Penal Militar", cor: "#EF4444" },
  { nome: "Redação Oficial", cor: "#14B8A6" },
  { nome: "Combate a Incêndio Urbano", cor: "#F97316" },
  { nome: "NPCE", cor: "#3B82F6" },
  { nome: "Sistema de Comando de Incidentes", cor: "#06B6D4" },
  { nome: "Atendimento Pré-Hospitalar", cor: "#F43F5E" },
  { nome: "Salvamento em Altura", cor: "#8B5CF6" },
  { nome: "Salvamento Aquático", cor: "#0EA5E9" },
  { nome: "Salvamento Terrestre", cor: "#22C55E" },
  { nome: "Legislação Específica", cor: "#EAB308" },
];

const DISCIPLINAS_POR_CURSO: Record<string, DisciplinaCronograma[]> = {
  pmto: DISCIPLINAS_PMTO,
  cbmto: DISCIPLINAS_CBMTO,
};

export function getDisciplinasCronograma(cursoSlug?: string | null): DisciplinaCronograma[] {
  return DISCIPLINAS_POR_CURSO[(cursoSlug || "pmto").toLowerCase()] ?? DISCIPLINAS_PMTO;
}

/** Compatibilidade: lista padrão (PMTO). */
export const DISCIPLINAS = DISCIPLINAS_PMTO;

export type TipoAtividade = "videoaula" | "lei" | "questoes";
export type DisciplinaNome = string;

export interface AtividadeBloco {
  id: string;
  dia_semana: string;
  horario_inicio: string;
  horario_fim: string;
  disciplina: DisciplinaNome;
  tipo_atividade: TipoAtividade;
  duracao_minutos: number;
}

export interface Distribuicao {
  videoaulas: number;
  lei: number;
  questoes: number;
}

export interface CronogramaData {
  nome: string;
  tipo: "padrao" | "personalizado";
  horas_semanais: number;
  distribuicao: Distribuicao;
  dias_semana: string[];
  horario_inicio: string;
  horario_fim: string;
  atividades: AtividadeBloco[];
}

const DIAS_SEMANA_LABELS: Record<string, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

export const DIAS_SEMANA_ORDER = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

export function getDiaLabel(dia: string): string {
  return DIAS_SEMANA_LABELS[dia] || dia;
}

export function getCorDisciplina(disciplina: string, cursoSlug?: string | null): string {
  const lista = cursoSlug ? getDisciplinasCronograma(cursoSlug) : [...DISCIPLINAS_PMTO, ...DISCIPLINAS_CBMTO];
  return lista.find(d => d.nome === disciplina)?.cor
    || [...DISCIPLINAS_PMTO, ...DISCIPLINAS_CBMTO].find(d => d.nome === disciplina)?.cor
    || "#6B7280";
}

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMin = h * 60 + m + minutes;
  const nh = Math.floor(totalMin / 60) % 24;
  const nm = totalMin % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function getTimeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

const TIPOS_ATIVIDADE: TipoAtividade[] = ["videoaula", "lei", "questoes"];

export function gerarCronograma(params: {
  horas_semanais: number;
  distribuicao: Distribuicao;
  dias_semana: string[];
  horario_inicio: string;
  horario_fim: string;
  curso_slug?: string;
}): AtividadeBloco[] {
  const { horas_semanais, distribuicao, dias_semana, horario_inicio, horario_fim } = params;
  const DISCIPLINAS_ATIVAS = getDisciplinasCronograma(params.curso_slug);

  if (dias_semana.length === 0) return [];

  const totalMinutos = horas_semanais * 60;
  const minutosPorDia = Math.floor(totalMinutos / dias_semana.length);
  const minutosDisponiveis = getTimeDiffMinutes(horario_inicio, horario_fim);
  const minutosEfetivos = Math.min(minutosPorDia, minutosDisponiveis);

  // Minutes per activity type (total for the week)
  const minVideoaulas = Math.round(totalMinutos * distribuicao.videoaulas / 100);
  const minLei = Math.round(totalMinutos * distribuicao.lei / 100);
  const minQuestoes = totalMinutos - minVideoaulas - minLei;

  // Build a pool of (discipline, activity) pairs to distribute
  const pool: { disciplina: DisciplinaNome; tipo: TipoAtividade }[] = [];

  // Create balanced blocks: each discipline gets equal share of each activity type
  const numDisciplinas = DISCIPLINAS_ATIVAS.length;
  const blockDuration = 60; // 1-hour blocks

  // Calculate blocks per activity type
  const blocksVideoaulas = Math.max(1, Math.round(minVideoaulas / blockDuration));
  const blocksLei = Math.max(1, Math.round(minLei / blockDuration));
  const blocksQuestoes = Math.max(1, Math.round(minQuestoes / blockDuration));

  // Distribute blocks across disciplines for each type
  for (let i = 0; i < blocksVideoaulas; i++) {
    pool.push({ disciplina: DISCIPLINAS_ATIVAS[i % numDisciplinas].nome, tipo: "videoaula" });
  }
  for (let i = 0; i < blocksLei; i++) {
    pool.push({ disciplina: DISCIPLINAS_ATIVAS[i % numDisciplinas].nome, tipo: "lei" });
  }
  for (let i = 0; i < blocksQuestoes; i++) {
    pool.push({ disciplina: DISCIPLINAS_ATIVAS[i % numDisciplinas].nome, tipo: "questoes" });
  }

  // Shuffle pool for variety
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Try to avoid same discipline in consecutive blocks
  // Simple sort: alternate activity types across days
  const sortedPool: typeof pool = [];
  const byType: Record<TipoAtividade, typeof pool> = { videoaula: [], lei: [], questoes: [] };
  pool.forEach(p => byType[p.tipo].push(p));

  let typeIdx = 0;
  while (sortedPool.length < pool.length) {
    const tipo = TIPOS_ATIVIDADE[typeIdx % 3];
    if (byType[tipo].length > 0) {
      sortedPool.push(byType[tipo].shift()!);
    }
    typeIdx++;
    // Safety: avoid infinite loop
    if (typeIdx > pool.length * 3) break;
  }

  // Distribute blocks across days
  const blocksPerDay = Math.max(1, Math.floor(minutosEfetivos / blockDuration));
  const totalBlocks = dias_semana.length * blocksPerDay;

  const atividades: AtividadeBloco[] = [];
  let poolIdx = 0;

  for (const dia of dias_semana) {
    let currentTime = horario_inicio;

    for (let b = 0; b < blocksPerDay && poolIdx < sortedPool.length; b++) {
      const item = sortedPool[poolIdx];
      const endTime = addMinutesToTime(currentTime, blockDuration);

      atividades.push({
        id: generateId(),
        dia_semana: dia,
        horario_inicio: currentTime,
        horario_fim: endTime,
        disciplina: item.disciplina,
        tipo_atividade: item.tipo,
        duracao_minutos: blockDuration,
      });

      currentTime = endTime;
      poolIdx++;
    }
  }

  return atividades;
}

export function gerarCronogramaPadrao(cursoSlug?: string | null): CronogramaData {
  const params = {
    horas_semanais: 20,
    distribuicao: { videoaulas: 40, lei: 30, questoes: 30 },
    dias_semana: ["segunda", "terca", "quarta", "quinta", "sexta"],
    horario_inicio: "19:00",
    horario_fim: "23:00",
    curso_slug: cursoSlug ?? undefined,
  };

  return {
    nome: "Cronograma Padrão (20h)",
    tipo: "padrao",
    ...params,
    atividades: gerarCronograma(params),
  };
}

export function calcularResumo(atividades: AtividadeBloco[], cursoSlug?: string | null): {
  porDisciplina: Record<string, Record<TipoAtividade | "total", number>>;
  totais: Record<TipoAtividade | "total", number>;
} {
  const porDisciplina: Record<string, Record<TipoAtividade | "total", number>> = {};
  const totais: Record<TipoAtividade | "total", number> = { videoaula: 0, lei: 0, questoes: 0, total: 0 };

  getDisciplinasCronograma(cursoSlug).forEach(d => {
    porDisciplina[d.nome] = { videoaula: 0, lei: 0, questoes: 0, total: 0 };
  });

  atividades.forEach(a => {
    if (!porDisciplina[a.disciplina]) {
      porDisciplina[a.disciplina] = { videoaula: 0, lei: 0, questoes: 0, total: 0 };
    }
    porDisciplina[a.disciplina][a.tipo_atividade] += a.duracao_minutos;
    porDisciplina[a.disciplina].total += a.duracao_minutos;
    totais[a.tipo_atividade] += a.duracao_minutos;
    totais.total += a.duracao_minutos;
  });

  return { porDisciplina, totais };
}

export function formatMinutes(min: number): string {
  if (min === 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

export const TIPO_LABELS: Record<TipoAtividade, string> = {
  videoaula: "Videoaula",
  lei: "Lei Seca",
  questoes: "Questões",
};
