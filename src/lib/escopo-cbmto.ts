/**
 * Matriz de escopo vinculante — CHOA CBMTO 2026.
 *
 * Base normativa:
 *  - Edital nº 1/2026/GABCOM, de 2 de julho de 2026 (edital-base);
 *  - Edital nº 7/2026/DEP, de 15 de julho de 2026 (retificação — prevalece SOMENTE em APH).
 *
 * Item 14.13 do edital-base: dispositivo que entrou em vigor depois de 02/07/2026 não pode ser cobrado.
 *
 * Este arquivo é a fonte única de verdade do gerador e do auditor CBMTO.
 * Não afeta o CHOA PMTO.
 */

export const EDITAL_BASE_CBMTO = "Edital nº 1/2026/GABCOM, de 2 de julho de 2026";
export const EDITAL_RETIFICADOR_APH = "Edital nº 7/2026/DEP, de 15 de julho de 2026";
export const DATA_CORTE_CBMTO = "2026-07-02";
export const DIFICULDADE_CBMTO = "Difícil";
export const BANCA_CBMTO = "CBMTO";
export const ANO_CBMTO = 2026;
export const PROVA_CBMTO = "CHOA";
export const LETRAS_CBMTO = ["A", "B", "C", "D"] as const;
export type LetraCbmto = (typeof LETRAS_CBMTO)[number];

/* ─────────────────────────── Escopo por disciplina ─────────────────────────── */

export interface FaixaArtigos {
  de: number;
  ate: number;
  rotulo?: string;
}

export interface EscopoDisciplina {
  /** Nome exatamente como cadastrado no banco/geração (ver disciplinas-geracao.ts). */
  disciplina: string;
  /** Arquivo Markdown autorizado (fonte operacional de consulta). */
  arquivo: string;
  /** PDF de conferência, quando houver (OCR, tabelas, fórmulas, imagens). */
  pdfConferencia?: string;
  editalAutorizador: string;
  /** Capítulos/módulos autorizados. Vazio = sem limitação capitular expressa. */
  capitulosAutorizados: number[];
  /** Capítulos expressamente excluídos (reprovação por escopo). */
  capitulosExcluidos: number[];
  /** Faixas de artigos autorizadas (quando o edital recorta por artigo). */
  artigosAutorizados: FaixaArtigos[];
  /** Seções expressamente excluídas dentro de capítulos autorizados. */
  secoesExcluidas?: string[];
  observacao?: string;
}

