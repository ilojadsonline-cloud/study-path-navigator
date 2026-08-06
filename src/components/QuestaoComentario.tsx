import { CheckCircle2, AlertTriangle, XCircle, Lightbulb, BookOpen, GraduationCap } from "lucide-react";
import { isHtmlContent, sanitizeRichHtml } from "@/lib/sanitize-html";
import { useCurso } from "@/contexts/CursoContext";
import { getQtdAlternativas } from "@/lib/edital-distribuicao";

type Section =
  | { type: "professor"; text: string }
  | { type: "intro"; text: string; letter?: string }
  | { type: "pegadinha"; text: string }
  | { type: "incorrect"; text: string; letter?: string }
  | { type: "alt"; text: string; letter: string }
  | { type: "tip"; text: string }
  | { type: "base"; text: string }
  | { type: "plain"; text: string };

// Remove markdown bold/italic markers, mantendo o texto limpo para renderização.
function stripMd(s: string): string {
  return (s || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*[-•]\s*/, "")
    .trim();
}

// Separa um trecho em (introdução + análises por alternativa), aceitando os dois
// formatos da banca: "A) ..." e "Alternativa A — ...". Evita falsos positivos do
// tipo "A alternativa D está correta porque..." (frase do comentário, não marcador).
function splitAlternativas(content: string): { intro: string; alts: { letter: string; text: string }[] } {
  const c = content || "";
  const markers: { index: number; end: number; letter: string }[] = [];
  let m: RegExpExecArray | null;

  // Formato "Alternativa A — ...", "Alternativa A: ...", "Alternativa A) ..."
  const re1 = /Alternativa\s+(\*{0,2})([A-E])\b\s*([—–\-:)\.]?)\s*/g;
  while ((m = re1.exec(c))) {
    const after = c.slice(m.index + m[0].length);
    const sep = m[3];
    const isMarker = (!!sep && /[—–\-:)]/.test(sep)) || /^(Correta|Incorreta)/i.test(after);
    if (isMarker) markers.push({ index: m.index, end: m.index + m[0].length, letter: m[2] });
  }

  // Formato "A) ...", "**A) ...**"
  const re2 = /(?<![A-Za-z])(\*{0,2})([A-E])\)\s*(\*{0,2})\s*/g;
  while ((m = re2.exec(c))) markers.push({ index: m.index, end: m.index + m[0].length, letter: m[2] });

  markers.sort((a, b) => a.index - b.index);
  const clean: typeof markers = [];
  for (const mk of markers) {
    if (!clean.length || mk.index >= clean[clean.length - 1].end) clean.push(mk);
  }

  if (!clean.length) return { intro: c.trim(), alts: [] };

  const intro = c.slice(0, clean[0].index).trim();
  const alts: { letter: string; text: string }[] = [];
  for (let i = 0; i < clean.length; i++) {
    const start = clean[i].end;
    const end = i + 1 < clean.length ? clean[i + 1].index : c.length;
    alts.push({ letter: clean[i].letter.toUpperCase(), text: c.slice(start, end).trim() });
  }
  return { intro, alts };
}

// ----- Formato NOVO (padrão banca de elite) -----
// "**Comentário do professor:** ... **Análise das alternativas:** **A)** ... **B)** ...
//  **Dica de prova:** ... **Base normativa:** ..."
// Também aceita variações sem o rótulo "Comentário do professor" (começando direto
// por "Gabarito X.") e com as alternativas embutidas no corpo do comentário.
function parseNovoFormato(raw: string): Section[] | null {
  const text = (raw || "").trim();
  const labelRe =
    /\*{0,2}\s*(Coment[áa]rio do professor|An[áa]lise das alternativas|Dica de prova|Base normativa)\s*:?\s*\*{0,2}/gi;

  const matches = [...text.matchAll(labelRe)];
  if (matches.length === 0) return null;

  const blocks: { label: string; content: string }[] = [];

  // Tudo que vem ANTES do primeiro rótulo é o comentário do professor (não pode ser perdido).
  const preamble = text.slice(0, matches[0].index ?? 0).trim();
  if (preamble) blocks.push({ label: "comentário do professor", content: preamble });

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const label = m[1].toLowerCase();
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    blocks.push({ label, content: text.slice(start, end).trim() });
  }

  const sections: Section[] = [];
  for (const b of blocks) {
    if (/coment[áa]rio do professor/.test(b.label)) {
      // O bloco do professor pode trazer a análise das alternativas embutida.
      const { intro, alts } = splitAlternativas(b.content);
      if (intro) sections.push({ type: "professor", text: stripMd(intro) });
      for (const a of alts) {
        const t = stripMd(a.text);
        if (t) sections.push({ type: "alt", letter: a.letter, text: t });
      }
    } else if (/an[áa]lise das alternativas/.test(b.label)) {
      const { intro, alts } = splitAlternativas(b.content);
      if (intro && stripMd(intro)) sections.push({ type: "plain", text: stripMd(intro) });
      for (const a of alts) {
        const t = stripMd(a.text);
        if (t) sections.push({ type: "alt", letter: a.letter, text: t });
      }
    } else if (/dica de prova/.test(b.label)) {
      if (b.content) sections.push({ type: "tip", text: stripMd(b.content) });
    } else if (/base normativa/.test(b.label)) {
      if (b.content) sections.push({ type: "base", text: stripMd(b.content) });
    }
  }

  return sections.length > 0 ? sections : null;
}

