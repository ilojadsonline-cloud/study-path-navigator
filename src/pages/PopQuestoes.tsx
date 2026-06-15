import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { CheckCircle, XCircle, HelpCircle, Loader2, Flag, Scissors, RotateCcw, Lock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuestaoComentario } from "@/components/QuestaoComentario";
import { FormattedText } from "@/components/FormattedText";

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

const PAGE_SIZE = 20;
const STORAGE_KEY = "choa_pop_questoes_state_v1";

type QuestaoMapped = Questao & { alternativas: string[]; gabaritoShuffled: number };

const PopSigilosoBanner = () => (
  <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
    <Lock className="w-5 h-5 shrink-0 mt-0.5" />
    <div className="text-xs leading-relaxed space-y-2">
      <p>
        <strong>Conteúdo sigiloso — acesso restrito.</strong> Este material (questões, comentários e
        todo o conteúdo desta página) refere-se ao Procedimento Operacional Padrão (POP) da PMTO,
        documento de grau <strong>RESERVADO</strong> nos termos da <strong>Portaria nº 021/2015-Gab.</strong>
        (PMTO), com base no art. 10 da Lei Complementar nº 79/2012 e nos arts. 24 e 27, III c/c art. 45
        da Lei nº 12.527/2011.
      </p>
      <p className="text-muted-foreground">
        É <strong>proibido</strong> reproduzir, copiar, imprimir, encaminhar, divulgar ou compartilhar,
        total ou parcialmente, qualquer conteúdo desta página por qualquer meio. O acesso é pessoal e
        intransferível, restrito a militares autorizados da PMTO. <strong>Qualquer reprodução ou
        compartilhamento é de inteira e exclusiva responsabilidade do usuário</strong>, sujeitando-o às
        sanções administrativas, disciplinares e legais cabíveis.
      </p>
    </div>
  </div>
);

