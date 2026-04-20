import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { Filter, CheckCircle, XCircle, Star, ChevronDown, HelpCircle, Loader2, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Questao {
  id: number;
  disciplina: string;
  assunto: string;
  dificuldade: string;
  enunciado: string;
  alt_a: string;
  alt_b: string;
  alt_c: string;
  alt_d: string;
  alt_e: string;
  gabarito: number;
  comentario: string;
}

function getAlternativas(q: Questao) {
  return {
    alternativas: [q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e],
    gabarito: q.gabarito,
  };
}

const PAGE_SIZE = 20;

const Questoes = () => {
  const [searchParams] = useSearchParams();
  const initialDisciplina = searchParams.get("disciplina") || "Todos";
  const { user } = useAuth();

  const [allQuestoes, setAllQuestoes] = useState<(Questao & { alternativas: string[]; gabaritoShuffled: number })[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDisciplina, setFilterDisciplina] = useState(initialDisciplina);
  const [filterDificuldade, setFilterDificuldade] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Não resolvidas");
  const [answeredIds, setAnsweredIds] = useState<Set<number>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<number>>(new Set());
  const [allAnsweredInDisciplina, setAllAnsweredInDisciplina] = useState(false);
  const [availableDisciplinas, setAvailableDisciplinas] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportQuestaoId, setReportQuestaoId] = useState<number | null>(null);
  const [reportMotivo, setReportMotivo] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [shownNewToast, setShownNewToast] = useState(false);

  const lastFilterKeyRef = useRef<string>("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const dificuldades = ["Todos", "Fácil", "Médio", "Difícil"];
  const statusOptions = ["Não resolvidas", "Todas", "Resolvidas", "Apenas Erradas"];

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < allQuestoes.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, allQuestoes.length));
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, allQuestoes.length]);

  const questoes = allQuestoes.slice(0, visibleCount);

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

  useEffect(() => {
    const fetchDisciplinas = async () => {
      const { data } = await supabase.from("questoes").select("disciplina");
      if (data) {
        const unique = [...new Set(data.map(d => d.disciplina))].sort();
        setAvailableDisciplinas(unique);
      }
    };
    const fetchAnswered = async () => {
      if (!user) return;
      // Paginate to bypass 1000-row limit
      const allAnswers: Array<{ questao_id: number; correta: boolean }> = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("respostas_usuario")
          .select("questao_id, correta")
          .eq("user_id", user.id)
          .range(from, from + batchSize - 1);
        if (!data || data.length === 0) break;
        allAnswers.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      setAnsweredIds(new Set(allAnswers.map(d => d.questao_id)));
      setWrongIds(new Set(allAnswers.filter(d => !d.correta).map(d => d.questao_id)));
    };
    fetchDisciplinas();
    fetchAnswered();

    if (!shownNewToast) {
      setShownNewToast(true);
      setTimeout(() => {
        toast.info("Novas questões adicionadas recentemente! Explore novos temas e desafios. 🚀");
      }, 1500);
    }
  }, [user]);

  useEffect(() => {
    fetchQuestoes();
  }, [filterDisciplina, filterDificuldade, filterStatus]);

  const fetchQuestoes = async () => {
    const filterKey = `${filterDisciplina}|${filterDificuldade}|${filterStatus}`;
    if (filterKey === lastFilterKeyRef.current && allQuestoes.length > 0) return;
    lastFilterKeyRef.current = filterKey;

    setLoading(true);
    
    // Paginate to bypass the 1000-row Supabase limit
    let allData: Questao[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      let query = supabase.from("questoes").select("*");
      if (filterDisciplina !== "Todos") query = query.eq("disciplina", filterDisciplina);
      if (filterDificuldade !== "Todos") query = query.eq("dificuldade", filterDificuldade);
      const { data, error } = await query.order("id").range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData.push(...(data as Questao[]));
      if (data.length < batchSize) break;
      from += batchSize;
    }

    let filtered = allData;
    const totalBeforeStatusFilter = filtered.length;
    if (filterStatus === "Resolvidas") {
      filtered = filtered.filter(q => answeredIds.has(q.id));
    } else if (filterStatus === "Não resolvidas") {
      filtered = filtered.filter(q => !answeredIds.has(q.id));
    } else if (filterStatus === "Apenas Erradas") {
      filtered = filtered.filter(q => wrongIds.has(q.id));
    }
    setAllAnsweredInDisciplina(
      filterStatus === "Não resolvidas" && filtered.length === 0 && totalBeforeStatusFilter > 0
    );
    // Shuffle once per filter change (Fisher-Yates)
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    const mapped = filtered.map(q => {
      const { alternativas, gabarito } = getAlternativas(q);
      return { ...q, alternativas, gabaritoShuffled: gabarito };
    });
    setAllQuestoes(mapped);
    setVisibleCount(PAGE_SIZE);
    setLoading(false);
    setSelectedAnswer({});
    setRevealed({});
  };

  const handleAnswer = (questaoId: number, altIndex: number) => {
    if (revealed[questaoId]) return;
    setSelectedAnswer(prev => ({ ...prev, [questaoId]: altIndex }));
  };

  const handleReveal = async (questaoId: number) => {
    const q = allQuestoes.find(q => q.id === questaoId);
    if (!q) return;

    const selected = selectedAnswer[questaoId];
    const isCorrect = selected === q.gabaritoShuffled;

    setRevealed(prev => ({ ...prev, [questaoId]: true }));
    setAnsweredIds(prev => new Set([...prev, questaoId]));

    if (user) {
      const { error } = await supabase.from("respostas_usuario").insert({
        user_id: user.id,
        questao_id: questaoId,
        resposta: selected,
        correta: isCorrect,
      });
      if (error) {
        console.error("Erro ao salvar resposta:", error);
      }
    }
  };

  const getDifficultyColor = (d: string) => {
    if (d === "Fácil") return "bg-success/15 text-success border-success/30";
    if (d === "Médio") return "bg-warning/15 text-warning border-warning/30";
    return "bg-destructive/15 text-destructive border-destructive/30";
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <BackButton />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">
              <span className="text-gradient-primary">Banco de Questões</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {allQuestoes.length} questões disponíveis
              {visibleCount < allQuestoes.length && ` · Mostrando ${visibleCount}`}
            </p>
          </div>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-primary/15 hover:text-primary text-sm font-medium transition-all w-full sm:w-auto"
          >
            <Filter className="w-4 h-4" />
            Filtros
            <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
        </motion.div>

        <AnimatePresence>
          {filterOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 overflow-hidden"
            >
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Disciplina</label>
                <select
                  value={filterDisciplina}
                  onChange={e => { lastFilterKeyRef.current = ""; setFilterDisciplina(e.target.value); }}
                  className="w-full rounded-lg bg-secondary border-none text-sm p-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  <option>Todos</option>
                  {availableDisciplinas.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dificuldade</label>
                <select
                  value={filterDificuldade}
                  onChange={e => { lastFilterKeyRef.current = ""; setFilterDificuldade(e.target.value); }}
                  className="w-full rounded-lg bg-secondary border-none text-sm p-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  {dificuldades.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => { lastFilterKeyRef.current = ""; setFilterStatus(e.target.value); }}
                  className="w-full rounded-lg bg-secondary border-none text-sm p-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  {statusOptions.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : allAnsweredInDisciplina ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 glass-card rounded-xl space-y-4">
            <CheckCircle className="w-12 h-12 text-success mx-auto" />
            <p className="text-lg font-bold text-foreground">Parabéns! 🎉</p>
            <p className="text-sm text-muted-foreground">
              Você concluiu todas as questões{filterDisciplina !== "Todos" ? ` de ${filterDisciplina}` : ""}!
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { lastFilterKeyRef.current = ""; setFilterStatus("Resolvidas"); }}>
                Revisar Respondidas
              </Button>
              <Button variant="outline" onClick={() => { lastFilterKeyRef.current = ""; setFilterStatus("Apenas Erradas"); }}>
                Revisar Erradas
              </Button>
            </div>
          </motion.div>
        ) : allQuestoes.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Nenhuma questão encontrada</p>
            <p className="text-sm">Tente alterar os filtros</p>
          </div>
        ) : (
          <div className="space-y-6">
            {questoes.map((q, qi) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(qi * 0.03, 0.3) }}
                className="glass-card rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                      {q.disciplina}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(q.dificuldade)}`}>
                      {q.dificuldade}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{q.assunto}</span>
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

                <p className="text-sm leading-relaxed text-foreground">{q.enunciado}</p>

                <div className="space-y-2">
                  {q.alternativas.map((alt, ai) => {
                    const isSelected = selectedAnswer[q.id] === ai;
                    const isCorrect = q.gabaritoShuffled === ai;
                    const isRevealed = revealed[q.id];

                    let altClass = "bg-secondary/50 hover:bg-secondary border-transparent";
                    if (isRevealed && isCorrect) {
                      altClass = "bg-success/10 border-success/40 text-success";
                    } else if (isRevealed && isSelected && !isCorrect) {
                      altClass = "bg-destructive/10 border-destructive/40 text-destructive";
                    } else if (isSelected) {
                      altClass = "bg-primary/10 border-primary/40 text-primary";
                    }

                    return (
                      <button
                        key={ai}
                        onClick={() => handleAnswer(q.id, ai)}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border text-sm transition-all duration-200 ${altClass}`}
                      >
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

                {selectedAnswer[q.id] !== undefined && !revealed[q.id] && (
                  <button
                    onClick={() => handleReveal(q.id)}
                    className="w-full py-2.5 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Confirmar Resposta
                  </button>
                )}

                <AnimatePresence>
                  {revealed[q.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-4 rounded-lg bg-primary/5 border border-primary/20"
                    >
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

            {/* Infinite scroll sentinel */}
            {visibleCount < allQuestoes.length && (
              <div ref={sentinelRef} className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando mais questões...</span>
              </div>
            )}
          </div>
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
};

export default Questoes;
