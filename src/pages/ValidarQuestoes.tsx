import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, ShieldCheck, Trash2, Wrench, RefreshCw } from "lucide-react";
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
  const [afterId, setAfterId] = useState(0);
  const { toast } = useToast();

  const startValidation = async () => {
    setRunning(true);
    setTotals({ validated: 0, ok: 0, fixed: 0, deleted: 0 });

    const { count, error: countError } = await supabase
      .from("questoes")
      .select("*", { count: "exact", head: true });

    if (countError) {
      setRunning(false);
      toast({ title: "Erro ao contar questões", description: countError.message, variant: "destructive" });
      return;
    }

    const total = count || 0;
    setTotalQuestoes(total);

    const batchSize = 25;
    const numBatches = Math.max(1, Math.ceil(total / batchSize));

    const batches: BatchResult[] = Array.from({ length: numBatches }, (_, i) => ({
      batch: i + 1,
      status: "pending" as const,
    }));
    setResults([...batches]);

    let runningTotals = { validated: 0, ok: 0, fixed: 0, deleted: 0 };
    let cursor = afterId;

    for (let i = 0; i < numBatches; i++) {
      batches[i].status = "loading";
      setResults([...batches]);

      try {
        const { data, error } = await supabase.functions.invoke("validate-questions", {
          body: { after_id: cursor, limit: batchSize, mode: "rules", auto_delete: true },
        });

        if (error) throw error;
        if (data?.paused) {
          toast({ title: "Pausado", description: data?.error || "Validação pausada.", variant: "destructive" });
          break;
        }
        if (data?.error) throw new Error(data.error);

        if ((data?.validated || 0) === 0) {
          batches[i].status = "success";
          batches[i].validated = 0;
          setResults([...batches]);
          break;
        }

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

        const nextCursor = data?.last_id || cursor;
        if (nextCursor === cursor) break;
        cursor = nextCursor;
        setAfterId(cursor);
      } catch (err: any) {
        batches[i].status = "error";
        batches[i].error = err.message;

        if (
          err.message?.includes("429") ||
          err.message?.includes("402") ||
          err.message?.includes("Rate limit") ||
          err.message?.includes("Créditos")
        ) {
          toast({ title: "Pausado", description: err.message, variant: "destructive" });
        }

        setResults([...batches]);
        break;
      }

      setResults([...batches]);
      await new Promise((r) => setTimeout(r, 600));
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
          A IA revisa cada questão do banco, corrige alternativas problemáticas, ajusta gabaritos e remove questões
          irrecuperáveis.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted-foreground">Começar após ID:</label>
          <input
            type="number"
            value={afterId}
            onChange={(e) => setAfterId(Math.max(0, Number(e.target.value) || 0))}
            disabled={running}
            className="w-28 rounded-lg bg-secondary border-none text-sm p-2 text-foreground"
          />
          {!running && afterId > 0 && (
            <button
              onClick={() => setAfterId(0)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reiniciar
            </button>
          )}
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
