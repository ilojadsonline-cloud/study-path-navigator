import { normalizarDisciplina, getQtdAlternativas } from "./edital-distribuicao";

export interface ParsedQuestao {
  disciplina: string;
  assunto: string;
  dificuldade: string;
  banca: string | null;
  ano: number | null;
  prova: string | null;
  enunciado: string;
  alternativas: [string, string, string, string, string];
  gabarito: number; // 0-4
  comentario: string;
}

export interface SkippedQuestao {
  bloco: number;
  motivo: string;
  preview: string;
}

export interface ParseResult {
  validas: ParsedQuestao[];
  ignoradas: SkippedQuestao[];
}

const DIFICULDADES = ["Fácil", "Médio", "Difícil"];

// Remove acentos e caixa para comparar rótulos.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const LETTER_TO_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };

type Field =
  | "disciplina"
  | "assunto"
  | "dificuldade"
  | "banca"
  | "ano"
  | "prova"
  | "enunciado"
  | "gabarito"
  | "comentario"
  | null;

function fieldFromLabel(label: string): Field {
  const n = norm(label);
  if (n === "disciplina" || n === "materia" || n === "disciplina/materia") return "disciplina";
  if (n === "assunto" || n === "tema") return "assunto";
  if (n === "dificuldade" || n === "nivel") return "dificuldade";
  if (n === "banca") return "banca";
  if (n === "ano") return "ano";
  if (n === "prova" || n === "concurso") return "prova";
  if (n === "enunciado" || n === "questao" || n === "pergunta" || n === "comando") return "enunciado";
  if (n === "gabarito" || n === "resposta" || n === "resposta correta") return "gabarito";
  if (n === "comentario" || n === "justificativa" || n === "explicacao" || n === "comentarios") return "comentario";
  return null;
}

// Detecta alternativa do tipo "A) texto", "A. texto", "A - texto", "(A) texto"
function altMatch(line: string): { idx: number; text: string } | null {
  const m = line.match(/^\s*\(?\s*([A-Ea-e])\s*[\)\.\-–:]\s+(.*)$/);
  if (!m) return null;
  return { idx: LETTER_TO_INDEX[m[1].toLowerCase()], text: m[2].trim() };
}

// Detecta "Rótulo: valor"
function labelMatch(line: string): { field: Field; rest: string } | null {
  const m = line.match(/^\s*([A-Za-zÀ-ÿ ]{3,30})\s*:\s*(.*)$/);
  if (!m) return null;
  const field = fieldFromLabel(m[1]);
  if (!field) return null;
  return { field, rest: m[2] };
}

