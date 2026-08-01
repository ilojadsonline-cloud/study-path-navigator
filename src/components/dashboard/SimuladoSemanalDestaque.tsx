import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurso } from "@/contexts/CursoContext";
import { CalendarClock, Clock, Trophy, ArrowRight, PlayCircle, CheckCircle2, Loader2 } from "lucide-react";
import { getPontuacaoTotal } from "@/lib/edital-distribuicao";

interface StatusData {
  simulado: any | null;
  tentativa: {
    status: string;
    acertos: number;
    pontuacao: number;
    remaining_seconds: number;
  } | null;
}

function fmtRestante(toIso: string) {
  const diff = new Date(toIso).getTime() - Date.now();
  if (diff <= 0) return "encerrando";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function SimuladoSemanalDestaque() {
  const navigate = useNavigate();
  const { cursoId, cursoSlug } = useCurso();
  const PONTUACAO_TOTAL = getPontuacaoTotal(cursoSlug);
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: res, error } = await supabase.functions.invoke("simulado-semanal", { body: { action: "status", curso_id: cursoId } });
      if (!error && res) setData(res as StatusData);
      setLoading(false);
    })();
  }, [cursoId]);

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.simulado) return null;

  const sim = data.simulado;
  const t = data.tentativa;
  const finished = t?.status === "finished";
  const inProgress = t?.status === "in_progress";

  const accent = finished
    ? "from-success/20 via-success/5"
    : inProgress
    ? "from-warning/20 via-warning/5"
    : "from-primary/25 via-primary/5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br ${accent} to-transparent p-5 sm:p-6`}
    >
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
              <CalendarClock className="w-3 h-3" /> Simulado Semanal
            </span>
            {!t && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/20 text-success animate-pulse">
                NOVO
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold truncate">{sim.titulo}</h3>

          {finished ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Concluído — <strong className="text-foreground">{Number(t!.pontuacao).toFixed(1)}</strong>/{PONTUACAO_TOTAL} pts ({t!.acertos} acertos)
            </p>
          ) : inProgress ? (
            <p className="text-sm text-warning flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Tentativa em andamento — termine antes do tempo acabar!
            </p>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {sim.total_questoes} questões • {Math.round(sim.duracao_minutos / 60)}h • encerra em {fmtRestante(sim.ends_at)}
            </p>
          )}
        </div>

        <button
          onClick={() => navigate("/simulado-semanal")}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity w-full sm:w-auto"
        >
          {finished ? (
            <><Trophy className="w-4 h-4" /> Ver resultado e ranking</>
          ) : inProgress ? (
            <><PlayCircle className="w-4 h-4" /> Continuar simulado</>
          ) : (
            <><PlayCircle className="w-4 h-4" /> Participar agora</>
          )}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
