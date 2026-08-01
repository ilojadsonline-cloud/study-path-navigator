import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Shuffle, Settings, AlertCircle, CheckCircle, XCircle, HelpCircle, ArrowLeft, Loader2, RotateCcw, Flag, Scissors } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";
import { toast } from "sonner";
import { FormattedText } from "@/components/FormattedText";

const DISCIPLINAS_OFICIAIS = [
  "Lei nº 2.578/2012",
  "LC nº 128/2021",
  "Lei nº 2.575/2012",
  "CPPM",
  "RDMETO",
  "Língua Portuguesa",
  "Redação Oficial",
];

// Obs.: POP não entra (documento sigiloso — Portaria nº 021/2015-Gab. PMTO)
const DISCIPLINAS_EM_BREVE: string[] = [];

const disciplinasOpcoes = ["Todas as Disciplinas", ...DISCIPLINAS_OFICIAIS];

const TOTAIS_OPCOES = [5, 10, 20, 30, 50];

// Largest remainder method for proportional distribution (20% per discipline when equal)
function distribuirProporcional(total: number, disciplinas: string[]): Record<string, number> {
  const n = disciplinas.length;
  const base = Math.floor(total / n);
  let resto = total - base * n;
  const dist: Record<string, number> = {};
  disciplinas.forEach(d => { dist[d] = base; });
  let i = 0;
  while (resto > 0) {
    dist[disciplinas[i % n]] += 1;
    resto--;
    i++;
  }
  return dist;
}

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
  const [numQuestoes, setNumQuestoes] = useState<number>(20);
  const [disciplinasSel, setDisciplinasSel] = useState<string[]>([]); // [] = Todas
  const disciplinasAlvo = disciplinasSel.length === 0 ? DISCIPLINAS_OFICIAIS : disciplinasSel;
  const disciplinaLabel = disciplinasSel.length === 0
    ? "Todas as Disciplinas"
    : disciplinasSel.length === 1
      ? disciplinasSel[0]
      : `${disciplinasSel.length} disciplinas selecionadas`;
  const disciplinaForSave = disciplinasSel.length === 0 ? "Todas as Disciplinas" : disciplinasSel.join("|");
  const simuladoRef = useRef<QuestaoSimulado[]>([]);
  const [simulado, setSimulado] = useState<QuestaoSimulado[]>([]);
  const [loading, setLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [crossedOut, setCrossedOut] = useState<Record<number, number[]>>({});
  const [finished, setFinished] = useState(false);

  const handleAnswer = (questaoId: number, altIndex: number) => {
    if (revealed[questaoId]) return;
    if ((crossedOut[questaoId] || []).includes(altIndex)) return;
    setSelectedAnswer(prev => ({ ...prev, [questaoId]: altIndex }));
  };

  const toggleCrossed = (questaoId: number, altIndex: number) => {
    if (revealed[questaoId]) return;
    setCrossedOut(prev => {
      const current = prev[questaoId] || [];
      const next = current.includes(altIndex)
        ? current.filter(i => i !== altIndex)
        : [...current, altIndex];
      return { ...prev, [questaoId]: next };
    });
    setSelectedAnswer(prev => {
      if (prev[questaoId] === altIndex && !(crossedOut[questaoId] || []).includes(altIndex)) {
        const { [questaoId]: _omit, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  };

  // ─── Report question error ───
  const [reportOpen, setReportOpen] = useState(false);
  const [reportQuestaoId, setReportQuestaoId] = useState<number | null>(null);
  const [reportMotivo, setReportMotivo] = useState("");
  const [reportSending, setReportSending] = useState(false);

  const handleReport = (questaoId: number) => {
    setReportQuestaoId(questaoId);
    setReportMotivo("");
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!user || !reportQuestaoId) return;
    setReportSending(true);
    const { error } = await supabase.from("question_reports" as any).insert({
      questao_id: reportQuestaoId,
      user_id: user.id,
      motivo: reportMotivo,
    } as any);
    setReportSending(false);
    if (error) {
      toast.error("Erro ao enviar relatório");
    } else {
      toast.success("Erro reportado com sucesso! Obrigado.");
      setReportOpen(false);
    }
  };

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

      const { data } = await supabase
        .from("questoes")
        .select("*")
        .in("id", ids)
        .in("audit_status", ["approved", "auto_corrected", "admin_resolved"]);
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
      const savedLabel = progress.disciplina || "Todas as Disciplinas";
      if (savedLabel === "Todas as Disciplinas") setDisciplinasSel([]);
      else if (savedLabel.includes("|")) setDisciplinasSel(savedLabel.split("|").filter(Boolean));
      else if (DISCIPLINAS_OFICIAIS.includes(savedLabel)) setDisciplinasSel([savedLabel]);
      else setDisciplinasSel([]);
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
        disciplinaForSave,
        simulado.map(q => q.id),
        selectedAnswer,
        simulado.length
      );
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [selectedAnswer, user, started, finished, simulado, disciplinaForSave]);

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
    const total = numQuestoes;

    // Fetch user's answered question IDs to prioritize unanswered ones
    let respondidasIds = new Set<number>();
    if (user) {
      const { data: resp } = await supabase
        .from("respostas_usuario")
        .select("questao_id")
        .eq("user_id", user.id);
      if (resp) respondidasIds = new Set(resp.map((r: any) => r.questao_id));
    }

    const isAll = disciplinasSel.length === 0;
    const alvo = disciplinasAlvo; // [] -> todas; senão as selecionadas
    const distribuicao = distribuirProporcional(total, alvo);

    // Single query for all target disciplines (optimized, selecting only needed cols)
    let baseQuery = supabase
      .from("questoes")
      .select("id,disciplina,assunto,dificuldade,enunciado,alt_a,alt_b,alt_c,alt_d,alt_e,gabarito,comentario")
      .in("disciplina", disciplinasAlvo)
      .in("audit_status", ["approved", "auto_corrected", "admin_resolved"]);
    const cf = cursoOrFilter(cursoId);
    if (cf) baseQuery = baseQuery.or(cf);
    const { data, error } = await baseQuery;

    if (error || !data) {
      toast.error("Erro ao carregar questões");
      setLoading(false);
      return;
    }

    // Group by disciplina
    const porDisciplina: Record<string, any[]> = {};
    disciplinasAlvo.forEach(d => { porDisciplina[d] = []; });
    data.forEach(q => { if (porDisciplina[q.disciplina]) porDisciplina[q.disciplina].push(q); });

    // Select N per discipline, prioritizing unanswered
    const selecionadas: any[] = [];
    const faltam: { disciplina: string; quantidade: number }[] = [];

    disciplinasAlvo.forEach(d => {
      const need = distribuicao[d];
      const pool = porDisciplina[d];
      const naoResp = shuffleArray(pool.filter(q => !respondidasIds.has(q.id)));
      const resp = shuffleArray(pool.filter(q => respondidasIds.has(q.id)));
      const combined = [...naoResp, ...resp].slice(0, need);
      selecionadas.push(...combined);
      if (combined.length < need) {
        faltam.push({ disciplina: d, quantidade: need - combined.length });
      }
    });

    // Fallback: if any discipline lacked questions, fill from others to reach total
    if (selecionadas.length < total && isAll) {
      const usadosIds = new Set(selecionadas.map(q => q.id));
      const sobra = shuffleArray(data.filter(q => !usadosIds.has(q.id)));
      selecionadas.push(...sobra.slice(0, total - selecionadas.length));
    }

    if (faltam.length > 0) {
      toast.warning(`Banco insuficiente em: ${faltam.map(f => f.disciplina).join(", ")}`);
    }

    // Final shuffle so questions aren't grouped by discipline
    const shuffledFinal = shuffleArray(selecionadas);

    const questoesSimulado: QuestaoSimulado[] = shuffledFinal.map(q => ({
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
    setCrossedOut({});
    setFinished(false);
    setStarted(true);
    setLoading(false);
  }, [disciplinasSel, numQuestoes, user]);

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
        disciplina: disciplinaForSave,
        questao_ids: stableSimulado.map(q => q.id),
        total: stableSimulado.length,
        acertos,
        finalizado: true,
      });
    }
  }, [stableSimulado, selectedAnswer, user, disciplinaForSave]);

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
                <p className="text-xs text-muted-foreground truncate">{disciplinaLabel} • {stableSimulado.length} questões</p>
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

          {finished && (() => {
            const total = stableSimulado.length || 1;
            const pct = (acertos / total) * 100;
            const nota = (acertos / total) * 10;
            const tone: "success" | "warning" | "destructive" =
              pct >= 70 ? "success" : pct >= 50 ? "warning" : "destructive";
            const label = pct >= 70 ? "Excelente!" : pct >= 50 ? "Quase lá — continue firme" : "Foco na revisão!";
            const toneCls = {
              success: { box: "bg-success/15 border-success/30", text: "text-success", textSoft: "text-success/80", bar: "bg-success" },
              warning: { box: "bg-warning/15 border-warning/30", text: "text-warning", textSoft: "text-warning/80", bar: "bg-warning" },
              destructive: { box: "bg-destructive/15 border-destructive/30", text: "text-destructive", textSoft: "text-destructive/80", bar: "bg-destructive" },
            }[tone];
            return (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className={`shrink-0 w-24 h-24 rounded-2xl border flex flex-col items-center justify-center ${toneCls.box}`}>
                    <span className={`text-3xl font-black leading-none ${toneCls.text}`}>{nota.toFixed(1)}</span>
                    <span className={`text-[10px] uppercase tracking-wide mt-1 ${toneCls.textSoft}`}>Nota / 10</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Simulado finalizado</p>
                    <p className="text-lg font-bold">{label}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">{acertos}</span> de <span className="font-semibold text-foreground">{stableSimulado.length}</span> acertos
                      {" • "}<span className={`font-semibold ${toneCls.text}`}>{pct.toFixed(1)}% de aproveitamento</span>
                    </p>
                    <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full transition-all ${toneCls.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button onClick={reiniciarSimulado} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Novo Simulado
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Revise as questões abaixo para consolidar o aprendizado.</p>
              </motion.div>
            );
          })()}

          <div className="space-y-6">
            {stableSimulado.map((q, qi) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(qi * 0.03, 0.3) }} className="glass-card rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary">Q{qi + 1}</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{q.disciplina}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(q.dificuldade)}`}>{q.dificuldade}</Badge>
                  </div>
                  <button
                    onClick={() => handleReport(q.id)}
                    title="Reportar erro nesta questão"
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs font-medium hover:bg-destructive/20 hover:border-destructive/40 transition-all"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reportar</span>
                  </button>
                </div>
                <FormattedText text={q.enunciado} className="text-sm text-foreground" />
                <div className="space-y-2">
                  {q.alternativas.map((alt, ai) => {
                    const isSelected = selectedAnswer[q.id] === ai;
                    const isCorrect = q.gabaritoShuffled === ai;
                    const isRevealed = revealed[q.id];
                    const isCrossed = !isRevealed && (crossedOut[q.id] || []).includes(ai);

                    let altClass = "bg-secondary/50 hover:bg-secondary border-transparent";
                    if (isRevealed && isCorrect) altClass = "bg-success/10 border-success/40 text-success";
                    else if (isRevealed && isSelected && !isCorrect) altClass = "bg-destructive/10 border-destructive/40 text-destructive";
                    else if (isSelected) altClass = "bg-primary/10 border-primary/40 text-primary ring-1 ring-primary/40";
                    else if (isCrossed) altClass = "bg-secondary/20 border-transparent";

                    return (
                      <div key={ai} className={`flex items-stretch gap-2 rounded-lg border text-sm transition-all duration-200 ${altClass}`}>
                        {!isRevealed && !isSelected && (
                          <button
                            onClick={() => toggleCrossed(q.id, ai)}
                            title={isCrossed ? "Restaurar alternativa" : "Riscar alternativa"}
                            aria-label={isCrossed ? "Restaurar alternativa" : "Riscar alternativa"}
                            className={`shrink-0 self-center ml-1.5 w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                              isCrossed ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            }`}
                          >
                            {isCrossed ? <RotateCcw className="w-4 h-4" /> : <Scissors className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleAnswer(q.id, ai)}
                          disabled={isCrossed}
                          className={`flex-1 text-left flex items-start gap-3 p-3 ${isCrossed ? "opacity-40 cursor-default" : "cursor-pointer"}`}
                        >
                          <span className="w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold mt-0.5" translate="no">
                            {String.fromCharCode(65 + ai)}
                          </span>
                          <FormattedText text={alt} className={`flex-1 ${isCrossed ? "line-through" : ""}`} />
                          {isRevealed && isCorrect && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-success" />}
                          {isRevealed && isSelected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />}
                        </button>
                      </div>
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
                      <FormattedText text={q.comentario} className="text-xs text-muted-foreground" />
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

          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reportar Erro na Questão</DialogTitle>
              </DialogHeader>
              <Textarea
                placeholder="Descreva o erro encontrado (alternativa incorreta, lei errada, gabarito errado, etc.)"
                value={reportMotivo}
                onChange={(e) => setReportMotivo(e.target.value)}
                rows={4}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportOpen(false)}>Cancelar</Button>
                <Button onClick={submitReport} disabled={reportSending || !reportMotivo.trim()} className="gradient-primary text-primary-foreground font-bold">
                  {reportSending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Flag className="w-4 h-4 mr-1" />}
                  Enviar Relatório
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Disciplinas</label>
              <span className="text-[11px] text-muted-foreground">
                {disciplinasSel.length === 0 ? "Todas selecionadas" : `${disciplinasSel.length} selecionada(s)`}
              </span>
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setDisciplinasSel([])}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${disciplinasSel.length === 0 ? "gradient-primary text-primary-foreground glow-primary" : "bg-secondary hover:bg-primary/15"}`}
              >Todas</button>
              <button
                type="button"
                onClick={() => setDisciplinasSel([...DISCIPLINAS_OFICIAIS])}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-primary/15"
              >Marcar todas</button>
              <button
                type="button"
                onClick={() => setDisciplinasSel([])}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-destructive/20"
              >Limpar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {DISCIPLINAS_OFICIAIS.map((d) => {
                const active = disciplinasSel.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setDisciplinasSel(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
                    }
                    className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 text-left ${
                      active ? "gradient-primary text-primary-foreground glow-primary" : "bg-secondary hover:bg-primary/15 hover:text-primary"
                    }`}
                  >
                    <span className="inline-block w-3 mr-1">{active ? "✓" : "·"}</span>{d}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {DISCIPLINAS_EM_BREVE.map((d) => (
                <div
                  key={d}
                  className="px-3 py-2.5 rounded-lg text-xs font-medium text-left bg-secondary/40 text-muted-foreground border border-dashed border-border/60 cursor-not-allowed flex items-center justify-between gap-1"
                  title="Disciplina do novo edital — banco de questões em breve"
                >
                  <span className="truncate">{d}</span>
                  <span className="text-[9px] uppercase font-bold text-amber-500 shrink-0">Em breve</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Selecione 2 ou mais para personalizar. Vazio = todas as disciplinas (distribuição proporcional).
            </p>

          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium">Número de Questões</label>
              <span className="text-2xl font-bold text-gradient-primary">{numQuestoes}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {TOTAIS_OPCOES.map(n => (
                <button key={n} onClick={() => setNumQuestoes(n)}
                  className={`py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    numQuestoes === n ? "gradient-primary text-primary-foreground glow-primary" : "bg-secondary hover:bg-primary/15 hover:text-primary"
                  }`}>{n}</button>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
              <p className="text-[11px] font-semibold text-muted-foreground mb-2">
                Distribuição proporcional entre {disciplinasAlvo.length} disciplina(s):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(distribuirProporcional(numQuestoes, disciplinasAlvo)).map(([d, q]) => (
                  <Badge key={d} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    {d}: {q}
                  </Badge>
                ))}
              </div>
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
