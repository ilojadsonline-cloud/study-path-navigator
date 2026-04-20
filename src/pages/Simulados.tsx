import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Shuffle, Settings, AlertCircle, CheckCircle, XCircle, HelpCircle, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const disciplinasOpcoes = [
  "Todas as Disciplinas",
  "Lei nº 2.578/2012",
  "LC nº 128/2021",
  "Lei nº 2.575/2012",
  "CPPM",
  "RDMETO",
];

interface QuestaoSimulado {
  id: number;
  disciplina: string;
  assunto: string;
  dificuldade: string;
  enunciado: string;
  alternativas: string[];
  gabaritoShuffled: number;
  comentario: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─── Save / Load progress helpers ───

async function saveProgress(
  userId: string,
  disciplina: string,
  questaoIds: number[],
  respostas: Record<number, number>,
  total: number
) {
  const { error } = await supabase.from("simulado_progress" as any).upsert(
    {
      user_id: userId,
      disciplina,
      questao_ids: questaoIds,
      respostas: JSON.stringify(respostas),
      total,
    } as any,
    { onConflict: "user_id" }
  );
  if (error) console.error("Erro ao salvar progresso:", error);
}

async function deleteProgress(userId: string) {
  await supabase.from("simulado_progress" as any).delete().eq("user_id", userId);
}

async function loadProgress(userId: string) {
  const { data, error } = await supabase
    .from("simulado_progress" as any)
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as any;
}

// ─── Component ───

const Simulados = () => {
  const { user } = useAuth();
  const [numQuestoes, setNumQuestoes] = useState([20]);
  const [disciplina, setDisciplina] = useState("Todas as Disciplinas");
  const simuladoRef = useRef<QuestaoSimulado[]>([]);
  const [simulado, setSimulado] = useState<QuestaoSimulado[]>([]);
  const [loading, setLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);

  // ─── Memoize question list to prevent re-renders from changing order ───
  const stableSimulado = useMemo(() => simulado, [simulado]);

  // ─── Check for saved progress on mount ───
  useEffect(() => {
    if (!user) { setResumeLoading(false); return; }
    let cancelled = false;

    (async () => {
      const progress = await loadProgress(user.id);
      if (cancelled || !progress) { setResumeLoading(false); return; }

      // Restore the simulado from saved question IDs
      const ids: number[] = progress.questao_ids;
      if (!ids || ids.length === 0) { setResumeLoading(false); return; }

      const { data } = await supabase.from("questoes").select("*").in("id", ids);
      if (cancelled || !data) { setResumeLoading(false); return; }

      // Preserve saved order
      const orderMap = new Map(ids.map((id, i) => [id, i]));
      data.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

      const questoes: QuestaoSimulado[] = data.map(q => ({
        id: q.id,
        disciplina: q.disciplina,
        assunto: q.assunto,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        alternativas: [q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e],
        gabaritoShuffled: q.gabarito,
        comentario: q.comentario,
      }));

      let savedAnswers: Record<number, number> = {};
      try {
        savedAnswers = typeof progress.respostas === "string"
          ? JSON.parse(progress.respostas)
          : progress.respostas || {};
        // Convert string keys to number keys
        const numericAnswers: Record<number, number> = {};
        Object.entries(savedAnswers).forEach(([k, v]) => {
          numericAnswers[Number(k)] = v as number;
        });
        savedAnswers = numericAnswers;
      } catch { savedAnswers = {}; }

      simuladoRef.current = questoes;
      setSimulado(questoes);
      setSelectedAnswer(savedAnswers);
      setDisciplina(progress.disciplina || "Todas as Disciplinas");
      setStarted(true);
      setResumeLoading(false);
      toast.info("Simulado incompleto restaurado!");
    })();

    return () => { cancelled = true; };
  }, [user]);

  // ─── Save progress whenever answers change ───
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !started || finished || simulado.length === 0) return;

