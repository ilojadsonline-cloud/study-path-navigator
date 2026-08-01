import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, AlertTriangle } from "lucide-react";
import {
  getChoaEvents,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  getDaysUntil,
  getNextMainEvent,
  getUpcomingEvents,
  getUrgency,
  isHighPriorityCategory,
  parseEventDate,
  type UrgencyLevel,
} from "@/lib/choa-calendar";
import { useCurso } from "@/contexts/CursoContext";

const URGENCY_STYLES: Record<UrgencyLevel, { badge: string; dot: string }> = {
  hoje: { badge: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  amanha: { badge: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  critico: { badge: "bg-warning/15 text-warning border-warning/30", dot: "bg-warning" },
  atencao: { badge: "bg-gold/15 text-gold border-gold/30", dot: "bg-gold" },
  em_breve: { badge: "bg-success/10 text-success border-success/25", dot: "bg-success" },
  concluido: { badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};

function formatDate(date: string): string {
  return parseEventDate(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CalendarioInteligente() {
  // Atualiza a cada minuto para manter o contador correto ao virar o dia
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const { cursoSlug, cursoAtivo } = useCurso();
  const eventos = useMemo(() => getChoaEvents(cursoSlug), [cursoSlug]);
  const mainEvent = useMemo(() => getNextMainEvent(eventos, now), [eventos, now]);
  const upcoming = useMemo(() => getUpcomingEvents(eventos, now), [eventos, now]);
  const diasRestantes = mainEvent ? getDaysUntil(mainEvent.date, now) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card rounded-xl p-4 sm:p-5 min-w-0"
    >
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-5 h-5 text-gold shrink-0" />
        <h2 className="font-semibold text-sm sm:text-base">Calendário CHOA 2026 {cursoAtivo?.sigla ? `• ${cursoAtivo.sigla}` : ""}</h2>
      </div>

      {/* Contador regressivo */}
      {mainEvent && diasRestantes !== null ? (
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/25 p-4 mb-4">
          <p className="text-xs text-muted-foreground">
            {diasRestantes === 0 ? "É hoje!" : "Faltam"}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gradient-primary leading-tight">
            {diasRestantes === 0
              ? mainEvent.title
              : `${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`}
          </p>
          {diasRestantes !== 0 && (
            <p className="text-xs sm:text-sm font-medium mt-0.5">para {mainEvent.title}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Data: {formatDate(mainEvent.date)} • {CATEGORY_LABELS[mainEvent.category]}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-secondary/40 border border-border/40 p-4 mb-4 text-center">
          <p className="text-sm font-semibold">Processo seletivo finalizado.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Acompanhe os comunicados oficiais.
          </p>
        </div>
      )}

      {/* Lista de próximos eventos */}
      {upcoming.length === 0 ? (
        <div className="text-center py-6">
          <CalendarClock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum evento futuro no cronograma.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.slice(0, 5).map((event) => {
            const urgency = getUrgency(event.date, now);
            const styles = URGENCY_STYLES[urgency];
            const highlight = isHighPriorityCategory(event.category);
            return (
              <div
                key={event.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  highlight ? "bg-secondary/50" : "bg-secondary/30"
                } hover:bg-secondary/70`}
              >
                <span className={`w-1.5 h-9 rounded-full shrink-0 ${styles.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{event.title}</p>
                    {event.isCritical && (urgency === "critico" || urgency === "hoje" || urgency === "amanha") && (
                      <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(event.date)} • {CATEGORY_LABELS[event.category]}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${styles.badge}`}
                >
                  {URGENCY_LABELS[urgency]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
