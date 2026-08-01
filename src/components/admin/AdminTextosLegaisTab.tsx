import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle, FileText, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";

interface LegalText {
  id: number;
  disciplina: string;
  lei_nome: string;
  content: string;
  updated_at: string;
}

import { getDisciplinasFonte } from "@/lib/disciplinas-geracao";

export default function AdminTextosLegaisContent() {
  const { cursoId, cursoSlug, cursoAtivo } = useCurso();
  const DISCIPLINES = getDisciplinasFonte(cursoSlug);
  const [texts, setTexts] = useState<LegalText[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchTexts = async () => {
    setLoading(true);
    let query = supabase
      .from("discipline_legal_texts")
      .select("*")
      .order("disciplina");
    const filter = cursoOrFilter(cursoId, cursoSlug);
    if (filter) query = query.or(filter);
    const { data, error } = await query;
    if (!error && data) setTexts(data as LegalText[]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTexts(); }, [cursoId]);

  const uploadText = async (disciplina: string, lei_nome: string) => {
    const content = pasteContent[disciplina];
    if (!content || content.trim().length < 100) {
      toast({ title: "Erro", description: "Cole o texto completo da lei (mínimo 100 caracteres).", variant: "destructive" });
      return;
    }
    setUploading(disciplina);
    try {
      const { data, error } = await supabase.functions.invoke("store-legal-text", {
        body: { disciplina, lei_nome, content: content.trim(), curso_id: cursoId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Sucesso!", description: `Texto legal de "${disciplina}" salvo com sucesso.` });
      setPasteContent((prev) => ({ ...prev, [disciplina]: "" }));
      fetchTexts();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setUploading(null);
  };

  const deleteText = async (disciplina: string) => {
    let delQuery = supabase.from("discipline_legal_texts").delete().eq("disciplina", disciplina);
    const delFilter = cursoOrFilter(cursoId, cursoSlug);
    if (delFilter) delQuery = delQuery.or(delFilter);
    const { error } = await delQuery;
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído", description: `Texto de "${disciplina}" removido.` });
      fetchTexts();
    }
  };

  const getExisting = (disciplina: string) => texts.find((t) => t.disciplina === disciplina);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold mb-1">Textos Legais (Base de Questões)</h2>
          <p className="text-sm text-muted-foreground">
            Cole o texto integral de cada lei para que a geração e validação de questões utilizem exclusivamente esse conteúdo.
          </p>
        </div>
        <button onClick={fetchTexts} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {DISCIPLINES.map((disc) => {
            const existing = getExisting(disc.disciplina);
            return (
              <div key={disc.disciplina} className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-sm">{disc.disciplina}</h3>
                      <p className="text-xs text-muted-foreground">{disc.lei_nome}</p>
                    </div>
                  </div>
                  {existing ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Carregado ({(existing.content.length / 1024).toFixed(0)}KB)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(existing.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                      <button onClick={() => deleteText(disc.disciplina)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-destructive font-medium">Não carregado</span>
                  )}
                </div>

                <textarea
                  value={pasteContent[disc.disciplina] || ""}
                  onChange={(e) => setPasteContent((prev) => ({ ...prev, [disc.disciplina]: e.target.value }))}
                  placeholder={`Cole aqui o texto completo da ${disc.disciplina}...`}
                  className="w-full h-32 rounded-lg bg-secondary border-none text-xs p-3 text-foreground resize-y"
                />

                <button
                  onClick={() => uploadText(disc.disciplina, disc.lei_nome)}
                  disabled={uploading === disc.disciplina || !pasteContent[disc.disciplina]}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {uploading === disc.disciplina ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {existing ? "Atualizar Texto" : "Salvar Texto"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
