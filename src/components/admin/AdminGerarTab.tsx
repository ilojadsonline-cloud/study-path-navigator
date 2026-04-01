import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, Zap, AlertTriangle, StopCircle, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DISCIPLINES = [
  "Lei nº 2.578/2012", "LC nº 128/2021", "Lei nº 2.575/2012",
  "CPPM", "RDMETO", "Direito Penal Militar", "Lei Orgânica PM",
];

interface BatchResult {
  disciplina: string;
  batch: number;
  status: "pending" | "loading" | "success" | "error";
  geradas?: number;
  error?: string;
  retries?: number;
}

interface PendingJob {
  id: string;
  disciplines: string[];
  batches_total: number;
  batches_done: number;
  total_generated: number;
  batch_size: number;
  batches_per_discipline: number;
  batches_results: BatchResult[];
  created_at: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 3000;
const CIRCUIT_BREAKER_THRESHOLD = 5; // consecutive failures to trigger circuit breaker

function getRetryDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

export function AdminGerarTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [totalGeradas, setTotalGeradas] = useState(0);
  const [batchesPerDiscipline, setBatchesPerDiscipline] = useState(3);
  const [batchSize, setBatchSize] = useState(3);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([...DISCIPLINES]);
  const [loadedTexts, setLoadedTexts] = useState<string[]>([]);
  const [pendingJob, setPendingJob] = useState<PendingJob | null>(null);
  const [checkingPending, setCheckingPending] = useState(true);
  const [etaText, setEtaText] = useState<string>("");
  const stopRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);
  const consecutiveFailsRef = useRef(0);
  const batchTimesRef = useRef<number[]>([]);

  useEffect(() => {
    const init = async () => {
      // Check loaded texts + pending jobs in parallel
      const [textsRes, jobsRes] = await Promise.all([
        supabase.from("discipline_legal_texts").select("disciplina"),
        supabase.from("generation_jobs").select("*").eq("status", "running").order("created_at", { ascending: false }).limit(1),
      ]);
      if (textsRes.data) setLoadedTexts(textsRes.data.map((r: any) => r.disciplina));
      if (jobsRes.data && jobsRes.data.length > 0) {
        const job = jobsRes.data[0] as any;
        setPendingJob({
          id: job.id,
          disciplines: job.disciplines || [],
          batches_total: job.batches_total,
          batches_done: job.batches_done,
          total_generated: job.total_generated,
          batch_size: job.batch_size,
          batches_per_discipline: job.batches_per_discipline,
          batches_results: job.batches_results || [],
          created_at: job.created_at,
        });
      }
      setCheckingPending(false);
    };
    init();
  }, []);

  const toggleDiscipline = (d: string) => {
    setSelectedDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const saveProgress = useCallback(async (jobId: string, batches: BatchResult[], batchesDone: number, total: number, status: string) => {
    await supabase.from("generation_jobs").update({
      batches_done: batchesDone,
      batches_results: batches as any,
      total_generated: total,
      status,
    }).eq("id", jobId);
  }, []);

  const invokeBatchWithRetry = async (disciplina: string, batchSize: number): Promise<{ data: any; error: any }> => {
    const discIndex = DISCIPLINES.indexOf(disciplina);
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-questions-batch", {
          body: { disciplina_index: discIndex, batch_size: batchSize },
        });
        
        // Rate limit → retry with backoff
        if (data?.paused && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt);
          console.log(`[GERAR] Rate limit, retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        return { data, error };
      } catch (err: any) {
        if (attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt);
          console.log(`[GERAR] Erro, retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms: ${err.message}`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { data: null, error: err };
      }
    }
    return { data: null, error: new Error("Max retries exceeded") };
  };

  const updateEta = useCallback((batchTimes: number[], remaining: number) => {
    if (batchTimes.length === 0 || remaining <= 0) { setEtaText(""); return; }
    const avg = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
    const totalSec = Math.round((avg * remaining) / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    setEtaText(min > 0 ? `~${min}m ${sec}s restantes` : `~${sec}s restantes`);
  }, []);

  const runBatches = async (batches: BatchResult[], startFrom: number, jobId: string, initialTotal: number) => {
    let total = initialTotal;
    consecutiveFailsRef.current = 0;
    batchTimesRef.current = [];
    
    for (let i = startFrom; i < batches.length; i++) {
      if (stopRef.current) break;

      // Circuit breaker check
      if (consecutiveFailsRef.current >= CIRCUIT_BREAKER_THRESHOLD) {
        toast({ 
          title: "Circuit Breaker ativado", 
          description: `${CIRCUIT_BREAKER_THRESHOLD} falhas consecutivas. Processo pausado automaticamente para evitar sobrecarga.`, 
          variant: "destructive" 
        });
        await saveProgress(jobId, batches, i, total, "running");
        break;
      }

      batches[i].status = "loading";
      setResults([...batches]);

      const batchStart = Date.now();
      const { data, error } = await invokeBatchWithRetry(batches[i].disciplina, batchSize);
      const batchDuration = Date.now() - batchStart;
      
      if (error) {
        batches[i].status = "error";
        batches[i].error = error.message;
        consecutiveFailsRef.current++;
      } else if (data?.paused) {
        batches[i].status = "error";
        batches[i].error = data.error || "Rate limit persistente";
        consecutiveFailsRef.current++;
        toast({ title: "Pausado", description: "Rate limit persistente após retentativas.", variant: "destructive" });
        setResults([...batches]);
        await saveProgress(jobId, batches, i, total, "running");
        break;
      } else if (data?.error) {
        batches[i].status = "error";
        batches[i].error = data.error;
        consecutiveFailsRef.current++;
      } else {
        const inserted = data?.inserted || data?.generated || 0;
        batches[i].status = "success";
        batches[i].geradas = inserted;
        total += inserted;
        setTotalGeradas(total);
        consecutiveFailsRef.current = 0; // Reset on success
      }

      batchTimesRef.current.push(batchDuration);
      const remaining = batches.length - (i + 1);
      updateEta(batchTimesRef.current, remaining);

      setResults([...batches]);
      await saveProgress(jobId, batches, i + 1, total, stopRef.current ? "paused" : "running");
      
      if (i < batches.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));
      }
    }

    setEtaText("");
    return total;
  };

  const generateAll = async () => {
    const activeDisciplines = selectedDisciplines.filter(d => loadedTexts.includes(d));
    if (activeDisciplines.length === 0) {
      toast({ title: "Erro", description: "Nenhuma disciplina com texto legal carregado.", variant: "destructive" });
      return;
    }

    setRunning(true);
    stopRef.current = false;
    setTotalGeradas(0);

    const batches: BatchResult[] = [];
    for (const d of activeDisciplines) {
      for (let b = 0; b < batchesPerDiscipline; b++) {
        batches.push({ disciplina: d, batch: b + 1, status: "pending" });
      }
    }
    setResults([...batches]);

    // Create job in DB
    const { data: jobData } = await supabase.from("generation_jobs").insert({
      user_id: user?.id,
      status: "running",
      disciplines: activeDisciplines,
      batches_total: batches.length,
      batches_done: 0,
      batches_results: batches as any,
      total_generated: 0,
      batch_size: batchSize,
      batches_per_discipline: batchesPerDiscipline,
    } as any).select("id").single();

    const jobId = jobData?.id || crypto.randomUUID();
    jobIdRef.current = jobId;

    const total = await runBatches(batches, 0, jobId, 0);

    // Mark job complete
    const finalStatus = stopRef.current ? "paused" : "completed";
    await saveProgress(jobId, batches, batches.length, total, finalStatus);

    setRunning(false);
    setPendingJob(null);
    toast({ title: stopRef.current ? "Geração interrompida" : "Geração concluída!", description: `${total} questões geradas.` });
  };

  const resumeJob = async () => {
    if (!pendingJob) return;

    setRunning(true);
    stopRef.current = false;
    
    const batches = pendingJob.batches_results.length > 0
      ? [...pendingJob.batches_results]
      : (() => {
          const b: BatchResult[] = [];
          for (const d of pendingJob.disciplines) {
            for (let i = 0; i < pendingJob.batches_per_discipline; i++) {
              b.push({ disciplina: d, batch: i + 1, status: "pending" });
            }
          }
          return b;
        })();

    setResults([...batches]);
    setBatchSize(pendingJob.batch_size);
    setTotalGeradas(pendingJob.total_generated);
    jobIdRef.current = pendingJob.id;

    const startFrom = pendingJob.batches_done;
    const total = await runBatches(batches, startFrom, pendingJob.id, pendingJob.total_generated);

    const finalStatus = stopRef.current ? "paused" : "completed";
    await saveProgress(pendingJob.id, batches, batches.length, total, finalStatus);

    setRunning(false);
    setPendingJob(null);
    toast({ title: stopRef.current ? "Geração interrompida" : "Geração concluída!", description: `${total} questões geradas.` });
  };

  const dismissJob = async () => {
    if (!pendingJob) return;
    await supabase.from("generation_jobs").update({ status: "dismissed" } as any).eq("id", pendingJob.id);
    setPendingJob(null);
  };

  const missingTexts = selectedDisciplines.filter(d => !loadedTexts.includes(d));
  const progressPercent = results.length > 0 
    ? Math.round(results.filter(r => r.status === "success" || r.status === "error").length / results.length * 100) 
    : 0;

  if (checkingPending) {
    return <div className="flex items-center gap-2 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">Gerar Questões via IA</h2>
        <p className="text-sm text-muted-foreground">
          Gera questões via DeepSeek com persistência de progresso e retentativa automática.
        </p>
      </div>

      {/* Resume pending job banner */}
      {pendingJob && !running && (
        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-start gap-2">
            <RotateCcw className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Lote interrompido encontrado</p>
              <p className="text-xs text-muted-foreground">
                {pendingJob.batches_done}/{pendingJob.batches_total} lotes processados • {pendingJob.total_generated} questões geradas • 
                Iniciado em {new Date(pendingJob.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={resumeJob}>
              <RotateCcw className="w-4 h-4 mr-1" /> Retomar
            </Button>
            <Button size="sm" variant="outline" onClick={dismissJob}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {missingTexts.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Textos legais não carregados:</strong> {missingTexts.join(", ")}.
            <br />Vá em <strong>Admin → Textos Legais</strong> para fazer upload.
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Disciplinas:</h3>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINES.map(d => {
            const loaded = loadedTexts.includes(d);
            const selected = selectedDisciplines.includes(d);
            return (
              <button
                key={d}
                onClick={() => toggleDiscipline(d)}
                disabled={running}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selected
                    ? loaded ? "bg-primary text-primary-foreground" : "bg-destructive/20 text-destructive border border-destructive/30"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {d} {loaded ? "✓" : "⚠"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Lotes por disciplina:</label>
          <Input type="number" value={batchesPerDiscipline} onChange={(e) => setBatchesPerDiscipline(Math.max(1, Number(e.target.value) || 1))} disabled={running} className="w-16" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Questões por lote:</label>
          <Input type="number" value={batchSize} onChange={(e) => setBatchSize(Math.max(1, Math.min(10, Number(e.target.value) || 5)))} disabled={running} className="w-16" />
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={generateAll} disabled={running} className="gradient-primary text-primary-foreground font-bold">
          {running ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Gerando... ({totalGeradas})</> : <><Zap className="w-4 h-4 mr-2" />Iniciar Geração</>}
        </Button>
        {running && (
          <Button onClick={() => { stopRef.current = true; }} variant="destructive">
            <StopCircle className="w-4 h-4 mr-2" /> Parar
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {running && results.length > 0 && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {results.filter(r => r.status === "success" || r.status === "error").length}/{results.length} lotes ({progressPercent}%)
              {consecutiveFailsRef.current > 0 && (
                <span className="text-destructive ml-2">⚠ {consecutiveFailsRef.current} falha(s) consecutiva(s)</span>
              )}
            </span>
            {etaText && <span>{etaText}</span>}
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
              <span className="font-medium">{r.disciplina}</span>
              <span className="text-muted-foreground">Lote {r.batch}</span>
              {r.geradas !== undefined && <span className="text-success ml-auto">+{r.geradas}</span>}
              {r.error && <span className="text-destructive text-xs ml-auto truncate max-w-xs">{r.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
