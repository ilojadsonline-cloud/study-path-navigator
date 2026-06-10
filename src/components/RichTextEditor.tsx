import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeRichHtml } from "@/lib/sanitize-html";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  allowImage?: boolean;
  className?: string;
}

type Tool = { icon: typeof Bold; cmd: string; arg?: string; title: string };

const FORMAT_TOOLS: Tool[] = [
  { icon: Bold, cmd: "bold", title: "Negrito" },
  { icon: Italic, cmd: "italic", title: "Itálico" },
  { icon: Underline, cmd: "underline", title: "Sublinhado" },
  { icon: Strikethrough, cmd: "strikeThrough", title: "Tachado" },
];

const ALIGN_TOOLS: Tool[] = [
  { icon: AlignLeft, cmd: "justifyLeft", title: "Alinhar à esquerda" },
  { icon: AlignCenter, cmd: "justifyCenter", title: "Centralizar" },
  { icon: AlignRight, cmd: "justifyRight", title: "Alinhar à direita" },
  { icon: AlignJustify, cmd: "justifyFull", title: "Justificar" },
];

// Editor de texto rico (WYSIWYG) que gera HTML sanitizado.
// Suporta negrito, itálico, sublinhado, tachado, alinhamento e inserção de imagem.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 100,
  allowImage = false,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Sincroniza o valor externo apenas quando o editor não está em foco
  // (evita reposicionar o cursor enquanto o usuário digita).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = value || "";
    if (el.innerHTML !== incoming && document.activeElement !== el) {
      el.innerHTML = incoming;
    }
  }, [value]);

  const emit = () => {
    if (ref.current) onChange(sanitizeRichHtml(ref.current.innerHTML));
  };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const handleImagePick = () => fileRef.current?.click();

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "O limite é 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `enunciados/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("questao-imagens")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;

      // URL assinada de longa duração (10 anos) — funciona em bucket privado.
      const { data, error: signErr } = await supabase.storage
        .from("questao-imagens")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !data?.signedUrl) throw signErr || new Error("Falha ao gerar URL");

      ref.current?.focus();
      document.execCommand("insertImage", false, data.signedUrl);
      emit();
    } catch (err: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("rounded-lg border border-input bg-background overflow-hidden", className)}>
      <div className="flex items-center gap-0.5 flex-wrap border-b border-border bg-secondary/40 p-1">
        {FORMAT_TOOLS.map(({ icon: Icon, cmd, arg, title }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd, arg)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        {ALIGN_TOOLS.map(({ icon: Icon, cmd, title }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        {allowImage && (
          <>
            <span className="w-px h-5 bg-border mx-1" />
            <button
              type="button"
              title="Inserir imagem"
              disabled={uploading}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleImagePick}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
          </>
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        suppressContentEditableWarning
        className="rte-editor px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring [&_img]:my-2 [&_img]:rounded-md"
        style={{ minHeight }}
      />
    </div>
  );
}

export default RichTextEditor;