const PopQuestoes = () => {
  const { user } = useAuth();

  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const [allQuestoes, setAllQuestoes] = useState<QuestaoMapped[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [crossedOut, setCrossedOut] = useState<Record<number, number[]>>({});
  const [answeredIds, setAnsweredIds] = useState<Set<number>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportQuestaoId, setReportQuestaoId] = useState<number | null>(null);
  const [reportMotivo, setReportMotivo] = useState("");
  const [reportSending, setReportSending] = useState(false);

  const topRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(allQuestoes.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const questoes = allQuestoes.slice(startIdx, startIdx + PAGE_SIZE);

  // Check restricted access
  useEffect(() => {
    const check = async () => {
      if (!user) {
        setAccessChecked(true);
        setHasAccess(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_pop_access");
      setHasAccess(!error && data === true);
      setAccessChecked(true);
    };
    check();
  }, [user]);

  // Persist progress
  useEffect(() => {
    if (loading || allQuestoes.length === 0) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ orderIds: allQuestoes.map((q) => q.id), currentPage: safePage, selectedAnswer, revealed }),
      );
    } catch {}
  }, [allQuestoes, safePage, selectedAnswer, revealed, loading]);

  useEffect(() => {
    if (!accessChecked || !hasAccess) return;
    fetchQuestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessChecked, hasAccess]);

  const fetchQuestoes = async () => {
    setLoading(true);

    // answered ids
    const answered = new Set<number>();
    if (user) {
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("respostas_usuario")
          .select("questao_id")
          .eq("user_id", user.id)
          .range(from, from + batchSize - 1);
        if (!data || data.length === 0) break;
        data.forEach((d: any) => answered.add(d.questao_id));
        if (data.length < batchSize) break;
        from += batchSize;
      }
    }
    setAnsweredIds(answered);

    let allData: Questao[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("questoes")
        .select("*")
        .eq("disciplina", "POP")
        .in("audit_status", ["approved", "auto_corrected", "admin_resolved"])
        .order("id")
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData.push(...(data as Questao[]));
      if (data.length < batchSize) break;
      from += batchSize;
    }

    // Restore prior order if present
    let ordered = allData;
    let restoredPage = 1;
    let restoredSelected: Record<number, number> = {};
    let restoredRevealed: Record<number, boolean> = {};
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.orderIds) && p.orderIds.length) {
          const byId = new Map(allData.map((q) => [q.id, q] as const));
          const out: Questao[] = [];
          for (const id of p.orderIds) {
            const q = byId.get(id);
            if (q) { out.push(q); byId.delete(id); }
          }
          ordered = [...out, ...byId.values()];
          restoredPage = p.currentPage || 1;
          restoredSelected = p.selectedAnswer || {};
          restoredRevealed = p.revealed || {};
        }
      } else {
        for (let i = ordered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
        }
      }
    } catch {}

    const mapped: QuestaoMapped[] = ordered.map((q) => ({
      ...q,
      alternativas: [q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e],
      gabaritoShuffled: q.gabarito,
    }));

    setAllQuestoes(mapped);
    setCurrentPage(restoredPage);
    setSelectedAnswer(restoredSelected);
    setRevealed(restoredRevealed);
    setLoading(false);
  };

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

  const handleAnswer = (questaoId: number, altIndex: number) => {
    if (revealed[questaoId]) return;
    if ((crossedOut[questaoId] || []).includes(altIndex)) return;
    setSelectedAnswer((prev) => ({ ...prev, [questaoId]: altIndex }));
  };

  const toggleCrossed = (questaoId: number, altIndex: number) => {
    if (revealed[questaoId]) return;
    setCrossedOut((prev) => {
      const current = prev[questaoId] || [];
      const next = current.includes(altIndex) ? current.filter((i) => i !== altIndex) : [...current, altIndex];
      return { ...prev, [questaoId]: next };
    });
    setSelectedAnswer((prev) => {
      if (prev[questaoId] === altIndex && !(crossedOut[questaoId] || []).includes(altIndex)) {
        const { [questaoId]: _omit, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  };

  const handleReveal = async (questaoId: number) => {
    const q = allQuestoes.find((q) => q.id === questaoId);
    if (!q) return;
    const selected = selectedAnswer[questaoId];
    const isCorrect = selected === q.gabaritoShuffled;
    setRevealed((prev) => ({ ...prev, [questaoId]: true }));
    setAnsweredIds((prev) => new Set([...prev, questaoId]));
    if (user) {
      const { error } = await supabase.from("respostas_usuario").insert({
        user_id: user.id,
        questao_id: questaoId,
        resposta: selected,
        correta: isCorrect,
      });
      if (error) console.error("Erro ao salvar resposta:", error);
    }
  };

  const goToPage = (p: number) => {
    const target = Math.max(1, Math.min(p, totalPages));
    setCurrentPage(target);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: topRef.current?.offsetTop ?? 0, behavior: "smooth" });
    }
  };

  const getDifficultyColor = (d: string) => {
    if (d === "Fácil") return "bg-success/15 text-success border-success/30";
    if (d === "Médio") return "bg-warning/15 text-warning border-warning/30";
    return "bg-destructive/15 text-destructive border-destructive/30";
  };

  // ---- Access states ----
  if (!accessChecked) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6 py-10">
          <BackButton />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-2xl p-8 text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Este conteúdo é <strong>sigiloso</strong> e exclusivo para militares da PMTO autorizados.
              Seu acesso só é liberado se o seu CPF constar na lista oficial de autorizados ou mediante
              liberação expressa do administrador.
            </p>
            <p className="text-xs text-muted-foreground">
              Caso você seja militar da PMTO e deva ter acesso, entre em contato com o administrador para
              solicitar a liberação.
            </p>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <BackButton />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-destructive" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">
              <span className="text-gradient-primary">Questões POP</span>
            </h1>
          </div>
          <p ref={topRef} className="text-xs sm:text-sm text-muted-foreground">
            {allQuestoes.length} questões disponíveis
            {totalPages > 1 && ` · Página ${safePage} de ${totalPages}`}
          </p>
        </motion.div>

        <PopSigilosoBanner />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : allQuestoes.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Nenhuma questão disponível ainda</p>
            <p className="text-sm">As questões do POP serão exibidas aqui após a geração.</p>
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
                    <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                      POP · Sigiloso
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

                <FormattedText text={q.enunciado} className="text-sm text-foreground" />

                <div className="space-y-2">
                  {q.alternativas.map((alt, ai) => {
                    const isSelected = selectedAnswer[q.id] === ai;
                    const isCorrect = q.gabaritoShuffled === ai;
                    const isRevealed = revealed[q.id];
                    const isCrossed = !isRevealed && (crossedOut[q.id] || []).includes(ai);

                    let altClass = "bg-secondary/50 border-transparent";
                    if (isRevealed && isCorrect) {
                      altClass = "bg-success/10 border-success/40 text-success";
                    } else if (isRevealed && isSelected && !isCorrect) {
                      altClass = "bg-destructive/10 border-destructive/40 text-destructive";
                    } else if (isSelected) {
                      altClass = "bg-primary/10 border-primary/40 text-primary ring-1 ring-primary/40";
                    } else if (isCrossed) {
                      altClass = "bg-secondary/20 border-transparent";
                    } else {
                      altClass = "bg-secondary/50 hover:bg-secondary border-transparent";
                    }

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
                      className="rounded-lg bg-primary/[0.03] border border-primary/20 p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2 border-b border-primary/15 pb-2">
                        <HelpCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-primary">Comentário do professor</span>
                      </div>
                      <QuestaoComentario comentario={q.comentario} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {totalPages > 1 && (
              <nav aria-label="Paginação de questões" className="flex flex-wrap items-center justify-center gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => goToPage(safePage - 1)} disabled={safePage <= 1}>
                  Anterior
                </Button>
                <span className="px-2 text-sm text-muted-foreground">{safePage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => goToPage(safePage + 1)} disabled={safePage >= totalPages}>
                  Próxima
                </Button>
              </nav>
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

export default PopQuestoes;