export const ESCOPO_CBMTO: EscopoDisciplina[] = [
  {
    disciplina: "CPM — Código Penal Militar",
    arquivo: "cpm-resumo-edital.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [],
    capitulosExcluidos: [],
    artigosAutorizados: [
      { de: 1, ate: 28 },
      { de: 29, ate: 47 },
      { de: 149, ate: 182 },
      { de: 183, ate: 204 },
      { de: 298, ate: 339 },
    ],
  },
  {
    disciplina: "CPPM — Código de Processo Penal Militar",
    arquivo: "cppm-resumo-edital.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [],
    capitulosExcluidos: [],
    artigosAutorizados: [
      { de: 1, ate: 6 },
      { de: 7, ate: 8 },
      { de: 9, ate: 28 },
      { de: 243, ate: 253 },
      { de: 451, ate: 457, rotulo: "Deserção de oficial, de praça (com ou sem graduação) e de praça especial" },
    ],
  },
  {
    disciplina: "Redação Oficial",
    arquivo: "redacao-oficial-resumo-edital.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [1, 2],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    observacao: "Somente os capítulos I e II do Manual de Redação da Presidência da República.",
  },
  {
    disciplina: "Combate a Incêndio Urbano",
    arquivo: "manual-basico-combate-incendio.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [1, 2, 3],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    observacao:
      "Módulos 1, 2 e 3 do Manual Básico de Combate a Incêndio do CBMDF (2ª ed.): comportamento do fogo, efeitos nocivos do incêndio e técnicas de combate.",
  },
  {
    disciplina: "NPCE",
    arquivo: "npce.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    secoesExcluidas: ["Título II, capítulo XV — seção única"],
    observacao:
      "Título I, cap. IV; Título II, caps. I, II, V, IX, XI, XII, XIII, XIV, XV (exceto a seção única) e XVI; Título III, cap. III.",
  },
  {
    disciplina: "Sistema de Comando de Incidentes",
    arquivo: "manual-sci-cbmgo.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [1, 2, 3, 4, 5, 6],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    observacao: "Capítulos 1 a 6 do MOB SCI do CBMGO. Não importar doutrina externa.",
  },
  {
    disciplina: "Atendimento Pré-Hospitalar",
    arquivo: "manual-aph.md",
    editalAutorizador: `${EDITAL_RETIFICADOR_APH} (prevalece sobre o edital-base somente em APH)`,
    capitulosAutorizados: [2, 4, 5, 6, 9, 10, 11, 13, 17, 23],
    capitulosExcluidos: [1, 3, 7, 8, 12, 14, 15, 16, 18, 19, 20, 21, 22],
    artigosAutorizados: [],
    observacao:
      "Recorte retificado pelo Edital nº 7/2026/DEP; substitui integralmente o recorte de APH do edital original.",
  },
  {
    disciplina: "Salvamento em Altura",
    arquivo: "manual-salvamento-altura.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [11, 14, 15, 16, 18],
    capitulosExcluidos: [17],
    artigosAutorizados: [],
    observacao: "O capítulo 17 é expressamente excluído.",
  },
  {
    disciplina: "Salvamento Aquático",
    arquivo: "salvamento-aquatico-choa-cbmto.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [4, 6, 9],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    observacao: "Capítulos 4, 6 e 9 do MOB Guarda-Vidas do CBMGO. Não completar com conteúdo de APH.",
  },
  {
    disciplina: "Salvamento Terrestre",
    arquivo: "salvamento-terrestre-resumo-edital.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [1, 2, 3, 4, 5, 6, 7, 9],
    capitulosExcluidos: [8],
    artigosAutorizados: [],
    observacao: "Capítulos 1 a 7 e 9 do MOB Salvamento Terrestre do CBMGO.",
  },
  {
    disciplina: "Lei nº 2.578/2012 — Estatuto dos Militares do TO",
    arquivo: "lei-2578-2012.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    observacao: "Sem limitação capitular expressa no edital, respeitada a data de corte.",
  },
  {
    disciplina: "LC nº 131/2021 — Organização Básica do CBMTO",
    arquivo: "lei-131-2021.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    observacao: "Sem limitação capitular expressa no edital, respeitada a data de corte.",
  },
  {
    disciplina: "Lei nº 2.665/2012 — Promoções no CBMTO",
    arquivo: "lei-2665-2012.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    capitulosAutorizados: [],
    capitulosExcluidos: [],
    artigosAutorizados: [],
    observacao: "Sem limitação capitular expressa no edital, respeitada a data de corte.",
  },
  {
    disciplina: "Lei nº 3.798/2021 — Segurança Contra Incêndio",
    arquivo: "lei-3798-2021.md",
    editalAutorizador: EDITAL_BASE_CBMTO,
    // Capítulos I, II, III (seção II), IV, VI, VII, VIII e XII
    capitulosAutorizados: [1, 2, 3, 4, 6, 7, 8, 12],
    capitulosExcluidos: [5, 9, 10, 11],
    artigosAutorizados: [],
    observacao: "No capítulo III somente a seção II. Manter exatamente esse conjunto.",
  },
];

export const ARQUIVOS_MARKDOWN_CBMTO = ESCOPO_CBMTO.map((e) => e.arquivo);

export const EDITAIS_PDF_CBMTO = [
  { arquivo: "EDITAL - CHOA BM.pdf", papel: "edital-base", descricao: EDITAL_BASE_CBMTO },
  {
    arquivo: "CONTEUDO PROGRAMATICO - CHOA.pdf",
    papel: "retificacao-aph",
    descricao: `${EDITAL_RETIFICADOR_APH} — prevalece somente quanto a Atendimento Pré-Hospitalar`,
  },
];