    // Debounce saves to avoid spamming DB
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(
        user.id,
        disciplina,
        simulado.map(q => q.id),
        selectedAnswer,
        simulado.length
      );
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [selectedAnswer, user, started, finished, simulado, disciplina]);

  // ─── Beforeunload warning ───
  useEffect(() => {
    if (!started || finished) return;

    const respondidas = Object.keys(selectedAnswer).length;
    if (respondidas === 0) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [started, finished, selectedAnswer]);

  // ─── Generate simulado ───
  const gerarSimulado = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("questoes").select("*");
    if (disciplina !== "Todas as Disciplinas") {
      query = query.eq("disciplina", disciplina);
    }

    const { data, error } = await query;
    if (error || !data) {
      setLoading(false);
      return;
    }

    const shuffled = shuffleArray(data).slice(0, numQuestoes[0]);
    const questoesSimulado: QuestaoSimulado[] = shuffled.map(q => ({
      id: q.id,
      disciplina: q.disciplina,
      assunto: q.assunto,
      dificuldade: q.dificuldade,
      enunciado: q.enunciado,
      alternativas: [q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e],
      gabaritoShuffled: q.gabarito,
      comentario: q.comentario,
    }));

    simuladoRef.current = questoesSimulado;
    setSimulado(questoesSimulado);
    setSelectedAnswer({});
    setRevealed({});
    setFinished(false);
    setStarted(true);
    setLoading(false);
  }, [disciplina, numQuestoes]);

  const reiniciarSimulado = () => {
    if (user) deleteProgress(user.id);
    gerarSimulado();
  };

  const finalizarSimulado = useCallback(async () => {
    const newRevealed: Record<number, boolean> = {};
    stableSimulado.forEach(q => { newRevealed[q.id] = true; });
    setRevealed(newRevealed);
    setFinished(true);

    // Delete progress and save to simulados table
    if (user) {
      await deleteProgress(user.id);

      const acertos = stableSimulado.filter(q => selectedAnswer[q.id] === q.gabaritoShuffled).length;
      await supabase.from("simulados").insert({
        user_id: user.id,
        disciplina,
        questao_ids: stableSimulado.map(q => q.id),
        total: stableSimulado.length,
        acertos,
        finalizado: true,
      });
    }
  }, [stableSimulado, selectedAnswer, user, disciplina]);

  const voltarParaConfig = useCallback(() => {
    if (user && !finished) deleteProgress(user.id);
    setStarted(false);
    setFinished(false);
  }, [user, finished]);

  const acertos = stableSimulado.filter(q => selectedAnswer[q.id] === q.gabaritoShuffled).length;
  const respondidas = Object.keys(selectedAnswer).length;

  const getDifficultyColor = (d: string) => {
    if (d === "Fácil") return "bg-success/15 text-success border-success/30";
    if (d === "Médio") return "bg-warning/15 text-warning border-warning/30";
    return "bg-destructive/15 text-destructive border-destructive/30";
  };

  if (resumeLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (started) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={voltarParaConfig} className="p-2 rounded-lg bg-secondary hover:bg-primary/15 transition-colors shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold">
                  <span className="text-gradient-primary">Simulado</span>
                </h1>
                <p className="text-xs text-muted-foreground truncate">{disciplina} • {stableSimulado.length} questões</p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3">
              {!finished && (
                <button
                  onClick={reiniciarSimulado}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-primary/15 text-xs font-medium transition-colors"
                  title="Reiniciar Simulado (nova randomização)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reiniciar
                </button>
              )}
              {!finished && (
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{respondidas}/{stableSimulado.length}</p>
                  <p className="text-[10px] text-muted-foreground">respondidas</p>
                </div>
              )}
              {finished && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-gradient-primary">{acertos}/{stableSimulado.length}</p>
                  <p className={`text-xs font-medium ${(acertos / stableSimulado.length) >= 0.7 ? 'text-success' : 'text-warning'}`}>
                    {Math.round((acertos / stableSimulado.length) * 100)}% de acerto
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {finished && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-3 rounded-xl shrink-0 ${(acertos / stableSimulado.length) >= 0.7 ? 'bg-success/15' : 'bg-warning/15'}`}>
                  <CheckCircle className={`w-5 h-5 ${(acertos / stableSimulado.length) >= 0.7 ? 'text-success' : 'text-warning'}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm">Simulado Finalizado!</p>
                  <p className="text-xs text-muted-foreground">Revise as questões abaixo</p>
                </div>
              </div>
              <button onClick={reiniciarSimulado} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 w-full sm:w-auto">
                <RotateCcw className="w-3.5 h-3.5" />
                Novo Simulado
              </button>
            </motion.div>
          )}

          <div className="space-y-6">
            {stableSimulado.map((q, qi) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(qi * 0.03, 0.3) }} className="glass-card rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary">Q{qi + 1}</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{q.disciplina}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(q.dificuldade)}`}>{q.dificuldade}</Badge>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{q.enunciado}</p>
                <div className="space-y-2">
                  {q.alternativas.map((alt, ai) => {
                    const isSelected = selectedAnswer[q.id] === ai;
                    const isCorrect = q.gabaritoShuffled === ai;
                    const isRevealed = revealed[q.id];
                    let altClass = "bg-secondary/50 hover:bg-secondary border-transparent";
                    if (isRevealed && isCorrect) altClass = "bg-success/10 border-success/40 text-success";
                    else if (isRevealed && isSelected && !isCorrect) altClass = "bg-destructive/10 border-destructive/40 text-destructive";
                    else if (isSelected) altClass = "bg-primary/10 border-primary/40 text-primary";

                    return (
                      <button key={ai} onClick={() => { if (!revealed[q.id]) setSelectedAnswer(prev => ({ ...prev, [q.id]: ai })); }}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border text-sm transition-all duration-200 ${altClass}`}>
                        <span className="w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold mt-0.5" translate="no">
                          {String.fromCharCode(65 + ai)}
                        </span>
                        <span className="flex-1">{alt}</span>
                        {isRevealed && isCorrect && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-success" />}
                        {isRevealed && isSelected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />}
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {revealed[q.id] && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <HelpCircle className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-primary">Comentário</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{q.comentario}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {!finished && respondidas === stableSimulado.length && stableSimulado.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <button onClick={finalizarSimulado} className="w-full py-4 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity glow-primary">
                <CheckCircle className="w-4 h-4" />
                Finalizar Simulado
              </button>
            </motion.div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <BackButton />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            <span className="text-gradient-primary">Gerador de Simulado</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Monte seu simulado personalizado — seu progresso é salvo automaticamente</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4 sm:p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="p-3 rounded-xl gradient-primary glow-primary">
              <Settings className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold">Configurar Simulado</h2>
              <p className="text-xs text-muted-foreground">Personalize conforme sua necessidade</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Disciplina</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {disciplinasOpcoes.map((d) => (
                <button key={d} onClick={() => setDisciplina(d)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    disciplina === d ? "gradient-primary text-primary-foreground glow-primary" : "bg-secondary hover:bg-primary/15 hover:text-primary"
                  }`}>{d}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium">Número de Questões</label>
              <span className="text-2xl font-bold text-gradient-primary">{numQuestoes[0]}</span>
            </div>
            <Slider value={numQuestoes} onValueChange={setNumQuestoes} max={50} min={5} step={5} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>5</span><span>50</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-primary">Salvamento automático:</strong> Suas respostas são salvas a cada clique. Se você sair, poderá continuar de onde parou.
            </div>
          </div>

          <button onClick={gerarSimulado} disabled={loading}
            className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity glow-primary disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
            {loading ? "Gerando..." : "Gerar Simulado"}
          </button>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Simulados;
