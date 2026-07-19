import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FormattedText } from "@/components/FormattedText";
import { QuestaoComentario } from "@/components/QuestaoComentario";
import { Button } from "@/components/ui/button";
import {
  CalendarClock, Loader2, Clock, Trophy, AlertTriangle, CheckCircle2, XCircle,
  Flag, ShieldCheck, Award, Lock, ListChecks, Target, History, ChevronRight, ArrowLeft, Scissors, Gavel,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

import { AnaliseDificuldade, type DesempenhoItem } from "@/components/AnaliseDificuldade";
import {
  EDITAL_DISTRIBUICAO, NOTA_MINIMA_APROVACAO, VAGAS_CLASSIFICACAO,
  PONTUACAO_TOTAL, situacaoLabel,
} from "@/lib/edital-distribuicao";

const LETRAS = ["A", "B", "C", "D", "E"];

interface QuestaoTaking {
  id: string;
  ordem: number;
  disciplina: string;
  assunto: string;
  dificuldade: string;
  enunciado: string;
  alt_a: string; alt_b: string; alt_c: string; alt_d: string; alt_e: string;
}
interface QuestaoFull extends QuestaoTaking { gabarito: number; comentario: string; anulada?: boolean; }
interface HistoricoItem {
  id: string; titulo: string; descricao: string | null;
  starts_at: string; ends_at: string; total_questoes: number;
  acertos: number; pontuacao: number; finished_at: string;
}

type Phase = "loading" | "none" | "intro" | "taking" | "results";

function fmtTime(s: number) {
  if (s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const alts = (q: QuestaoTaking) => [q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e];

const SimuladoSemanal = () => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [simulado, setSimulado] = useState<any>(null);
  const [disponiveis, setDisponiveis] = useState<any[]>([]);
  const [questoes, setQuestoes] = useState<QuestaoTaking[]>([]);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [cortadas, setCortadas] = useState<Record<string, number[]>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // resultados
  const [resultQuestoes, setResultQuestoes] = useState<QuestaoFull[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [tentativaResult, setTentativaResult] = useState<any>(null);

  // histórico / revisão de simulados anteriores
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [revisao, setRevisao] = useState<{ simulado: any; tentativa: any; questoes: QuestaoFull[]; ranking: any[] } | null>(null);
  const [loadingRevisao, setLoadingRevisao] = useState<string | null>(null);

  const respostasRef = useRef(respostas);
  respostasRef.current = respostas;
  const savedSig = useRef("");

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("simulado-semanal", { body: { action, ...extra } });
    if (error) {
      // tenta extrair mensagem do corpo
      try {
        const ctx = (error as any).context;
        if (ctx) { const j = await ctx.json(); return { data: j, error: j?.error ? j : null }; }
      } catch { /* noop */ }
      return { data: null, error };
    }
    return { data, error: null };
  }, []);

  const carregarResultados = useCallback(async (simId: string) => {
    const { data } = await call("results", { simulado_id: simId });
    if (data && !data.error) {
      setResultQuestoes(data.questoes || []);
      setRanking(data.ranking || []);
      setTentativaResult(data.tentativa);
      setSimulado(data.simulado);
      setPhase("results");
    } else {
      setPhase("intro");
    }
  }, [call]);

  const carregarHistorico = useCallback(async () => {
    const { data } = await call("history");
    if (data && !data.error) setHistorico((data.historico as HistoricoItem[]) || []);
  }, [call]);

  const abrirRevisao = useCallback(async (simId: string) => {
    setLoadingRevisao(simId);
    const { data } = await call("results", { simulado_id: simId });
    setLoadingRevisao(null);
    if (data && !data.error) {
      setRevisao({
        simulado: data.simulado,
        tentativa: data.tentativa,
        questoes: data.questoes || [],
        ranking: data.ranking || [],
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toast.error(data?.message || "Não foi possível abrir a revisão.");
    }
  }, [call]);

  // ── init ──
  useEffect(() => {
    (async () => {
      carregarHistorico();
      const { data } = await call("status");
      if (!data || !data.simulado) { setPhase("none"); return; }
      setSimulado(data.simulado);
      setDisponiveis((data.disponiveis as any[]) || []);
      const t = data.tentativa;
      if (t?.status === "finished") {
        await carregarResultados(data.simulado.id);
      } else if (t?.status === "in_progress") {
        // retoma automaticamente
        await iniciar(data.simulado.id, true);
      } else {
        setPhase("intro");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciar = useCallback(async (simId: string, silent = false) => {
    const { data, error } = await call("start", { simulado_id: simId });
    if (error || !data || data.error) {
      const msg = data?.message || data?.error || "Não foi possível iniciar.";
      if (data?.error === "already_done" || data?.error === "expired") {
        await carregarResultados(simId);
        return;
      }
      if (!silent) toast.error(msg);
      setPhase("intro");
      return;
    }
    setSimulado(data.simulado);
    setQuestoes(data.questoes || []);
    setRespostas((data.tentativa?.respostas as Record<string, number>) || {});
    setRemaining(data.remaining_seconds || 0);
    setPhase("taking");
  }, [call, carregarResultados]);

  // ── countdown ──
  useEffect(() => {
    if (phase !== "taking") return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(id); finalizar(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── autosave a cada 25s ──
  useEffect(() => {
    if (phase !== "taking" || !simulado) return;
    const id = setInterval(() => {
      const sig = JSON.stringify(respostasRef.current);
      if (sig === savedSig.current) return;
      savedSig.current = sig;
      call("save", { simulado_id: simulado.id, respostas: respostasRef.current });
    }, 25000);
    return () => clearInterval(id);
  }, [phase, simulado, call]);

  const responder = (qid: string, idx: number) => {
    setRespostas((prev) => ({ ...prev, [qid]: idx }));
  };

  const toggleCortada = (qid: string, idx: number) => {
    setCortadas((prev) => {
      const atual = prev[qid] || [];
      const nova = atual.includes(idx) ? atual.filter((i) => i !== idx) : [...atual, idx];
      return { ...prev, [qid]: nova };
    });
    // ao cortar a alternativa marcada, remove a seleção
    setRespostas((prev) => (prev[qid] === idx ? (() => { const n = { ...prev }; delete n[qid]; return n; })() : prev));
  };

  const respondidas = Object.keys(respostas).length;

  const finalizar = useCallback(async (auto = false) => {
    if (!simulado) return;
    if (!auto && respondidas < questoes.length) {
      if (!confirm(`Você respondeu ${respondidas} de ${questoes.length} questões. Deseja finalizar mesmo assim? Você tem apenas 1 tentativa.`)) return;
    }
    setSubmitting(true);
    const { data, error } = await call("submit", { simulado_id: simulado.id, respostas: respostasRef.current });
    setSubmitting(false);
    if (error || !data || data.error) {
      toast.error(data?.error || "Erro ao enviar. Tente novamente.");
      return;
    }
    if (auto) toast.info("Tempo esgotado — simulado enviado automaticamente.");
    else toast.success("Simulado finalizado!");
    await carregarResultados(simulado.id);
  }, [simulado, respondidas, questoes.length, call, carregarResultados]);

  // ─────────────────────── RENDER ───────────────────────
  if (phase === "loading") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  // ── Revisão de um simulado anterior (sobrepõe o conteúdo normal) ──
  if (revisao) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="outline" onClick={() => setRevisao(null)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Voltar aos simulados
          </Button>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-primary shrink-0" />
            Você está revisando um simulado anterior. Confira suas respostas e leia os comentários.
          </div>
          <ResultsView
            simulado={revisao.simulado}
            tentativa={revisao.tentativa}
            questoes={revisao.questoes}
            ranking={revisao.ranking}
            userId={user?.id}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />

        {phase === "none" && (
          <div className="glass-card rounded-2xl p-10 text-center space-y-3">
            <CalendarClock className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <h1 className="text-xl font-bold">Nenhum simulado semanal aberto</h1>
            <p className="text-sm text-muted-foreground">
              Fique de olho! Toda semana um novo simulado oficial será liberado aqui, valendo posição no ranking.
            </p>
          </div>
        )}

        {phase === "intro" && simulado && (
          <>
            <IntroCard simulado={simulado} onStart={() => iniciar(simulado.id)} />
            <OutrosDisponiveis
              atualId={simulado.id}
              disponiveis={disponiveis}
              onSelecionar={(s) => { setSimulado(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          </>
        )}

        {phase === "results" && simulado && disponiveis.some((d) => d.id !== simulado.id) && (
          <OutrosDisponiveis
            atualId={simulado.id}
            disponiveis={disponiveis}
            onSelecionar={async (s) => {
              setSimulado(s);
              setPhase("intro");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {phase === "taking" && simulado && (
          <>
            {/* Timer fixo */}
            <div className="sticky top-2 z-20">
              <div className={`glass-card rounded-xl p-3 flex items-center justify-between gap-3 border ${remaining < 600 ? "border-destructive/50 bg-destructive/5" : "border-primary/30"}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className={`w-5 h-5 shrink-0 ${remaining < 600 ? "text-destructive" : "text-primary"}`} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tempo restante</p>
                    <p className={`font-mono font-bold text-lg leading-none ${remaining < 600 ? "text-destructive" : ""}`}>{fmtTime(remaining)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Respondidas</p>
                  <p className="font-bold text-lg leading-none">{respondidas}/{questoes.length}</p>
                </div>
                <Button onClick={() => finalizar(false)} disabled={submitting} className="gradient-primary shrink-0">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Flag className="w-4 h-4 mr-1.5" />Finalizar</>}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {questoes.map((q, i) => (
                <div key={q.id} className="glass-card rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">Questão {i + 1}</span>
                    <span className="text-[11px] text-muted-foreground">{q.disciplina}</span>
                  </div>
                  <div className="text-sm leading-relaxed"><FormattedText text={q.enunciado} /></div>
                  <div className="space-y-2">
                    {alts(q).map((alt, idx) => {
                      const sel = respostas[q.id] === idx;
                      const cut = (cortadas[q.id] || []).includes(idx);
                      return (
                        <div
                          key={idx}
                          className={`w-full flex items-stretch gap-2 rounded-lg border transition-all ${sel ? "border-primary bg-primary/10 ring-1 ring-primary" : cut ? "border-border/40 bg-secondary/20" : "border-border/60 hover:border-primary/40 hover:bg-secondary/40"}`}
                        >
                          <button
                            type="button"
                            onClick={() => !cut && responder(q.id, idx)}
                            disabled={cut}
                            className={`flex-1 text-left flex gap-3 p-3 ${cut ? "opacity-45 line-through cursor-default" : ""}`}
                          >
                            <span translate="no" className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${sel ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{LETRAS[idx]}</span>
                            <span className="text-sm"><FormattedText text={alt} /></span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCortada(q.id, idx)}
                            aria-label={cut ? "Restaurar alternativa" : "Cortar alternativa"}
                            title={cut ? "Restaurar alternativa" : "Cortar alternativa"}
                            className={`shrink-0 px-3 flex items-center justify-center rounded-r-lg transition-colors ${cut ? "text-primary" : "text-muted-foreground hover:text-destructive"}`}
                          >
                            <Scissors className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={() => finalizar(false)} disabled={submitting} className="w-full gradient-primary h-12">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Flag className="w-4 h-4 mr-2" />Finalizar e enviar simulado</>}
            </Button>
          </>
        )}

        {phase === "results" && simulado && (
          <ResultsView
            simulado={simulado}
            tentativa={tentativaResult}
            questoes={resultQuestoes}
            ranking={ranking}
            userId={user?.id}
          />
        )}

        {/* ── Desempenho em simulados anteriores ── */}
        {phase !== "taking" && (
          <HistoricoSimulados
            historico={historico}
            loadingId={loadingRevisao}
            onAbrir={abrirRevisao}
          />
        )}
      </div>
    </AppLayout>
  );
};
// ── Outros simulados disponíveis para responder ──
function OutrosDisponiveis({ atualId, disponiveis, onSelecionar }: {
  atualId: string; disponiveis: any[]; onSelecionar: (s: any) => void;
}) {
  const outros = (disponiveis || []).filter((s) => s.id !== atualId);
  if (outros.length === 0) return null;
  return (
    <div className="glass-card rounded-xl p-5 space-y-3 border border-primary/20">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" /> Outros simulados abertos para você
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Simulados reabertos pelo administrador que você ainda não respondeu. Você tem 1 tentativa em cada.
        </p>
      </div>
      <div className="space-y-2">
        {outros.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelecionar(s)}
            className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50 transition-all"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{s.titulo}</p>
              <p className="text-[11px] text-muted-foreground">
                {s.total_questoes} questões • encerra em {new Date(s.ends_at).toLocaleString("pt-BR")}
                {s.em_andamento && <span className="ml-2 text-warning font-semibold">• em andamento</span>}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}


// ── Histórico de simulados anteriores (liberados p/ revisão) ──
function HistoricoSimulados({ historico, loadingId, onAbrir }: {
  historico: HistoricoItem[]; loadingId: string | null; onAbrir: (id: string) => void;
}) {
  if (historico.length === 0) return null;
  return (
    <div className="glass-card rounded-xl p-5 space-y-3">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Seu desempenho em simulados anteriores</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Reveja suas respostas certas e erradas, releia as questões e os comentários dos simulados já liberados.
        </p>
      </div>
      <div className="space-y-2">
        {historico.map((h) => {
          const total = h.total_questoes || 0;
          const pct = total > 0 ? Math.round((h.acertos / total) * 100) : 0;
          return (
            <button
              key={h.id}
              onClick={() => onAbrir(h.id)}
              disabled={loadingId === h.id}
              className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50 transition-all"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{h.titulo}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(h.finished_at).toLocaleDateString("pt-BR")} • {h.acertos}/{total} acertos ({pct}%)
                </p>
              </div>
              <span className="text-sm font-bold text-gradient-primary shrink-0">{Number(h.pontuacao).toFixed(1)} pts</span>
              {loadingId === h.id
                ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Intro ──
function IntroCard({ simulado, onStart }: { simulado: any; onStart: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex items-center gap-2 text-primary">
          <CalendarClock className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Simulado Semanal Oficial</span>
        </div>
        <h1 className="text-2xl font-bold">{simulado.titulo}</h1>
        {simulado.descricao && <p className="text-sm text-muted-foreground">{simulado.descricao}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={<ListChecks className="w-4 h-4" />} label="Questões" value={`${simulado.total_questoes}`} />
          <Stat icon={<Clock className="w-4 h-4" />} label="Tempo" value={`${Math.round(simulado.duracao_minutos / 60)}h`} />
          <Stat icon={<Award className="w-4 h-4" />} label="Pontuação" value={`${PONTUACAO_TOTAL} pts`} />
          <Stat icon={<Lock className="w-4 h-4" />} label="Tentativas" value="1 única" />
        </div>

        <div className="rounded-xl bg-secondary/40 p-4 space-y-2 text-xs">
          <p className="font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" /> Regras (conforme o edital)</p>
          <ul className="space-y-1 text-muted-foreground list-disc pl-5">
            <li>Distribuição fiel ao Conteúdo Programático (Anexo II).</li>
            <li><strong className="text-foreground">Aprovado:</strong> nota ≥ {NOTA_MINIMA_APROVACAO},0 pontos.</li>
            <li><strong className="text-foreground">Classificado:</strong> aprovado dentro das {VAGAS_CLASSIFICACAO} vagas, por ordem decrescente de pontuação.</li>
            <li>O cronômetro de {Math.round(simulado.duracao_minutos / 60)}h <strong className="text-foreground">não pausa</strong> após iniciar — corre mesmo se você sair.</li>
            <li>Você tem <strong className="text-foreground">apenas 1 tentativa</strong>. Use com estratégia.</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {EDITAL_DISTRIBUICAO.map((d) => (
            <span key={d.nome} className="text-[11px] px-2 py-1 rounded bg-primary/10 text-primary/90">{d.nome}: {d.questoes}</span>
          ))}
        </div>

        {!confirming ? (
          <Button onClick={() => setConfirming(true)} className="w-full gradient-primary h-12 text-base font-bold">
            Iniciar Simulado
          </Button>
        ) : (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 space-y-3">
            <p className="text-sm flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" /> Ao iniciar, o cronômetro começa imediatamente e <strong>não há volta</strong>. Está pronto?</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)} className="flex-1">Ainda não</Button>
              <Button onClick={onStart} className="flex-1 gradient-primary">Sim, iniciar agora</Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3 text-center">
      <div className="flex items-center justify-center text-primary mb-1">{icon}</div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}

// ── Resultados ──
function ResultsView({ simulado, tentativa, questoes, ranking, userId }: {
  simulado: any; tentativa: any; questoes: QuestaoFull[]; ranking: any[]; userId?: string;
}) {
  const minha = useMemo(() => ranking.find((r) => r.user_id === userId), [ranking, userId]);
  const pontuacao = Number(tentativa?.pontuacao ?? 0);
  const aprovado = pontuacao >= NOTA_MINIMA_APROVACAO;
  const situacao = minha?.situacao || (aprovado ? "aprovado_nao_classificado" : "reprovado");
  const respostas: Record<string, number> = tentativa?.respostas || {};
  const [modoAnalise, setModoAnalise] = useState<"disciplina" | "assunto">("disciplina");

  const analiseItems = useMemo<DesempenhoItem[]>(() => {
    const map: Record<string, { total: number; corretas: number }> = {};
    for (const q of questoes) {
      const raw = modoAnalise === "assunto" ? q.assunto : q.disciplina;
      const name = (raw || "").trim() || "Geral";
      if (!map[name]) map[name] = { total: 0, corretas: 0 };
      map[name].total++;
      const acertou = q.anulada || respostas[q.id] === q.gabarito;
      if (acertou) map[name].corretas++;
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [questoes, respostas, modoAnalise]);

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className={`glass-card rounded-2xl p-6 text-center space-y-3 border ${situacao === "classificado" ? "border-success/40" : aprovado ? "border-warning/40" : "border-destructive/40"}`}>
        <Trophy className={`w-10 h-10 mx-auto ${situacao === "classificado" ? "text-gold" : aprovado ? "text-warning" : "text-destructive"}`} />
        <h1 className="text-2xl font-bold">{simulado.titulo}</h1>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-5xl font-bold text-gradient-primary">{pontuacao.toFixed(1)}</span>
          <span className="text-muted-foreground">/ {PONTUACAO_TOTAL} pts</span>
        </div>
        <p className="text-sm text-muted-foreground">{tentativa?.acertos} de {questoes.length} questões corretas</p>
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${situacao === "classificado" ? "bg-success/15 text-success" : aprovado ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
          {situacaoLabel(situacao)}
        </span>
        {minha && <p className="text-xs text-muted-foreground">Sua posição no ranking: <strong className="text-foreground">{minha.posicao}º</strong></p>}
      </motion.div>

      {/* Ranking */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-gold" /> Ranking do Simulado</h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground">Seja o primeiro a finalizar!</p>
        ) : (
          <div className="space-y-1">
            {ranking.slice(0, VAGAS_CLASSIFICACAO).map((r) => {
              const eu = r.user_id === userId;
              return (
                <div key={r.user_id} className={`flex items-center gap-3 p-2.5 rounded-lg ${eu ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"}`}>
                  <span className="w-8 text-center font-bold text-sm">{r.posicao <= 3 ? ["🥇","🥈","🥉"][r.posicao - 1] : `${r.posicao}º`}</span>
                  <span className="flex-1 truncate text-sm">{r.nome}{eu && <span className="text-[10px] text-primary ml-1">(você)</span>}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] hidden sm:inline ${r.situacao === "classificado" ? "bg-success/15 text-success" : r.situacao === "aprovado_nao_classificado" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>{situacaoLabel(r.situacao)}</span>
                  <span className="font-bold text-sm w-16 text-right">{Number(r.pontuacao).toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Análise de desempenho por assunto/disciplina */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Análise de desempenho</h2>
          <div className="flex rounded-lg border border-border/60 p-0.5 bg-secondary/40 text-xs">
            <button
              onClick={() => setModoAnalise("disciplina")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${modoAnalise === "disciplina" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Por disciplina
            </button>
            <button
              onClick={() => setModoAnalise("assunto")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${modoAnalise === "assunto" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Por assunto
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Veja onde você teve mais dificuldade neste simulado e o que priorizar na revisão.
        </p>
        <AnaliseDificuldade
          items={analiseItems}
          unidade={modoAnalise === "assunto" ? "assunto" : "disciplina"}
          emptyHint="Sem dados para esta visão."
        />
      </div>

      {/* Revisão / gabarito */}
      <div className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" /> Gabarito e revisão</h2>
        {questoes.map((q, i) => {
          const minhaResp = respostas[q.id];
          const acertou = q.anulada || minhaResp === q.gabarito;
          return (
            <div key={q.id} className="glass-card rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">Questão {i + 1}</span>
                <span className="text-[11px] text-muted-foreground">{q.disciplina}</span>
                {q.anulada ? (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Anulada — ponto concedido</span>
                ) : minhaResp === undefined ? (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Em branco</span>
                ) : acertou ? (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-success/15 text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Acertou</span>
                ) : (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" />Errou</span>
                )}
              </div>
              <div className="text-sm leading-relaxed"><FormattedText text={q.enunciado} /></div>
              <div className="space-y-2">
                {alts(q).map((alt, idx) => {
                  const isGab = idx === q.gabarito;
                  const isMinha = idx === minhaResp;
                  return (
                    <div key={idx} className={`flex gap-3 p-3 rounded-lg border text-sm ${isGab ? "border-success bg-success/10" : isMinha ? "border-destructive bg-destructive/10" : "border-border/40"}`}>
                      <span translate="no" className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isGab ? "bg-success text-white" : isMinha ? "bg-destructive text-white" : "bg-secondary"}`}>{LETRAS[idx]}</span>
                      <span className="flex-1"><FormattedText text={alt} /></span>
                    </div>
                  );
                })}
              </div>
              {q.comentario && <QuestaoComentario comentario={q.comentario} />}
              <RecursoQuestao simuladoId={simulado.id} questaoId={q.id} />
            </div>

          );
        })}
      </div>
    </div>
  );
}

export default SimuladoSemanal;

function RecursoQuestao({ simuladoId, questaoId }: { simuladoId: string; questaoId: string }) {
  const [existing, setExisting] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [argumento, setArgumento] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadRecurso = useCallback(async () => {
    const { data } = await supabase
      .from("simulado_semanal_recursos")
      .select("id, argumento, status, decisao_admin")
      .eq("questao_id", questaoId)
      .maybeSingle();
    setExisting(data);
    if (data) setArgumento(data.argumento);
    setLoaded(true);
  }, [questaoId]);

  useEffect(() => { loadRecurso(); }, [loadRecurso]);

  const submit = async () => {
    if (argumento.trim().length < 20) {
      toast.error("Escreva ao menos 20 caracteres de argumentação.");
      return;
    }
    setSaving(true);
    if (existing && existing.status === "pendente") {
      const { error } = await supabase
        .from("simulado_semanal_recursos")
        .update({ argumento: argumento.trim() })
        .eq("id", existing.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Recurso atualizado.");
      setOpen(false);
      loadRecurso();
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const { error } = await supabase.from("simulado_semanal_recursos").insert({
        simulado_id: simuladoId,
        questao_id: questaoId,
        user_id: user.id,
        argumento: argumento.trim(),
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Recurso enviado para análise.");
      setOpen(false);
      loadRecurso();
    }
  };

  if (!loaded) return null;

  const badge = existing?.status === "procedente"
    ? { cls: "bg-success/15 text-success", label: "Recurso deferido — questão anulada" }
    : existing?.status === "improcedente"
      ? { cls: "bg-destructive/15 text-destructive", label: "Recurso indeferido" }
      : existing
        ? { cls: "bg-warning/15 text-warning", label: "Recurso em análise" }
        : null;

  return (
    <div className="pt-2 border-t border-border/40 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1.5"
        >
          <Gavel className="w-3.5 h-3.5" />
          {existing ? (existing.status === "pendente" ? "Editar recurso" : "Ver recurso") : "Abrir recurso"}
        </button>
        {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>}
      </div>
      {open && (
        <div className="space-y-2">
          <Textarea
            value={argumento}
            onChange={(e) => setArgumento(e.target.value)}
            placeholder="Exponha, com fundamento, por que a questão deve ser anulada ou o gabarito alterado..."
            className="min-h-[100px] text-sm"
            disabled={!!existing && existing.status !== "pendente"}
          />
          {existing?.status !== "pendente" && existing?.decisao_admin && (
            <div className="text-xs bg-secondary/40 rounded p-2">
              <strong>Resposta do professor:</strong> {existing.decisao_admin}
            </div>
          )}
          {(!existing || existing.status === "pendente") && (
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={saving} className="gradient-primary">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Gavel className="w-3.5 h-3.5 mr-1.5" />}
                {existing ? "Atualizar recurso" : "Enviar recurso"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

