import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Shuffle, Play, Settings, AlertCircle, CheckCircle, XCircle, HelpCircle, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

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

const Simulados = () => {
  const [numQuestoes, setNumQuestoes] = useState([20]);
  const [disciplina, setDisciplina] = useState("Todas as Disciplinas");
  // Store simulado in ref to prevent re-shuffling on re-renders
  const simuladoRef = useRef<QuestaoSimulado[]>([]);
  const [simulado, setSimulado] = useState<QuestaoSimulado[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);

  const gerarSimulado = async () => {
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
  };

  const reiniciarSimulado = () => {
    // Re-shuffle and generate a brand new simulado
    gerarSimulado();
  };

  const finalizarSimulado = () => {
    const newRevealed: Record<number, boolean> = {};
    simulado.forEach(q => { newRevealed[q.id] = true; });
    setRevealed(newRevealed);
    setFinished(true);
  };

  const acertos = simulado.filter(q => selectedAnswer[q.id] === q.gabaritoShuffled).length;
  const respondidas = Object.keys(selectedAnswer).length;

  const getDifficultyColor = (d: string) => {
    if (d === "Fácil") return "bg-success/15 text-success border-success/30";
    if (d === "Médio") return "bg-warning/15 text-warning border-warning/30";
    return "bg-destructive/15 text-destructive border-destructive/30";
  };

  if (started) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { setStarted(false); setFinished(false); }} className="p-2 rounded-lg bg-secondary hover:bg-primary/15 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold">
                  <span className="text-gradient-primary">Simulado</span>
                </h1>
                <p className="text-xs text-muted-foreground">{disciplina} • {simulado.length} questões</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
                  <p className="text-sm font-bold text-foreground">{respondidas}/{simulado.length}</p>
                  <p className="text-[10px] text-muted-foreground">respondidas</p>
                </div>
              )}
              {finished && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-gradient-primary">{acertos}/{simulado.length}</p>
                  <p className={`text-xs font-medium ${(acertos / simulado.length) >= 0.7 ? 'text-success' : 'text-warning'}`}>
                    {Math.round((acertos / simulado.length) * 100)}% de acerto
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {finished && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${(acertos / simulado.length) >= 0.7 ? 'bg-success/15' : 'bg-warning/15'}`}>
                  <CheckCircle className={`w-5 h-5 ${(acertos / simulado.length) >= 0.7 ? 'text-success' : 'text-warning'}`} />
                </div>
                <div>
                  <p className="font-bold text-sm">Simulado Finalizado!</p>
                  <p className="text-xs text-muted-foreground">Revise as questões abaixo</p>
                </div>
              </div>
              <button onClick={reiniciarSimulado} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Novo Simulado
              </button>
            </motion.div>
          )}

          <div className="space-y-6">
            {simulado.map((q, qi) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(qi * 0.03, 0.3) }} className="glass-card rounded-xl p-5 space-y-4">
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

          {!finished && respondidas === simulado.length && simulado.length > 0 && (
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
      <div className="max-w-3xl mx-auto space-y-6">
        <BackButton />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient-primary">Gerador de Simulado</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monte seu simulado personalizado — a ordem é mantida até você reiniciar</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-6 space-y-6">
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
              <strong className="text-primary">Ordem estável:</strong> As questões são embaralhadas ao gerar e mantidas até você clicar em "Reiniciar Simulado" ou atualizar a página (F5).
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
