import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, AlertCircle, Zap, AlertTriangle, StopCircle } from "lucide-react";

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
}

export function AdminGerarTab() {
  const { toast } = useToast();
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [totalGeradas, setTotalGeradas] = useState(0);
  const [batchesPerDiscipline, setBatchesPerDiscipline] = useState(3);
  const [batchSize, setBatchSize] = useState(5);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([...DISCIPLINES]);
  const [loadedTexts, setLoadedTexts] = useState<string[]>([]);
  const stopRef = useRef(false);

  useEffect(() => {
    const checkTexts = async () => {
      const { data } = await supabase.from("discipline_legal_texts").select("disciplina");
      if (data) setLoadedTexts(data.map((r: any) => r.disciplina));
    };
    checkTexts();
  }, []);

  const toggleDiscipline = (d: string) => {
    setSelectedDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
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

    let total = 0;
    for (let i = 0; i < batches.length; i++) {
      if (stopRef.current) break;
      batches[i].status = "loading";
      setResults([...batches]);

      try {
        const discIndex = DISCIPLINES.indexOf(batches[i].disciplina);
        const { data, error } = await supabase.functions.invoke("generate-questions-batch", {
          body: { disciplina_index: discIndex, batch_size: batchSize },
        });
        if (error) throw error;
        if (data?.paused) {
          batches[i].status = "error";
          batches[i].error = data.error || "Rate limit";
          toast({ title: "Pausado", description: data.error, variant: "destructive" });
          setResults([...batches]);
          break;
        }
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
      await new Promise(r => setTimeout(r, 3000));
    }

    setRunning(false);
    toast({ title: stopRef.current ? "Geração interrompida" : "Geração concluída!", description: `${total} questões geradas.` });
  };

  const missingTexts = selectedDisciplines.filter(d => !loadedTexts.includes(d));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">Gerar Questões via IA (Groq)</h2>
        <p className="text-sm text-muted-foreground">
          Gera questões via Groq (Llama 3.3 70B) usando exclusivamente o texto legal. Não consome créditos Lovable.
        </p>
      </div>

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