export function parseMarkdownQuestoes(markdown: string, cursoSlug?: string | null): ParseResult {
  const qtdAlternativas = getQtdAlternativas(cursoSlug);
  const validas: ParsedQuestao[] = [];
  const ignoradas: SkippedQuestao[] = [];

  // Separa blocos por linhas contendo apenas --- (ou === ou ***)
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*[-=*_]{3,}\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  blocks.forEach((block, i) => {
    const bloco = i + 1;
    const preview = block.slice(0, 80).replace(/\n/g, " ");

    const data: Record<string, string> = {};
    const alts: (string | null)[] = [null, null, null, null, null];
    let current: Field = null;
    let inAlternatives = false;
    let currentAlt = -1;

    const lines = block.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/g, "");
      if (!line.trim()) {
        // Linha em branco: mantém contexto (parágrafo) para enunciado/comentário
        if (current === "enunciado" || current === "comentario") {
          data[current] = (data[current] || "") + "\n";
        }
        continue;
      }

      const alt = altMatch(line);
      if (alt) {
        inAlternatives = true;
        current = null;
        currentAlt = alt.idx;
        alts[alt.idx] = alt.text;
        continue;
      }

      const lbl = labelMatch(line);
      if (lbl) {
        inAlternatives = false;
        currentAlt = -1;
        current = lbl.field;
        if (lbl.field) data[lbl.field] = lbl.rest;
        continue;
      }

      // Continuação de campo multilinha
      if (inAlternatives && currentAlt >= 0) {
        alts[currentAlt] = ((alts[currentAlt] || "") + " " + line.trim()).trim();
      } else if (current === "enunciado" || current === "comentario") {
        data[current] = ((data[current] || "") + "\n" + line).trimStart();
      } else if (current && data[current] !== undefined) {
        data[current] = (data[current] + " " + line.trim()).trim();
      }
    }

    // ── Validação (padrão do banco) ──
    const disciplina = normalizarDisciplina(data.disciplina || "", cursoSlug);
    if (!disciplina) {
      ignoradas.push({ bloco, motivo: `Disciplina inválida ou não reconhecida: "${(data.disciplina || "").trim() || "(vazia)"}"`, preview });
      return;
    }

    const enunciado = (data.enunciado || "").trim();
    if (enunciado.replace(/<[^>]+>/g, "").trim().length < 10) {
      ignoradas.push({ bloco, motivo: "Enunciado ausente ou muito curto", preview });
      return;
    }

    // Provas com 4 alternativas (ex.: CHOA BM/CBMTO) não exigem a alternativa E.
    const obrigatorias = alts.slice(0, qtdAlternativas);
    const alternativasOk = obrigatorias.every((a) => a !== null && a!.trim().length > 0);
    if (!alternativasOk) {
      const faltando = obrigatorias.map((a, idx) => (a ? null : "ABCDE"[idx])).filter(Boolean).join(", ");
      ignoradas.push({ bloco, motivo: `Alternativa(s) ausente(s): ${faltando}`, preview });
      return;
    }

    const gabRaw = norm(data.gabarito || "");
    const gabLetter = gabRaw.match(qtdAlternativas === 4 ? /[a-d]/ : /[a-e]/);
    if (!gabLetter) {
      ignoradas.push({ bloco, motivo: `Gabarito ausente ou inválido (use ${qtdAlternativas === 4 ? "A, B, C ou D" : "A, B, C, D ou E"})`, preview });
      return;
    }
    const gabarito = LETTER_TO_INDEX[gabLetter[0]];

    const comentario = (data.comentario || "").trim();
    if (comentario.replace(/<[^>]+>/g, "").trim().length < 5) {
      ignoradas.push({ bloco, motivo: "Comentário/justificativa ausente", preview });
      return;
    }

    // Campos opcionais
    let dificuldade = "Médio";
    const difNorm = norm(data.dificuldade || "");
    if (difNorm.includes("facil")) dificuldade = "Fácil";
    else if (difNorm.includes("dific")) dificuldade = "Difícil";
    else if (difNorm.includes("medio")) dificuldade = "Médio";
    if (!DIFICULDADES.includes(dificuldade)) dificuldade = "Médio";

    const anoNum = data.ano ? parseInt(data.ano.replace(/\D/g, ""), 10) : NaN;

    validas.push({
      disciplina,
      assunto: (data.assunto || "Geral").trim() || "Geral",
      dificuldade,
      banca: data.banca?.trim() || null,
      ano: Number.isFinite(anoNum) && anoNum > 1900 ? anoNum : null,
      prova: data.prova?.trim() || null,
      enunciado,
      alternativas: [
        alts[0]!.trim(),
        alts[1]!.trim(),
        alts[2]!.trim(),
        alts[3]!.trim(),
        (alts[4] || "").trim(),
      ],
      gabarito,
      comentario,
    });
  });

  return { validas, ignoradas };
}

const MODELO_MARKDOWN_PMTO = `Disciplina: CPPM
Assunto: Inquérito Policial Militar
Dificuldade: Médio
Banca: PMTO
Ano: 2026
Prova: CHOA
Enunciado: De acordo com o Código de Processo Penal Militar, o inquérito policial militar é...
A) primeira alternativa
B) segunda alternativa
C) terceira alternativa
D) quarta alternativa
E) quinta alternativa
Gabarito: C
Comentário: A alternativa C está correta porque... (cite a base normativa).

---

Disciplina: Língua Portuguesa
Assunto: Interpretação de texto
Enunciado: Leia o texto e responda...
A) ...
B) ...
C) ...
D) ...
E) ...
Gabarito: A
Comentário: ...
`;

const MODELO_MARKDOWN_CBMTO = `Disciplina: Combate a Incêndio Urbano
Assunto: Técnicas de combate
Dificuldade: Médio
Banca: CBMTO
Ano: 2026
Prova: CHOA BM
Enunciado: Sobre as técnicas de combate a incêndio em ambiente confinado, assinale a alternativa correta.
A) primeira alternativa
B) segunda alternativa
C) terceira alternativa
D) quarta alternativa
Gabarito: C
Comentário: A alternativa C está correta porque... (cite a base normativa/manual).

---

Disciplina: Atendimento Pré-Hospitalar
Assunto: Avaliação da vítima
Enunciado: De acordo com o Manual de APH do CBMTO...
A) ...
B) ...
C) ...
D) ...
Gabarito: A
Comentário: ...
`;

export const MODELO_MARKDOWN = MODELO_MARKDOWN_PMTO;

export function getModeloMarkdown(cursoSlug?: string | null): string {
  return (cursoSlug || "pmto").toLowerCase() === "cbmto" ? MODELO_MARKDOWN_CBMTO : MODELO_MARKDOWN_PMTO;
}
