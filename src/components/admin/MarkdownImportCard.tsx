import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Loader2, ChevronDown, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import { parseMarkdownQuestoes, MODELO_MARKDOWN, type ParseResult } from "@/lib/markdown-questoes-parser";

interface Props {
  onCreated?: () => void;
}

export function MarkdownImportCard({ onCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);

  const analise = useMemo(() => (texto.trim() ? parseMarkdownQuestoes(texto) : null), [texto]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setTexto(content);
    setParsed(null);
    e.target.value = "";
  };

  const importar = async () => {
    const result = parseMarkdownQuestoes(texto);
    setParsed(result);
    if (result.validas.length === 0) {
      toast({ title: "Nenhuma questão válida", description: "Verifique o formato do Markdown.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const rows = result.validas.map((q) => ({
      disciplina: q.disciplina,
      assunto: q.assunto,
      dificuldade: q.dificuldade,
      banca: q.banca,
      prova: q.prova,
      ano: q.ano,
      enunciado: q.enunciado,
      alt_a: q.alternativas[0],
      alt_b: q.alternativas[1],
      alt_c: q.alternativas[2],
      alt_d: q.alternativas[3],
      alt_e: q.alternativas[4],
      gabarito: q.gabarito,
      comentario: q.comentario,
      origem: "manual",
      audit_status: "approved",
    }));
    const { error } = await supabase.from("questoes").insert(rows as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Importação concluída!",
      description: `${result.validas.length} questões adicionadas${result.ignoradas.length ? ` • ${result.ignoradas.length} ignoradas` : ""}.`,
    });
    setTexto("");
    setParsed(null);
    onCreated?.();
  };

  const live = parsed || analise;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileUp className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Importar questões via Markdown</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-4">
          <p className="text-xs text-muted-foreground">
            Cole o conteúdo ou suba um arquivo <code>.md</code>. Cada questão separada por uma linha com <code>---</code>.
            Questões fora do padrão são automaticamente ignoradas. Campos: Disciplina, Assunto, Dificuldade, Banca, Ano, Prova,
            Enunciado, alternativas A) a E), Gabarito (A–E) e Comentário.
          </p>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium cursor-pointer hover:bg-secondary/70">
              <Upload className="w-3.5 h-3.5" /> Carregar arquivo .md
              <input type="file" accept=".md,.markdown,.txt" className="hidden" onChange={handleFile} />
            </label>
            <button
              onClick={() => setTexto(MODELO_MARKDOWN)}
              className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium hover:bg-secondary/70"
            >
              Inserir modelo de exemplo
            </button>
          </div>

          <Textarea
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setParsed(null); }}
            placeholder="Cole aqui o Markdown das questões…"
            className="min-h-[220px] font-mono text-xs"
          />

          {live && texto.trim() && (
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 text-success">
                <CheckCircle2 className="w-3.5 h-3.5" /> {live.validas.length} válidas
              </span>
              {live.ignoradas.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" /> {live.ignoradas.length} ignoradas
                </span>
              )}
            </div>
          )}

          {live && live.ignoradas.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg bg-secondary/40 p-3 space-y-1.5">
              {live.ignoradas.map((ig) => (
                <p key={ig.bloco} className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-warning">Bloco {ig.bloco}:</span> {ig.motivo}
                  <span className="opacity-60"> — “{ig.preview}…”</span>
                </p>
              ))}
            </div>
          )}

          <Button onClick={importar} disabled={saving || !live || live.validas.length === 0} className="gradient-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
            Importar {live ? live.validas.length : 0} questões
          </Button>
        </div>
      )}
    </div>
  );
}
