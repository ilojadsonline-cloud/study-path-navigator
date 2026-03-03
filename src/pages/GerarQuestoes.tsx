import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const disciplinas = [
  "Lei nº 2.578/2012",
  "LC nº 128/2021",
  "Lei nº 2.575/2012",
  "CPPM",
  "RDMETO",
];

interface BatchResult {
  disciplina: string;
  batch: number;
  status: "pending" | "loading" | "success" | "error";
  geradas?: number;
  error?: string;
}

const GerarQuestoes = () => {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [totalGeradas, setTotalGeradas] = useState(0);
  const { toast } = useToast();

  const generateAll = async () => {
    setRunning(true);
    setTotalGeradas(0);

    const batches: BatchResult[] = [];
    for (let d = 0; d < 5; d++) {
      for (let b = 0; b < 5; b++) {
        batches.push({ disciplina: disciplinas[d], batch: b + 1, status: "pending" });
      }
    }
    setResults([...batches]);

    let total = 0;
    for (let i = 0; i < batches.length; i++) {
      batches[i].status = "loading";
      setResults([...batches]);

      try {
        const { data, error } = await supabase.functions.invoke("generate-questions", {
          body: { disciplinaIndex: Math.floor(i / 5), batchSize: 20 },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        batches[i].status = "success";
        batches[i].geradas = data.geradas || 0;
        total += data.geradas || 0;
        setTotalGeradas(total);
      } catch (err: any) {
        batches[i].status = "error";
        batches[i].error = err.message;
      }

      setResults([...batches]);
      await new Promise(r => setTimeout(r, 2000));
    }

    setRunning(false);
    toast({ title: "Geração concluída!", description: `${total} questões geradas no total.` });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gradient-primary">Gerador de Questões (Admin)</h1>
        <p className="text-sm text-muted-foreground">
          Gera 500+ questões via IA baseadas no conteúdo programático do edital CHOA/CHOM 2024.
          São 5 disciplinas × 5 lotes × 20 questões.
        </p>

        <button
          onClick={generateAll}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {running ? `Gerando... (${totalGeradas} criadas)` : "Iniciar Geração de 500 Questões"}
        </button>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 glass-card rounded-lg p-3 text-sm">
                {r.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                {r.status === "success" && <CheckCircle className="w-4 h-4 text-success" />}
                {r.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                {r.status === "pending" && <div className="w-4 h-4 rounded-full bg-muted" />}
                <span className="font-medium">{r.disciplina}</span>
                <span className="text-muted-foreground">Lote {r.batch}</span>
                {r.geradas !== undefined && <span className="text-success ml-auto">+{r.geradas}</span>}
                {r.error && <span className="text-destructive text-xs ml-auto">{r.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GerarQuestoes;