export function getEscopoDisciplina(disciplina: string): EscopoDisciplina | null {
  const alvo = (disciplina || "").trim().toLowerCase();
  return ESCOPO_CBMTO.find((e) => e.disciplina.toLowerCase() === alvo) ?? null;
}

export function capituloAutorizado(disciplina: string, capitulo: number): boolean {
  const escopo = getEscopoDisciplina(disciplina);
  if (!escopo) return false;
  if (escopo.capitulosExcluidos.includes(capitulo)) return false;
  if (escopo.capitulosAutorizados.length === 0) return true;
  return escopo.capitulosAutorizados.includes(capitulo);
}

export function artigoAutorizado(disciplina: string, artigo: number): boolean {
  const escopo = getEscopoDisciplina(disciplina);
  if (!escopo) return false;
  if (escopo.artigosAutorizados.length === 0) return true;
  return escopo.artigosAutorizados.some((f) => artigo >= f.de && artigo <= f.ate);
}

/** Vigência: dispositivo em vigor após 02/07/2026 não pode ser cobrado. */
export function vigenciaAutorizada(dataVigencia?: string | null): boolean {
  if (!dataVigencia) return true; // sem data informada, quem decide é a camada normativa
  const d = new Date(dataVigencia);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() <= new Date(`${DATA_CORTE_CBMTO}T23:59:59Z`).getTime();
}

/* ───────────────────────────── Cotas oficiais ───────────────────────────── */

export interface CotaOficial {
  /** Nome da cota como aparece no edital. */
  cota: string;
  /** Disciplinas do banco que compõem a cota (divisão interna é apenas pedagógica). */
  disciplinas: string[];
  questoes: number;
}

export const COTAS_OFICIAIS_CBMTO: CotaOficial[] = [
  {
    cota: "Direito Penal Militar e Processual Penal Militar",
    disciplinas: ["CPM — Código Penal Militar", "CPPM — Código de Processo Penal Militar"],
    questoes: 4,
  },
  { cota: "Redação Oficial", disciplinas: ["Redação Oficial"], questoes: 3 },
  { cota: "Combate a Incêndio Urbano", disciplinas: ["Combate a Incêndio Urbano"], questoes: 5 },
  { cota: "Normas para o Planejamento e Conduta do Ensino — NPCE", disciplinas: ["NPCE"], questoes: 5 },
  { cota: "Sistema de Comando de Incidentes", disciplinas: ["Sistema de Comando de Incidentes"], questoes: 5 },
  { cota: "Atendimento Pré-Hospitalar", disciplinas: ["Atendimento Pré-Hospitalar"], questoes: 5 },
  { cota: "Salvamento em Altura", disciplinas: ["Salvamento em Altura"], questoes: 5 },
  { cota: "Salvamento Aquático", disciplinas: ["Salvamento Aquático"], questoes: 5 },
  { cota: "Salvamento Terrestre", disciplinas: ["Salvamento Terrestre"], questoes: 5 },
  {
    cota: "Legislação Específica",
    disciplinas: [
      "Lei nº 2.578/2012 — Estatuto dos Militares do TO",
      "LC nº 131/2021 — Organização Básica do CBMTO",
      "Lei nº 2.665/2012 — Promoções no CBMTO",
      "Lei nº 3.798/2021 — Segurança Contra Incêndio",
    ],
    questoes: 8,
  },
];

export const TOTAL_QUESTOES_SIMULADO_CBMTO = COTAS_OFICIAIS_CBMTO.reduce((s, c) => s + c.questoes, 0); // 50
export const VALOR_QUESTAO_CBMTO = 2;

