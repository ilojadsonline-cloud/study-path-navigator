import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, CheckCircle, AlertCircle, ShieldCheck, Trash2, Wrench, RefreshCw, Brain, Zap, StopCircle,
} from "lucide-react";

interface BatchResult {
  batch: number;
  status: "pending" | "loading" | "success" | "error";
  validated?: number;
  ok?: number;
  fixed?: number;
  deleted?: number;
  error?: string;
  details?: Array<{ id: number; status: string; motivo: string }>;
}

export function AdminValidarTab() {
  const { toast } = useToast();
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState({ validated: 0, ok: 0, fixed: 0, deleted: 0 });
  const [totalQuestoes, setTotalQuestoes] = useState<number | null>(null);
  const [afterId, setAfterId] = useState(0);
  const [mode, setMode] = useState<"rules" | "ai">("rules");
  const [showDetails, setShowDetails] = useState<number | null>(null);
  const stopRef = useRef(false);

  const runValidation = async (selectedMode: "rules" | "ai") => {
    setRunning(true);
    stopRef.current = false;
    setResults([]);
    setTotals({ validated: 0, ok: 0, fixed: 0, deleted: 0 });

    const { count } = await supabase.from("questoes").select("*", { count: "exact", head: true });
    setTotalQuestoes(count || 0);

    const batchSize = selectedMode === "ai" ? 5 : 20;
    const batches: BatchResult[] = [];
    let runningTotals = { validated: 0, ok: 0, fixed: 0, deleted: 0 };
    let cursor = afterId;
    let batchNum = 0;
    let consecutiveEmpty = 0;

    while (!stopRef.current) {
      batchNum++;
      const batch: BatchResult = { batch: batchNum, status: "loading" };
      batches.push(batch);
      setResults([...batches]);

      try {
        const { data, error } = await supabase.functions.invoke("validate-questions", {
          body: { after_id: cursor, limit: batchSize, mode: selectedMode },
        });

        if (error) throw error;

        if (data?.paused) {
          batch.status = "error";
          batch.error = data?.error || "Pausado pelo rate limit";
          toast({ title: "Pausado", description: data?.error, variant: "destructive" });
          setResults([...batches]);
          break;
        }

        if (data?.error) throw new Error(data.error);

        const validated = data?.validated || 0;

        if (validated === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) {
            batch.status = "success";
            batch.validated = 0;
            setResults([...batches]);
            break;
          }
          cursor = (data?.last_id || cursor) + 1;
          batch.status = "success";
          batch.validated = 0;
          setResults([...batches]);
          await new Promise(r => setTimeout(r, 300));
          continue;
        }

        consecutiveEmpty = 0;
        batch.status = "success";
        batch.validated = validated;
        batch.ok = data?.ok || 0;
        batch.fixed = data?.fixed || 0;
        batch.deleted = data?.deleted || 0;
        batch.details = data?.details || [];

        runningTotals.validated += validated;
        runningTotals.ok += data?.ok || 0;
        runningTotals.fixed += data?.fixed || 0;
        runningTotals.deleted += data?.deleted || 0;
        setTotals({ ...runningTotals });

        const nextCursor = data?.last_id || cursor;
        cursor = nextCursor === cursor ? cursor + batchSize : nextCursor;
        setAfterId(cursor);
      } catch (err: any) {
        batch.status = "error";
        batch.error = err.message;
        setResults([...batches]);
        break;
      }

      setResults([...batches]);
      await new Promise(r => setTimeout(r, selectedMode === "ai" ? 2000 : 600));
    }

    setRunning(false);
    toast({
      title: stopRef.current ? "Validação interrompida" : "Validação concluída!",
      description: `${runningTotals.validated} revisadas · ${runningTotals.ok} OK · ${runningTotals.fixed} corrigidas · ${runningTotals.deleted} excluídas`,
    });
  };

  const progressPercent = totalQuestoes && totalQuestoes > 0 ? Math.min(100, Math.round((totals.validated / totalQuestoes) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">Validação & Reparo de Questões</h2>
        <p className="text-sm text-muted-foreground">
          <strong>Regras:</strong> verificação estrutural + confronto literal de artigos. Rápido, sem custo.
          <br />
          <strong>Reparar (IA Groq):</strong> reescreve questões incorretas usando o texto legal. Sem créditos Lovable.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("rules")}
          disabled={running}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            mode === "rules" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Regras (Limpar)
        </button>
        <button
          onClick={() => setMode("ai")}
          disabled={running}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            mode === "ai" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Brain className="w-3.5 h-3.5" /> Reparar com IA
        </button>
      </div>

      {/* Cursor control */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground">Começar após ID:</label>
        <input
          type="number"
          value={afterId}
          onChange={(e) => setAfterId(Math.max(0, Number(e.target.value) || 0))}
          disabled={running}
          className="w-28 rounded-lg bg-secondary border-none text-sm p-2 text-foreground"
        />
        {totalQuestoes !== null && (
          <span className="text-xs text-muted-foreground">({totalQuestoes} questões no banco)</span>
        )}
        {!running && afterId > 0 && (
          <Button variant="outline" size="sm" onClick={() => setAfterId(0)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reiniciar
          </Button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={() => runValidation(mode)}
          disabled={running}
          className="gradient-primary text-primary-foreground font-bold"
        >
          {running ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processando... ({totals.validated})</> :
            mode === "ai" ? <><Brain className="w-4 h-4 mr-2" />Reparar Tudo (IA)</> : <><ShieldCheck className="w-4 h-4 mr-2" />Validar Tudo (Regras)</>}
        </Button>
        {running && (
          <Button onClick={() => { stopRef.current = true; }} variant="destructive">
            <StopCircle className="w-4 h-4 mr-2" /> Parar
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {running && totalQuestoes && totalQuestoes > 0 && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progressPercent}% concluído</p>
        </div>
      )}

      {/* Summary cards */}
      {totals.validated > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-success" />
            <div>
              <span className="font-bold text-lg">{totals.ok}</span>
              <span className="text-muted-foreground ml-1 text-xs">OK</span>
            </div>
          </div>
          <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm">
            <Wrench className="w-4 h-4 text-primary" />
            <div>
              <span className="font-bold text-lg">{totals.fixed}</span>
              <span className="text-muted-foreground ml-1 text-xs">Corrigidas</span>
            </div>
          </div>
          <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm">
            <Trash2 className="w-4 h-4 text-destructive" />
            <div>
              <span className="font-bold text-lg">{totals.deleted}</span>
              <span className="text-muted-foreground ml-1 text-xs">Excluídas</span>
            </div>
          </div>
          <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-accent-foreground" />
            <div>
              <span className="font-bold text-lg">{totals.validated}</span>
              <span className="text-muted-foreground ml-1 text-xs">Total</span>
            </div>
          </div>
        </div>
      )}

      {/* Batch log with expandable details */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {results.map((r, i) => (
            <div key={i}>
              <div
                className="flex items-center gap-3 glass-card rounded-lg p-3 text-sm cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => r.details && r.details.length > 0 && setShowDetails(showDetails === i ? null : i)}
              >
                {r.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                {r.status === "success" && <CheckCircle className="w-4 h-4 text-success" />}
                {r.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                {r.status === "pending" && <div className="w-4 h-4 rounded-full bg-muted" />}
                <span className="font-medium">Lote {r.batch}</span>
                {r.status === "success" && r.validated !== undefined && r.validated > 0 && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    {r.ok} ok · {r.fixed} corrigidas · {r.deleted} excluídas
                  </span>
                )}
                {r.status === "success" && r.validated === 0 && (
                  <span className="text-muted-foreground ml-auto text-xs">Vazio (gap)</span>
                )}
                {r.error && <span className="text-destructive text-xs ml-auto truncate max-w-xs">{r.error}</span>}
                {r.details && r.details.length > 0 && (
                  <Badge variant="outline" className="text-[10px] ml-1">{r.details.length} itens</Badge>
                )}
              </div>
              {showDetails === i && r.details && (
                <div className="ml-8 mt-1 mb-2 space-y-1">
                  {r.details.map((d, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs p-1.5 rounded bg-secondary/30">
                      <span className="font-mono text-muted-foreground w-12">#{d.id}</span>
                      <Badge variant={d.status === "ok" ? "secondary" : d.status === "corrigida" ? "default" : "destructive"} className="text-[9px]">
                        {d.status}
                      </Badge>
                      <span className="text-muted-foreground truncate">{d.motivo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