// ----- Formato ANTIGO (4 movimentos) -----
function parseFormatoAntigo(raw: string): Section[] {
  const text = (raw || "").trim();
  if (!text) return [];

  const splitRe =
    /(?=A pegadinha desta quest[ãa]o|A alternativa [A-E] est[áa]|Lembre-se:)/g;
  const chunks = text
    .split(splitRe)
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunks.length <= 1) {
    return [{ type: "plain", text: stripMd(text) }];
  }

  return chunks.map((chunk): Section => {
    if (/^A pegadinha desta quest/i.test(chunk)) {
      return { type: "pegadinha", text: stripMd(chunk) };
    }
    if (/^Lembre-se:/i.test(chunk)) {
      return { type: "tip", text: stripMd(chunk.replace(/^Lembre-se:\s*/i, "")) };
    }
    const incorrectMatch = chunk.match(/^A alternativa ([A-E]) est[áa]/i);
    if (incorrectMatch) {
      return { type: "incorrect", text: stripMd(chunk), letter: incorrectMatch[1].toUpperCase() };
    }
    const introMatch = chunk.match(/alternativa correta é a ([A-E])/i);
    return { type: "intro", text: stripMd(chunk), letter: introMatch?.[1]?.toUpperCase() };
  });
}

function parseComentario(raw: string): Section[] {
  if (!raw || !raw.trim()) return [];
  return parseNovoFormato(raw) ?? parseFormatoAntigo(raw);
}

export function QuestaoComentario({ comentario }: { comentario: string }) {
  // Comentários criados pelo editor de texto rico são HTML — renderiza sanitizado.
  if (isHtmlContent(comentario)) {
    return (
      <div
        className="rich-html text-sm text-foreground/85 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(comentario) }}
      />
    );
  }

  const sections = parseComentario(comentario);

  if (sections.length === 0) return null;

  if (sections.length === 1 && sections[0].type === "plain") {
    return (
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
        {sections[0].text}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((s, i) => {
        if (s.type === "professor") {
          return (
            <div
              key={i}
              className="flex gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3"
            >
              <GraduationCap className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-success">
                  Comentário do professor
                </span>
                <p className="text-sm text-foreground/90 leading-relaxed">{s.text}</p>
              </div>
            </div>
          );
        }
        if (s.type === "intro") {
          return (
            <div
              key={i}
              className="flex gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3"
            >
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <div className="space-y-1">
                {s.letter && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-success">
                    Gabarito · alternativa <span translate="no">{s.letter}</span>
                  </span>
                )}
                <p className="text-sm text-foreground/90 leading-relaxed">{s.text}</p>
              </div>
            </div>
          );
        }
        if (s.type === "pegadinha") {
          return (
            <div
              key={i}
              className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3"
            >
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90 leading-relaxed">{s.text}</p>
            </div>
          );
        }
        if (s.type === "incorrect" || s.type === "alt") {
          return (
            <div key={i} className="flex gap-2.5 rounded-lg bg-secondary/40 p-3">
              <XCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80 leading-relaxed">
                {s.letter && (
                  <span
                    className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary"
                    translate="no"
                  >
                    {s.letter}
                  </span>
                )}
                {s.type === "incorrect"
                  ? s.text.replace(/^A alternativa [A-E]\s*/i, "")
                  : s.text}
              </p>
            </div>
          );
        }
        if (s.type === "tip") {
          return (
            <div
              key={i}
              className="flex gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3"
            >
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Dica de prova
                </span>
                <p className="text-sm text-foreground/90 leading-relaxed">{s.text}</p>
              </div>
            </div>
          );
        }
        if (s.type === "base") {
          return (
            <div
              key={i}
              className="flex gap-2.5 rounded-lg border border-border bg-muted/40 p-3"
            >
              <BookOpen className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Base normativa
                </span>
                <p className="text-sm text-foreground/80 leading-relaxed">{s.text}</p>
              </div>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-foreground/80 leading-relaxed">
            {s.text}
          </p>
        );
      })}
    </div>
  );
}

export default QuestaoComentario;