export function validarCotasOficiais(disciplinasDasQuestoes: string[]): string[] {
  const erros: string[] = [];
  if (disciplinasDasQuestoes.length !== TOTAL_QUESTOES_SIMULADO_CBMTO) {
    erros.push(
      `O simulado oficial exige exatamente ${TOTAL_QUESTOES_SIMULADO_CBMTO} questões (encontradas ${disciplinasDasQuestoes.length}).`,
    );
  }
  for (const cota of COTAS_OFICIAIS_CBMTO) {
    const n = disciplinasDasQuestoes.filter((d) => cota.disciplinas.includes(d)).length;
    if (n !== cota.questoes) {
      erros.push(`Cota "${cota.cota}": esperado ${cota.questoes}, encontrado ${n}.`);
    }
  }
  const foraDoEdital = disciplinasDasQuestoes.filter(
    (d) => !COTAS_OFICIAIS_CBMTO.some((c) => c.disciplinas.includes(d)),
  );
  for (const d of new Set(foraDoEdital)) {
    erros.push(`Disciplina fora do edital CBMTO: "${d}".`);
  }
  return erros;
}

/* ───────────────────────── Distribuição de gabaritos ───────────────────────── */

/** 13/13/12/12 no simulado oficial; a cada simulado, alterna quais letras recebem 13. */
export function cotasGabaritoOficial(indiceSimulado = 0): Record<LetraCbmto, number> {
  const rot = ((indiceSimulado % 4) + 4) % 4;
  const ordem = [...LETRAS_CBMTO.slice(rot), ...LETRAS_CBMTO.slice(0, rot)] as LetraCbmto[];
  const cotas = { A: 12, B: 12, C: 12, D: 12 } as Record<LetraCbmto, number>;
  cotas[ordem[0]] = 13;
  cotas[ordem[1]] = 13;
  return cotas;
}

function embaralhar<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Planeja a letra do gabarito ANTES da redação das alternativas.
 * - simulado oficial (50): cotas 13/13/12/12;
 * - demais lotes: diferença máxima de 1 entre a letra mais e a menos usada;
 * - nunca mais de duas letras iguais consecutivas e sem ciclo previsível A-B-C-D.
 */
export function planejarGabaritos(total: number, opts: { oficial?: boolean; seed?: number; indiceSimulado?: number } = {}): LetraCbmto[] {
  const seed = opts.seed ?? 7;
  const pool: LetraCbmto[] = [];
  if (opts.oficial) {
    const cotas = cotasGabaritoOficial(opts.indiceSimulado ?? 0);
    for (const l of LETRAS_CBMTO) for (let i = 0; i < cotas[l]; i++) pool.push(l);
  } else {
    const base = Math.floor(total / 4);
    const resto = total % 4;
    const ordem = embaralhar([...LETRAS_CBMTO] as LetraCbmto[], seed);
    ordem.forEach((l, idx) => {
      const n = base + (idx < resto ? 1 : 0);
      for (let i = 0; i < n; i++) pool.push(l);
    });
  }

  const restante = embaralhar(pool, seed);
  const saida: LetraCbmto[] = [];
  while (restante.length) {
    const idx = restante.findIndex((l) => {
      const n = saida.length;
      const duasIguais = n >= 2 && saida[n - 1] === l && saida[n - 2] === l;
      const cicloABCD =
        n >= 3 &&
        LETRAS_CBMTO.indexOf(l) === (LETRAS_CBMTO.indexOf(saida[n - 1]) + 1) % 4 &&
        LETRAS_CBMTO.indexOf(saida[n - 1]) === (LETRAS_CBMTO.indexOf(saida[n - 2]) + 1) % 4 &&
        LETRAS_CBMTO.indexOf(saida[n - 2]) === (LETRAS_CBMTO.indexOf(saida[n - 3]) + 1) % 4;
      return !duasIguais && !cicloABCD;
    });
    const escolhido = idx >= 0 ? idx : 0;
    saida.push(restante.splice(escolhido, 1)[0]);
  }
  return saida;
}

