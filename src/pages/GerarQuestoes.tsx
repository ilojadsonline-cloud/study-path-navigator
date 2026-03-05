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
  "Direito Penal Militar",
  "Lei Orgânica PM",
  "POP",
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

    // Each discipline gets ~58 more questions (460/8 ≈ 58), so 6 batches of 10 each
    const batchesPerDiscipline = 6;
    const batchSize = 10;

    const batches: BatchResult[] = [];
    for (let d = 0; d < disciplinas.length; d++) {
      for (let b = 0; b < batchesPerDiscipline; b++) {
        batches.push({ disciplina: disciplinas[d], batch: b + 1, status: "pending" });
      }
    }
    setResults([...batches]);

    let total = 0;
    for (let i = 0; i < batches.length; i++) {
      batches[i].status = "loading";
      setResults([...batches]);

      try {
        const discIndex = Math.floor(i / batchesPerDiscipline);
        const { data, error } = await supabase.functions.invoke("generate-questions-batch", {
          body: { disciplina_index: discIndex, batch_size: batchSize },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const inserted = data?.inserted || data?.generated || 0;
        batches[i].status = "success";
        batches[i].geradas = inserted;
        total += inserted;
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
          Gera ~480 questões via IA para alcançar 1000 no banco. São 8 disciplinas × 6 lotes × 10 questões.
        </p>

        <button
          onClick={generateAll}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {running ? `Gerando... (${totalGeradas} criadas)` : "Iniciar Geração (~480 Questões)"}
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
