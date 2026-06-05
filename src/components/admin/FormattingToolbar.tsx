import { Bold, Italic, Underline, Strikethrough } from "lucide-react";
import { RefObject } from "react";

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
}

const ACTIONS = [
  { icon: Bold, mark: "**", title: "Negrito" },
  { icon: Italic, mark: "*", title: "Itálico" },
  { icon: Underline, mark: "__", title: "Sublinhado" },
  { icon: Strikethrough, mark: "~~", title: "Tachado" },
] as const;

// Barra de formatação que envolve o texto selecionado em um <textarea> com a
// marcação leve interpretada pelo componente FormattedText.
export function FormattingToolbar({ textareaRef, value, onChange }: Props) {
  const wrap = (mark: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end) || "texto";
    const next = value.slice(0, start) + mark + selected + mark + value.slice(end);
    onChange(next);
    // Reposiciona o cursor envolvendo o texto destacado.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + mark.length, start + mark.length + selected.length);
    });
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {ACTIONS.map(({ icon: Icon, mark, title }) => (
        <button
          key={mark}
          type="button"
          onClick={() => wrap(mark)}
          title={title}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
      <span className="ml-1 text-[10px] text-muted-foreground">
        Use **negrito**, *itálico*, __sublinhado__. Espaços e quebras de linha são mantidos.
      </span>
    </div>
  );
}

export default FormattingToolbar;