export function validarDistribuicaoGabarito(letras: string[], oficial = false): string[] {
  const erros: string[] = [];
  const cont: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const l of letras) {
    if (!LETRAS_CBMTO.includes(l as LetraCbmto)) {
      erros.push(`Letra de gabarito inválida: "${l}". São permitidas apenas A, B, C e D.`);
      continue;
    }
    cont[l]++;
  }

  if (oficial) {
    const valores = Object.values(cont).sort((a, b) => b - a);
    if (valores.join(",") !== "13,13,12,12") {
      erros.push(
        `Simulado oficial exige distribuição 13/13/12/12 (atual: A=${cont.A}, B=${cont.B}, C=${cont.C}, D=${cont.D}).`,
      );
    }
  } else {
    const max = Math.max(...Object.values(cont));
    const min = Math.min(...Object.values(cont));
    if (max - min > 1) {
      erros.push(
        `Desequilíbrio de gabaritos: diferença ${max - min} entre a letra mais e a menos usada (máximo permitido: 1).`,
      );
    }
  }

  for (let i = 2; i < letras.length; i++) {
    if (letras[i] === letras[i - 1] && letras[i] === letras[i - 2]) {
      erros.push(`Três respostas iguais consecutivas na posição ${i + 1} (letra ${letras[i]}).`);
      break;
    }
  }

  let ciclo = 0;
  for (let i = 1; i < letras.length; i++) {
    const seq = LETRAS_CBMTO.indexOf(letras[i] as LetraCbmto) ===
      (LETRAS_CBMTO.indexOf(letras[i - 1] as LetraCbmto) + 1) % 4;
    ciclo = seq ? ciclo + 1 : 0;
    if (ciclo >= 4) {
      erros.push("Padrão previsível de gabarito (ciclo A-B-C-D) detectado.");
      break;
    }
  }

  return erros;
}

/* ────────────────────── Matriz de dificuldade (11 critérios) ────────────────────── */

export const CRITERIOS_MATRIZ_CBMTO = [
  "Contexto funcional realista",
  "Dois ou mais fatos decisivos ou duas regras articuladas",
  "Hipótese concorrente identificável",
  "Decisão concreta exigida",
  "Escopo comprovado no edital",
  "Fonte local vigente comprovada",
  "Três distratores plausíveis e controlados",
  "Equilíbrio visual e sintático das alternativas",
  "Unicidade após considerar as exceções",
  "Comentário aplicado aos fatos e às alternativas A–D",
  "Ineditismo material",
] as const;

/** Critérios sempre eliminatórios (1-indexados): escopo, fonte, unicidade e ineditismo. */
export const CRITERIOS_ELIMINATORIOS = [5, 6, 9, 11];
export const PONTUACAO_MINIMA_CBMTO = 10;

export type StatusEditorial = "aprovada" | "correcao_necessaria" | "quarentena" | "reprovada";

export interface ResultadoMatriz {
  pontuacao: number;
  atendeMinimo: boolean;
  eliminatoriosFalhos: number[];
  aprovada: boolean;
  motivos: string[];
}

/** `criterios` deve ter 11 posições booleanas, na ordem de CRITERIOS_MATRIZ_CBMTO. */
export function avaliarMatriz(criterios: boolean[]): ResultadoMatriz {
  const motivos: string[] = [];
  const pontuacao = criterios.filter(Boolean).length;
  const atendeMinimo = pontuacao >= PONTUACAO_MINIMA_CBMTO;
  if (!atendeMinimo) motivos.push(`Pontuação ${pontuacao}/11 abaixo do mínimo (${PONTUACAO_MINIMA_CBMTO}/11).`);

  const eliminatoriosFalhos = CRITERIOS_ELIMINATORIOS.filter((n) => criterios[n - 1] !== true);
  for (const n of eliminatoriosFalhos) {
    motivos.push(`Critério eliminatório ${n} reprovado: ${CRITERIOS_MATRIZ_CBMTO[n - 1]}.`);
  }

  return {
    pontuacao,
    atendeMinimo,
    eliminatoriosFalhos,
    aprovada: atendeMinimo && eliminatoriosFalhos.length === 0,
    motivos,
  };
}

/* ─────────────────────── Auditoria estrutural (camada 1) ─────────────────────── */

