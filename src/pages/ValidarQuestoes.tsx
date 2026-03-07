import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, ShieldCheck, Trash2, Wrench, Pause, Play } from "lucide-react";
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
  const [paused, setPaused] = useState(false);
  const [totals, setTotals] = useState({ validated: 0, ok: 0, fixed: 0, deleted: 0 });
  const [totalQuestoes, setTotalQuestoes] = useState<number | null>(null);
  const [startOffset, setStartOffset] = useState(105); // Already validated 105 via API
  const { toast } = useToast();

  const startValidation = async () => {
    setRunning(true);
    setPaused(false);

    const { count } = await supabase.from("questoes").select("*", { count: "exact", head: true });
    const total = count || 0;
    setTotalQuestoes(total);

    const batchSize = 5;
    const remaining = total - startOffset;
    const numBatches = Math.ceil(remaining / batchSize);

    const batches: BatchResult[] = Array.from({ length: numBatches }, (_, i) => ({
      batch: i + 1,
      status: "pending" as const,
    }));
    setResults([...batches]);

    let runningTotals = { ...totals };

    for (let i = 0; i < numBatches; i++) {
      // Check if paused
      while (paused) {
        await new Promise((r) => setTimeout(r, 500));
      }

      batches[i].status = "loading";
      setResults([...batches]);

      try {
        const offset = startOffset + i * batchSize;
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

        // If rate limited or no credits, stop
        if (err.message?.includes("429") || err.message?.includes("402") || err.message?.includes("Rate limit") || err.message?.includes("Créditos")) {
          toast({ title: "Pausado", description: err.message, variant: "destructive" });
          break;
        }
      }

      setResults([...batches]);
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
          <br />
          <strong>Já validadas via API: {startOffset} questões.</strong>
        </p>

        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Iniciar do offset:</label>
          <input
            type="number"
            value={startOffset}
            onChange={(e) => setStartOffset(Number(e.target.value))}
            disabled={running}
            className="w-24 rounded-lg bg-secondary border-none text-sm p-2 text-foreground"
          />
        </div>

        <div className="flex gap-3">
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
        </div>

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
