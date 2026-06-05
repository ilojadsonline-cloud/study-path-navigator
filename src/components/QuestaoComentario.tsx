import { CheckCircle2, AlertTriangle, XCircle, Lightbulb, BookOpen } from "lucide-react";

type Section =
  | { type: "intro"; text: string; letter?: string }
  | { type: "pegadinha"; text: string }
  | { type: "incorrect"; text: string; letter?: string }
  | { type: "tip"; text: string }
  | { type: "plain"; text: string };

// Quebra o comentário gerado em seções legíveis. O texto segue o padrão:
// "A alternativa correta é a X, pois ..." / "A pegadinha desta questão ..."
// / "A alternativa Y está incorreta ..." (uma por distrator) / "Lembre-se: ..."
function parseComentario(raw: string): Section[] {
  const text = (raw || "").trim();
  if (!text) return [];

  const splitRe =
    /(?=A pegadinha desta quest[ãa]o|A alternativa [A-E] est[áa]|Lembre-se:)/g;
  const chunks = text
    .split(splitRe)
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunks.length <= 1) {
    return [{ type: "plain", text }];
  }

  return chunks.map((chunk): Section => {
    if (/^A pegadinha desta quest/i.test(chunk)) {
      return { type: "pegadinha", text: chunk };
    }
    if (/^Lembre-se:/i.test(chunk)) {
      return { type: "tip", text: chunk.replace(/^Lembre-se:\s*/i, "") };
    }
    const incorrectMatch = chunk.match(/^A alternativa ([A-E]) est[áa]/i);
    if (incorrectMatch) {
      return { type: "incorrect", text: chunk, letter: incorrectMatch[1].toUpperCase() };
    }
    const introMatch = chunk.match(/alternativa correta é a ([A-E])/i);
    return { type: "intro", text: chunk, letter: introMatch?.[1]?.toUpperCase() };
  });
}

export function QuestaoComentario({ comentario }: { comentario: string }) {
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
        if (s.type === "incorrect") {
          return (
            <div key={i} className="flex gap-2.5 rounded-lg bg-secondary/40 p-3">
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80 leading-relaxed">
                {s.letter && (
                  <span
                    className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-[11px] font-bold text-destructive"
                    translate="no"
                  >
                    {s.letter}
                  </span>
                )}
                {s.text.replace(/^A alternativa [A-E]\s*/i, "")}
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
                  Lembre-se
                </span>
                <p className="text-sm text-foreground/90 leading-relaxed">{s.text}</p>
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