export interface QuestaoCbmto {
  disciplina?: string | null;
  assunto?: string | null;
  enunciado?: string | null;
  alt_a?: string | null;
  alt_b?: string | null;
  alt_c?: string | null;
  alt_d?: string | null;
  alt_e?: string | null;
  gabarito?: number | null;
  comentario?: string | null;
  analise_alternativas?: string | null;
  dica_prova?: string | null;
  base_normativa?: string | null;
  arquivo_fonte?: string | null;
  dispositivo?: string | null;
  capitulo?: number | null;
  artigo?: number | null;
  data_vigencia?: string | null;
  respostas_defensaveis?: number | null;
}

export interface FalhaAuditoria {
  camada: "estrutural" | "normativa" | "editorial" | "psicometrica" | "ineditismo";
  severidade: "eliminatoria" | "alta" | "media" | "baixa";
  motivo: string;
  trecho?: string;
  regra: string;
}

const VAZIO = (s?: string | null) => !s || !String(s).trim();

export function auditarEstrutura(q: QuestaoCbmto): FalhaAuditoria[] {
  const f: FalhaAuditoria[] = [];
  const reg = "Item 7 — estrutura obrigatória da questão CHOA CBMTO";

  if (VAZIO(q.disciplina)) f.push({ camada: "estrutural", severidade: "eliminatoria", motivo: "Disciplina ausente.", regra: reg });
  if (VAZIO(q.assunto)) f.push({ camada: "estrutural", severidade: "media", motivo: "Assunto ausente.", regra: reg });
  if (VAZIO(q.enunciado)) f.push({ camada: "estrutural", severidade: "eliminatoria", motivo: "Enunciado ausente.", regra: reg });

  for (const [letra, valor] of [["A", q.alt_a], ["B", q.alt_b], ["C", q.alt_c], ["D", q.alt_d]] as const) {
    if (VAZIO(valor)) {
      f.push({ camada: "estrutural", severidade: "eliminatoria", motivo: `Alternativa ${letra} ausente.`, regra: reg });
    }
  }

  if (!VAZIO(q.alt_e)) {
    f.push({
      camada: "estrutural",
      severidade: "eliminatoria",
      motivo: "Alternativa E não é permitida no CHOA CBMTO (exatamente quatro alternativas A–D).",
      trecho: String(q.alt_e).slice(0, 120),
      regra: "Item 1 — exatamente quatro alternativas A, B, C e D",
    });
  }

  const textos = [q.alt_a, q.alt_b, q.alt_c, q.alt_d].map((t) => (t || "").trim().toLowerCase());
  for (const t of textos) {
    if (/todas as anteriores|nenhuma das anteriores/.test(t)) {
      f.push({
        camada: "estrutural",
        severidade: "eliminatoria",
        motivo: '"Todas as anteriores" / "nenhuma das anteriores" são proibidas.',
        regra: "Item 1 — vedações de alternativa",
      });
      break;
    }
  }

  if (q.gabarito === null || q.gabarito === undefined || q.gabarito < 0 || q.gabarito > 3) {
    f.push({
      camada: "estrutural",
      severidade: "eliminatoria",
      motivo: "Gabarito deve ser um índice de 0 a 3 (A–D).",
      regra: "Item 1 — somente uma alternativa integralmente correta",
    });
  }

  if (VAZIO(q.comentario)) f.push({ camada: "estrutural", severidade: "eliminatoria", motivo: "Comentário ausente.", regra: reg });
  if (VAZIO(q.analise_alternativas)) {
    f.push({ camada: "estrutural", severidade: "eliminatoria", motivo: "Análise individual das alternativas A–D ausente.", regra: reg });
  } else {
    const analise = String(q.analise_alternativas);
    const faltantes = ["A", "B", "C", "D"].filter((l) => !new RegExp(`(^|[^A-Za-z])${l}\\s*[\\)\\-–:.]`, "m").test(analise));
    if (faltantes.length) {
      f.push({
        camada: "estrutural",
        severidade: "alta",
        motivo: `A análise não cobre individualmente: ${faltantes.join(", ")}.`,
        regra: reg,
      });
    }
  }
  if (VAZIO(q.dica_prova)) f.push({ camada: "estrutural", severidade: "media", motivo: '"Dica de prova" ausente.', regra: reg });
  if (VAZIO(q.base_normativa)) {
    f.push({ camada: "estrutural", severidade: "eliminatoria", motivo: "Base normativa ausente.", regra: reg });
  } else if (/https?:\/\//i.test(String(q.base_normativa))) {
    f.push({
      camada: "estrutural",
      severidade: "eliminatoria",
      motivo: "Base normativa não pode usar URL externa como fundamento.",
      regra: "Item 7 — base normativa com arquivo local, capítulo/artigo e subtópico",
    });
  }

  return f;
}

