import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, Zap, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const disciplinas = [
  "Lei nº 2.578/2012",
  "LC nº 128/2021",
  "Lei nº 2.575/2012",
  "CPPM",
  "RDMETO",
  "Direito Penal Militar",
  "Lei Orgânica PM",
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
  const [batchesPerDiscipline, setBatchesPerDiscipline] = useState(3);
  const [batchSize, setBatchSize] = useState(2);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([...disciplinas]);
  const [loadedTexts, setLoadedTexts] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const checkTexts = async () => {
      const { data } = await supabase
        .from("discipline_legal_texts")
        .select("disciplina");
      if (data) setLoadedTexts(data.map((r: any) => r.disciplina));
    };
    checkTexts();
  }, []);

  const toggleDiscipline = (d: string) => {
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const generateAll = async () => {
    const activeDisciplines = selectedDisciplines.filter((d) => loadedTexts.includes(d));
    if (activeDisciplines.length === 0) {
      toast({ title: "Erro", description: "Nenhuma disciplina com texto legal carregado. Vá em 'Textos Legais' para fazer o upload.", variant: "destructive" });
      return;
    }

    setRunning(true);
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
      batches[i].status = "loading";
      setResults([...batches]);

      try {
        const discIndex = disciplinas.indexOf(batches[i].disciplina);
        const { data, error } = await supabase.functions.invoke("generate-questions-batch", {
          body: { disciplina_index: discIndex, batch_size: batchSize },
        });

        if (error) {
          const message = /non-2xx|FunctionsHttpError|Failed to fetch/i.test(error.message)
            ? "Tempo limite excedido. Reduza 'Questões por lote' para 1 ou 2 e tente novamente."
            : error.message;
          throw new Error(message);
        }
        if (data?.paused) {
          batches[i].status = "error";
          batches[i].error = data.error || data.mensagem || "Rate limit";
          toast({ title: "Pausado", description: batches[i].error, variant: "destructive" });
          setResults([...batches]);
          break;
        }
        if (data?.status === "erro" || data?.error) {
          throw new Error(data?.mensagem || data?.error || "Falha na geração");
        }

        const inserted = data?.inserted || data?.generated || 0;
        batches[i].status = "success";
        batches[i].geradas = inserted;
        total += inserted;
        setTotalGeradas(total);
      } catch (err: any) {
        const message = err?.message || "Falha inesperada na geração.";
        batches[i].status = "error";
        batches[i].error = message;
        if (/tempo limite|OpenRouter demorou demais|excedeu o tempo limite|saldo|limite disponível|conexão persistente|non-2xx/i.test(message)) {
          toast({ title: "Geração pausada", description: message, variant: "destructive" });
          setResults([...batches]);
          break;
        }
      }

      setResults([...batches]);
      await new Promise((r) => setTimeout(r, 1200));
    }

    setRunning(false);
    toast({ title: "Geração concluída!", description: `${total} questões geradas no total.` });
  };

  const missingTexts = selectedDisciplines.filter((d) => !loadedTexts.includes(d));

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gradient-primary">Gerador de Questões (DeepSeek)</h1>
        <p className="text-sm text-muted-foreground">
          Gera questões priorizando artigos menos explorados da lei, com lotes menores para mais velocidade e menor desperdício de créditos.
        </p>

        {missingTexts.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Textos legais não carregados:</strong> {missingTexts.join(", ")}.
              <br />Vá em <strong>Admin → Textos Legais</strong> para fazer upload antes de gerar.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Disciplinas:</h3>
          <div className="flex flex-wrap gap-2">
            {disciplinas.map((d) => {
              const loaded = loadedTexts.includes(d);
              const selected = selectedDisciplines.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDiscipline(d)}
                  disabled={running}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selected
                      ? loaded
                        ? "bg-primary text-primary-foreground"
                        : "bg-destructive/20 text-destructive border border-destructive/30"
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
            <input
              type="number"
              value={batchesPerDiscipline}
              onChange={(e) => setBatchesPerDiscipline(Math.max(1, Number(e.target.value) || 1))}
              disabled={running}
              className="w-16 rounded-lg bg-secondary border-none text-sm p-2 text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Questões por lote:</label>
            <input
              type="number"
              min={1}
              max={3}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, Math.min(3, Number(e.target.value) || 2)))}
              disabled={running}
              className="w-16 rounded-lg bg-secondary border-none text-sm p-2 text-foreground"
            />
          </div>
          <p className="text-[11px] text-muted-foreground basis-full">
            Recomendado: 1–2 questões por lote para evitar timeout do DeepSeek.
          </p>
        </div>

        <button
          onClick={generateAll}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {running ? `Gerando... (${totalGeradas} criadas)` : `Iniciar Geração`}
        </button>

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
    </AppLayout>
  );
};

export default GerarQuestoes;
