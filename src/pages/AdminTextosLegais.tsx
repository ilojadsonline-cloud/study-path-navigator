import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle, FileText, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LegalText {
  id: number;
  disciplina: string;
  lei_nome: string;
  content: string;
  updated_at: string;
}

const DISCIPLINES = [
  { disciplina: "Lei nº 2.578/2012", lei_nome: "Estatuto dos Policiais Militares e Bombeiros Militares do TO" },
  { disciplina: "LC nº 128/2021", lei_nome: "Organização Básica da PMTO" },
  { disciplina: "Lei nº 2.575/2012", lei_nome: "Promoções na PMTO" },
  { disciplina: "CPPM", lei_nome: "Código de Processo Penal Militar (Arts. 8-28 e 243-253)" },
  { disciplina: "RDMETO", lei_nome: "Regulamento Disciplinar Militar do TO (Decreto 4.994/2014)" },
  { disciplina: "Direito Penal Militar", lei_nome: "Código Penal Militar - Parte Geral (Arts. 1-135)" },
  { disciplina: "Lei Orgânica PM", lei_nome: "Lei Orgânica Nacional das Polícias Militares (Lei 14.751/2023)" },
];

const AdminTextosLegais = () => {
  const [texts, setTexts] = useState<LegalText[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchTexts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("discipline_legal_texts")
      .select("*")
      .order("disciplina");
    if (!error && data) setTexts(data as LegalText[]);
    setLoading(false);
  };

  useEffect(() => { fetchTexts(); }, []);

  const uploadText = async (disciplina: string, lei_nome: string) => {
    const content = pasteContent[disciplina];
    if (!content || content.trim().length < 100) {
      toast({ title: "Erro", description: "Cole o texto completo da lei (mínimo 100 caracteres).", variant: "destructive" });
      return;
    }

    setUploading(disciplina);
    try {
      const { data, error } = await supabase.functions.invoke("store-legal-text", {
        body: { disciplina, lei_nome, content: content.trim() },
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
    const { error } = await supabase
      .from("discipline_legal_texts")
      .delete()
      .eq("disciplina", disciplina);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído", description: `Texto de "${disciplina}" removido.` });
      fetchTexts();
    }
  };

  const getExisting = (disciplina: string) => texts.find((t) => t.disciplina === disciplina);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gradient-primary">Textos Legais (Base de Questões)</h1>
            <p className="text-sm text-muted-foreground mt-1">
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
                        <button
                          onClick={() => deleteText(disc.disciplina)}
                          className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-destructive font-medium">Não carregado</span>
                    )}
                  </div>

                  <textarea
                    value={pasteContent[disc.disciplina] || ""}
                    onChange={(e) =>
                      setPasteContent((prev) => ({ ...prev, [disc.disciplina]: e.target.value }))
                    }
                    placeholder={`Cole aqui o texto completo da ${disc.disciplina}...`}
                    className="w-full h-32 rounded-lg bg-secondary border-none text-xs p-3 text-foreground resize-y"
                  />

                  <button
                    onClick={() => uploadText(disc.disciplina, disc.lei_nome)}
                    disabled={uploading === disc.disciplina || !pasteContent[disc.disciplina]}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {uploading === disc.disciplina ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {existing ? "Atualizar Texto" : "Salvar Texto"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminTextosLegais;