/** Camada normativa determinística: escopo, vigência e fonte. */
export function auditarEscopoNormativo(q: QuestaoCbmto, fontesValidadas: string[] = []): FalhaAuditoria[] {
  const f: FalhaAuditoria[] = [];
  const escopo = getEscopoDisciplina(q.disciplina || "");

  if (!escopo) {
    f.push({
      camada: "normativa",
      severidade: "eliminatoria",
      motivo: `Disciplina "${q.disciplina ?? "—"}" não consta da matriz de escopo do CHOA CBMTO 2026.`,
      regra: "Item 3 — conteúdo programático permitido",
    });
    return f;
  }

  if (fontesValidadas.length && !fontesValidadas.includes(escopo.arquivo)) {
    f.push({
      camada: "normativa",
      severidade: "eliminatoria",
      motivo: `Fonte obrigatória "${escopo.arquivo}" ausente ou não validada na biblioteca.`,
      regra: "Item 4 — biblioteca e precedência das fontes",
    });
  }

  if (q.arquivo_fonte && q.arquivo_fonte !== escopo.arquivo) {
    f.push({
      camada: "normativa",
      severidade: "eliminatoria",
      motivo: `Arquivo-fonte "${q.arquivo_fonte}" não é a fonte autorizada da disciplina ("${escopo.arquivo}").`,
      regra: "Item 4 — fonte autorizada por disciplina",
    });
  }

  if (typeof q.capitulo === "number" && !capituloAutorizado(escopo.disciplina, q.capitulo)) {
    f.push({
      camada: "normativa",
      severidade: "eliminatoria",
      motivo: `Capítulo ${q.capitulo} está fora do recorte autorizado de ${escopo.disciplina}.`,
      regra: `Item 3 — ${escopo.editalAutorizador}`,
    });
  }

  if (typeof q.artigo === "number" && !artigoAutorizado(escopo.disciplina, q.artigo)) {
    f.push({
      camada: "normativa",
      severidade: "eliminatoria",
      motivo: `Art. ${q.artigo} está fora do recorte autorizado de ${escopo.disciplina}.`,
      regra: `Item 3 — ${escopo.editalAutorizador}`,
    });
  }

  if (!vigenciaAutorizada(q.data_vigencia)) {
    f.push({
      camada: "normativa",
      severidade: "eliminatoria",
      motivo: `Dispositivo com vigência posterior a ${DATA_CORTE_CBMTO} não pode ser cobrado.`,
      regra: "Item 14.13 do edital-base — data de corte",
    });
  }

  if ((q.respostas_defensaveis ?? 1) !== 1) {
    f.push({
      camada: "psicometrica",
      severidade: "eliminatoria",
      motivo: `Foram identificadas ${q.respostas_defensaveis} respostas defensáveis; exige-se unicidade.`,
      regra: "Item 1 — somente uma alternativa integralmente correta",
    });
  }

  return f;
}

/** Decide o status editorial a partir das falhas e da matriz. */
export function decidirStatus(
  falhas: FalhaAuditoria[],
  matriz: ResultadoMatriz,
  opts: { evidenciaInsuficiente?: boolean } = {},
): StatusEditorial {
  const eliminatorias = falhas.filter((f) => f.severidade === "eliminatoria");
  if (opts.evidenciaInsuficiente) return "quarentena";
  if (eliminatorias.some((f) => f.camada === "normativa" || f.camada === "ineditismo")) return "reprovada";
  if (eliminatorias.length > 0) return "correcao_necessaria";
  if (!matriz.aprovada) {
    return matriz.eliminatoriosFalhos.length > 0 ? "reprovada" : "correcao_necessaria";
  }
  return "aprovada";
}

