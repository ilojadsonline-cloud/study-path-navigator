import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BatchResult {
  batch: number;
  status: "pending" | "loading" | "success" | "error";
  validated?: number;
  ok?: number;
  fixed?: number;
  deleted?: number;
  error?: string;
}

const ValidarQuestoes = () => {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState({ validated: 0, ok: 0, fixed: 0, deleted: 0 });
  const [totalQuestoes, setTotalQuestoes] = useState<number | null>(null);
  const { toast } = useToast();

  const startValidation = async () => {
    setRunning(true);
    setTotals({ validated: 0, ok: 0, fixed: 0, deleted: 0 });

    // Get total count
    const { count } = await supabase.from("questoes").select("*", { count: "exact", head: true });
    const total = count || 0;
    setTotalQuestoes(total);

    const batchSize = 5;
    const numBatches = Math.ceil(total / batchSize);

    const batches: BatchResult[] = Array.from({ length: numBatches }, (_, i) => ({
      batch: i + 1,
      status: "pending" as const,
    }));
    setResults([...batches]);

    let runningTotals = { validated: 0, ok: 0, fixed: 0, deleted: 0 };

    for (let i = 0; i < numBatches; i++) {
      batches[i].status = "loading";
      setResults([...batches]);

      try {
        const offset = i * batchSize;
        const { data, error } = await supabase.functions.invoke("validate-questions", {
          body: { offset, limit: batchSize },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        batches[i].status = "success";
        batches[i].validated = data?.validated || 0;
        batches[i].ok = data?.ok || 0;
        batches[i].fixed = data?.fixed || 0;
        batches[i].deleted = data?.deleted || 0;

        runningTotals.validated += data?.validated || 0;
        runningTotals.ok += data?.ok || 0;
        runningTotals.fixed += data?.fixed || 0;
        runningTotals.deleted += data?.deleted || 0;
        setTotals({ ...runningTotals });
      } catch (err: any) {
        batches[i].status = "error";
        batches[i].error = err.message;
      }

      setResults([...batches]);
      // Wait between batches to avoid rate limits
      await new Promise((r) => setTimeout(r, 3000));
    }

    setRunning(false);
    toast({
      title: "Validação concluída!",
      description: `${runningTotals.validated} revisadas, ${runningTotals.fixed} corrigidas, ${runningTotals.deleted} excluídas.`,
    });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gradient-primary">Validação de Questões (IA)</h1>
        <p className="text-sm text-muted-foreground">
          A IA revisa cada questão do banco, corrige alternativas problemáticas, ajusta gabaritos e remove questões irrecuperáveis.
        </p>

        <button
          onClick={startValidation}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {running
            ? `Validando... (${totals.validated} revisadas)`
            : `Iniciar Validação${totalQuestoes !== null ? ` (${totalQuestoes} questões)` : ""}`}
        </button>

        {/* Summary */}
        {totals.validated > 0 && (
          <div className="flex gap-4 flex-wrap">
            <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="font-medium">{totals.ok} OK</span>
            </div>
            <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-primary" />
              <span className="font-medium">{totals.fixed} Corrigidas</span>
            </div>
            <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm">
              <Trash2 className="w-4 h-4 text-destructive" />
              <span className="font-medium">{totals.deleted} Excluídas</span>
            </div>
          </div>
        )}

        {/* Batch list */}
        {results.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 glass-card rounded-lg p-3 text-sm">
                {r.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                {r.status === "success" && <CheckCircle className="w-4 h-4 text-success" />}
                {r.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                {r.status === "pending" && <div className="w-4 h-4 rounded-full bg-muted" />}
                <span className="font-medium">Lote {r.batch}</span>
                {r.status === "success" && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    {r.ok} ok · {r.fixed} corrigidas · {r.deleted} excluídas
                  </span>
                )}
                {r.error && <span className="text-destructive text-xs ml-auto truncate max-w-xs">{r.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ValidarQuestoes;