/* ───────────────────────── Prompt-mestre (item 13) ───────────────────────── */

export const PROMPT_SISTEMA_CBMTO = `Você atua como banca examinadora rigorosa do CHOA 2026 do Corpo de Bombeiros Militar do Estado do Tocantins. Trabalhe exclusivamente com os trechos de fontes locais autorizadas fornecidos no contexto e com a matriz vinculante do edital. Não use internet, memória externa ou conhecimento não demonstrado. Produza linguagem acadêmica, formal, objetiva e operacional, compatível com Subtenentes experientes. Cada questão deve possuir exatamente quatro alternativas A–D e uma única resposta integralmente correta. Confirme ou refute cada oração de todas as alternativas com a fonte. A dificuldade deve decorrer de discriminadores relevantes, sequência, regra e exceção ou distinção entre soluções próximas, nunca de ambiguidade, negativa dupla ou omissão. Se fonte, vigência, escopo, transcrição, unicidade ou ineditismo não puderem ser comprovados, responda com status QUARENTENA e explique a pendência; não invente conteúdo. Ao auditar, identifique falhas objetivamente, corrija somente o que tiver suporte expresso e repita toda a auditoria após a correção.`;

export const ESTRATEGIA_POR_DISCIPLINA: Record<string, string> = {
  "CPM — Código Penal Militar":
    "Explore tipificação, elementos delimitadores, competência, providências e sequências. Não misture a fundamentação com o CPPM, salvo relação processual comprovada.",
  "CPPM — Código de Processo Penal Militar":
    "Explore providências, prazos, competência e o processo de deserção. Não misture a fundamentação com o CPM, salvo relação processual comprovada.",
  "Redação Oficial":
    "Priorize adequação da comunicação, atributos, pronomes de tratamento, concordância, vocativo, padrão ofício, partes, formatação e escolha da espécie documental (capítulos I e II).",
  "Combate a Incêndio Urbano":
    "Varie comportamento do fogo, efeitos nocivos e técnicas de combate. Confira no PDF toda proposição dependente de diagrama, tabela, função ou cálculo.",
  NPCE:
    "Cobre competências, documentos, disposições temporais, serviços, plano de aula, avaliações, frequência, avaliação substitutiva, revisão e desligamento, somente nos recortes autorizados.",
  "Sistema de Comando de Incidentes":
    "Alterne princípios, instalações, estrutura, responsabilidades, ciclo de planejamento operacional, tarjetas e formulários. Não importe doutrina externa ao MOB local.",
  "Atendimento Pré-Hospitalar":
    "Priorize avaliação e decisão, biomecânica, RCP, ferimentos, esqueleto, queimaduras, parto e acidentes aquáticos — apenas nos dez capítulos retificados.",
  "Salvamento em Altura":
    "Explore vantagem mecânica, torres, gestão tática, amarração de macas e espaço confinado. Nunca use o capítulo 17.",
  "Salvamento Aquático":
    "Varie materiais/equipamentos, tipos de acidentes e fases do salvamento. Não importe conteúdo de APH para completar o MOB Guarda-Vidas.",
  "Salvamento Terrestre":
    "Varie materiais, nós, animais, árvores, elevadores, sistemas multiplicadores, espaço confinado e escadas. Confira tabelas, fórmulas, nós e imagens no PDF quando necessário.",
};

export function estrategiaDisciplina(disciplina: string): string {
  if (ESTRATEGIA_POR_DISCIPLINA[disciplina]) return ESTRATEGIA_POR_DISCIPLINA[disciplina];
  return "Legislação Específica: distribua pedagogicamente os assuntos entre as quatro leis, sem transformar a distribuição em subcota oficial. Na Lei nº 3.798/2021, respeite rigorosamente os capítulos e a seção autorizados.";
}

export const FORMATOS_COGNITIVOS_CBMTO = [
  "Caso prático",
  "Sequência operacional",
  "Julgamento de assertivas",
  "Identificação da alternativa INCORRETA",
  "Comparação técnica",
  "Literalidade qualificada",
] as const;
