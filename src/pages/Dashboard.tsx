import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";
import {
  CheckCircle, Target, BookOpen, Clock, TrendingUp, TrendingDown,
  Trophy, Calendar, Flame, Shield, Loader2, FileText, PlayCircle,
  Sparkles, Youtube, Brain, X, ClipboardCheck, ArrowUpRight, BarChart3,
  MessageCircle, ExternalLink
} from "lucide-react";
import { CalendarioInteligente } from "@/components/dashboard/CalendarioInteligente";
import { SimuladoSemanalDestaque } from "@/components/dashboard/SimuladoSemanalDestaque";
import { getBizuAulaDisciplinas, ANALISE_EDITAL_DISC } from "@/lib/edital-structure";
import { AnaliseDificuldade, type DesempenhoItem } from "@/components/AnaliseDificuldade";
import { normalizarDisciplina } from "@/lib/edital-distribuicao";

import { getLocalStudyTimerSnapshot, type TimerState } from "@/hooks/useStudyTimer";
import { useNavigate, Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip,
  RadialBarChart, RadialBar
} from "recharts";

type DisciplinaProgress = { name: string; total: number; corretas: number };
type AtividadeRecente = { text: string; time: string; icon: React.ReactNode; sortDate: Date };
type StudySession = { id: number; duration_seconds: number; started_at: string | null; created_at: string | null };
type BizuAulaItem = { id: string; title: string; subtitle: string; count: number; restricted?: boolean; destaque?: boolean };

function localDateKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getStudySessionDate(session: Pick<StudySession, "started_at" | "created_at">): string | null {
  return session.started_at || session.created_at || null;
}

function mergeLiveStudySession(sessions: StudySession[], live: TimerState | null): StudySession[] {
  if (!live?.sessionId || !live.startedAt) return sessions;
  const liveDelta = Math.max(0, Math.min(60, Math.floor((Date.now() - (live.lastTick || Date.now())) / 1000)));
  const liveDuration = Math.max(0, Math.floor((live.elapsed || 0) + liveDelta));
  let found = false;
  const merged = sessions.map((session) => {
    if (session.id !== live.sessionId) return session;
    found = true;
    return {
      ...session,
      started_at: session.started_at || live.startedAt,
      created_at: session.created_at || live.startedAt,
      duration_seconds: Math.max(session.duration_seconds || 0, liveDuration),
    };
  });
  if (!found) {
    merged.push({ id: live.sessionId, duration_seconds: liveDuration, started_at: live.startedAt, created_at: live.startedAt });
  }
  return merged;
}

function calculateStudyMetrics(sessions: StudySession[]) {
  const todayKey = localDateKey(new Date());
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const totalSec = sessions.reduce((s, x) => s + (x.duration_seconds || 0), 0);
  const todaySec = sessions.filter((session) => {
    const ts = getStudySessionDate(session);
    return ts && localDateKey(ts) === todayKey;
  }).reduce((a, b) => a + (b.duration_seconds || 0), 0);
  const monthSec = sessions.filter((session) => {
    const ts = getStudySessionDate(session);
    return ts && new Date(ts) >= monthStart;
  }).reduce((a, b) => a + (b.duration_seconds || 0), 0);

  const byHour = Array.from({ length: 24 }, (_, h) => ({ h, v: 0 }));
  sessions.filter((session) => {
    const ts = getStudySessionDate(session);
    return ts && localDateKey(ts) === todayKey;
  }).forEach((session) => {
    const ts = getStudySessionDate(session)!;
    byHour[new Date(ts).getHours()].v += (session.duration_seconds || 0) / 60;
  });

  return { totalSec, todaySec, monthSec, byHour };
}

async function fetchAllRespostas(userId: string, cursoFilter: string | null) {
  const PAGE = 1000;
  let all: { id: number; correta: boolean; created_at: string; questao_id: number }[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from("respostas_usuario")
      .select("id, correta, created_at, questao_id, questoes!inner(curso_id)")
      .eq("user_id", userId).order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (cursoFilter) q = q.or(cursoFilter, { referencedTable: "questoes" });
    const { data } = await q;
    if (!data || data.length === 0) break;
    all = all.concat(data as unknown as typeof all);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}


const COLORS = {
  success: "hsl(142, 71%, 45%)",
  destructive: "hsl(0, 84%, 60%)",
  primary: "hsl(217, 91%, 60%)",
  warning: "hsl(38, 92%, 50%)",
  muted: "hsl(215, 20%, 22%)",
};



const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.nome?.split(" ")[0] || "Aspirante";

  const [showNewToolsBanner, setShowNewToolsBanner] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("new_tools_banner_dismissed_v1")
  );
  const dismissNewToolsBanner = () => {
    localStorage.setItem("new_tools_banner_dismissed_v1", "1");
    setShowNewToolsBanner(false);
  };

  const [showWhatsAppBanner, setShowWhatsAppBanner] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("whatsapp_banner_dismissed_v1")
  );
  const dismissWhatsAppBanner = () => {
    localStorage.setItem("whatsapp_banner_dismissed_v1", "1");
    setShowWhatsAppBanner(false);
  };

  const [dailyGoalHours, setDailyGoalHours] = useState<number>(3);
  const [cronogramaInfo, setCronogramaInfo] = useState<{ horasSemanais: number; diasSemana: string[]; nome: string } | null>(null);


  const [loading, setLoading] = useState(true);
  const [totalQuestoes, setTotalQuestoes] = useState(0);
  const [totalRespondidas, setTotalRespondidas] = useState(0);
  const [totalCorretas, setTotalCorretas] = useState(0);
  const [totalSimulados, setTotalSimulados] = useState(0);
  const [horasEstudoTotal, setHorasEstudoTotal] = useState(0);
  const [minutosEstudoHoje, setMinutosEstudoHoje] = useState(0);
  const [horasMesAtual, setHorasMesAtual] = useState(0);
  const [metaMensal, setMetaMensal] = useState(200);
  const [streakDias, setStreakDias] = useState(0);
  const [disciplinas, setDisciplinas] = useState<DisciplinaProgress[]>([]);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [respondidaSemana, setRespondidaSemana] = useState(0);
  const [respondidaSemanaAnterior, setRespondidaSemanaAnterior] = useState(0);
  const [simuladosMes, setSimuladosMes] = useState(0);
  const [simuladosMesAnterior, setSimuladosMesAnterior] = useState(0);
  const [acertosSemana, setAcertosSemana] = useState(0);
  const [acertosSemanaAnterior, setAcertosSemanaAnterior] = useState(0);
  const [sparkRespostas, setSparkRespostas] = useState<{ d: string; v: number }[]>([]);
  const [sparkSimulados, setSparkSimulados] = useState<{ d: string; v: number }[]>([]);
  const [studyByHour, setStudyByHour] = useState<{ h: number; v: number }[]>(
    Array.from({ length: 24 }, (_, h) => ({ h, v: 0 }))
  );
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [incompleteSimulado, setIncompleteSimulado] = useState<{disciplina: string; respondidas: number; total: number} | null>(null);
  const [bizuAulas, setBizuAulas] = useState<BizuAulaItem[]>([]);
  const [diagnostico, setDiagnostico] = useState<DesempenhoItem[]>([]);
  const { cursoId, cursoSlug } = useCurso();

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const cf = cursoOrFilter(cursoId, cursoSlug);

      let qCountQuery = supabase.from("questoes").select("*", { count: "exact", head: true });
      if (cf) qCountQuery = qCountQuery.or(cf);
      const { count: qCount } = await qCountQuery;
      setTotalQuestoes(qCount || 0);

      // Cronograma ativo -> define meta diária
      const { data: cronoData } = await supabase.from("cronogramas")
        .select("nome, horas_semanais, dias_semana")
        .eq("user_id", user.id).eq("ativo", true)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (cronoData && cronoData.dias_semana?.length) {
        const horasDia = cronoData.horas_semanais / cronoData.dias_semana.length;
        setDailyGoalHours(Math.round(horasDia * 10) / 10);
        // Meta mensal derivada do cronograma: horas_semanais * ~4.33 semanas/mês
        setMetaMensal(Math.round(cronoData.horas_semanais * 4.33));
        setCronogramaInfo({
          horasSemanais: cronoData.horas_semanais,
          diasSemana: cronoData.dias_semana,
          nome: cronoData.nome || "Meu Cronograma",
        });
      } else {
        setCronogramaInfo(null);
        setDailyGoalHours(3);
        setMetaMensal(60);
      }


      const allRespostas = await fetchAllRespostas(user.id, cf);
      setTotalRespondidas(allRespostas.length);
      setTotalCorretas(allRespostas.filter(r => r.correta).length);

      const now = Date.now();
      const D = 86400000;
      const weekAgo = now - 7 * D;
      const twoWeekAgo = now - 14 * D;
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

      const semana = allRespostas.filter(r => new Date(r.created_at).getTime() >= weekAgo);
      const semanaAnt = allRespostas.filter(r => {
        const t = new Date(r.created_at).getTime();
        return t >= twoWeekAgo && t < weekAgo;
      });
      setRespondidaSemana(semana.length);
      setRespondidaSemanaAnterior(semanaAnt.length);
      const accW = semana.length > 0 ? (semana.filter(r => r.correta).length / semana.length) * 100 : 0;
      const accP = semanaAnt.length > 0 ? (semanaAnt.filter(r => r.correta).length / semanaAnt.length) * 100 : 0;
      setAcertosSemana(Math.round(accW));
      setAcertosSemanaAnterior(Math.round(accP));

      // Sparkline 14 dias
      const days: { d: string; v: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * D);
        const key = localDateKey(d);
        const v = allRespostas.filter(r => localDateKey(r.created_at) === key).length;
        days.push({ d: key, v });
      }
      setSparkRespostas(days);

      // Simulados
      let simCountQuery = supabase.from("simulados")
        .select("*", { count: "exact", head: true }).eq("user_id", user.id);
      if (cf) simCountQuery = simCountQuery.or(cf);
      const { count: simCount } = await simCountQuery;
      setTotalSimulados(simCount || 0);

      let simsQuery = supabase.from("simulados")
        .select("id, disciplina, acertos, total, created_at, finalizado")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
      if (cf) simsQuery = simsQuery.or(cf);
      const { data: allSims } = await simsQuery;

      const sims = allSims || [];
      const simMes = sims.filter(s => new Date(s.created_at) >= monthStart).length;
      const simMesAnt = sims.filter(s => {
        const d = new Date(s.created_at);
        return d >= prevMonthStart && d < monthStart;
      }).length;
      setSimuladosMes(simMes);
      setSimuladosMesAnterior(simMesAnt);

      const simDays: { d: string; v: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * D);
        const key = localDateKey(d);
        const v = sims.filter(s => localDateKey(s.created_at) === key).length;
        simDays.push({ d: key, v });
      }
      setSparkSimulados(simDays);

      // Study sessions
      let sessionsQuery = supabase.from("study_sessions")
        .select("id, duration_seconds, started_at, created_at").eq("user_id", user.id);
      if (cf) sessionsQuery = sessionsQuery.or(cf);
      const { data: sessions } = await sessionsQuery;

      const storedSessions = (sessions || []) as StudySession[];
      const localTimer = getLocalStudyTimerSnapshot();
      const currentLiveTimer = !localTimer.userId || localTimer.userId === user.id ? localTimer : null;
      setStudySessions(storedSessions);
      const sess = mergeLiveStudySession(storedSessions, currentLiveTimer);
      const totalSec = sess.reduce((s, x) => s + (x.duration_seconds || 0), 0);
      setHorasEstudoTotal(Math.round((totalSec / 3600) * 10) / 10);

      const todayKey = localDateKey(new Date());
      const todaySec = sess.filter(s => {
        const ts = getStudySessionDate(s);
        return ts && localDateKey(ts) === todayKey;
      })
        .reduce((a, b) => a + (b.duration_seconds || 0), 0);
      setMinutosEstudoHoje(Math.round(todaySec / 60));

      const mesSec = sess.filter(s => {
        const ts = getStudySessionDate(s);
        return ts && new Date(ts) >= monthStart;
      }).reduce((a, b) => a + (b.duration_seconds || 0), 0);
      setHorasMesAtual(Math.round((mesSec / 3600) * 10) / 10);

      // Distribuição por hora do dia (hoje)
      const byHour = Array.from({ length: 24 }, (_, h) => ({ h, v: 0 }));
      sess.filter(s => {
        const ts = getStudySessionDate(s);
        return ts && localDateKey(ts) === todayKey;
      }).forEach(s => {
        const h = new Date(getStudySessionDate(s)!).getHours();
        byHour[h].v += (s.duration_seconds || 0) / 60;
      });
      setStudyByHour(byHour);

      // Streak (dias consecutivos com login/sessão OU resposta)
      // Basta ter aberto a plataforma (sessão criada) — não exige duração mínima
      const activeDays = new Set<string>();
      sess.forEach(s => {
        const ts = getStudySessionDate(s);
        if (ts) activeDays.add(localDateKey(ts));
      });
      allRespostas.forEach(r => activeDays.add(localDateKey(r.created_at)));
      // Hoje sempre conta como ativo (usuário está logado vendo o dashboard)
      activeDays.add(localDateKey(new Date()));
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = localDateKey(new Date(now - i * D));
        if (activeDays.has(d)) streak++;
        else break;
      }
      setStreakDias(streak);

      // Disciplinas
      const qIds = [...new Set(allRespostas.map(r => r.questao_id))];
      const discMap: Record<string, { total: number; corretas: number }> = {};
      if (qIds.length) {
        const BATCH = 500;
        const qDisc: Record<number, string> = {};
        for (let i = 0; i < qIds.length; i += BATCH) {
          const { data } = await supabase.from("questoes").select("id, disciplina").in("id", qIds.slice(i, i + BATCH));
          (data || []).forEach(q => { qDisc[q.id] = q.disciplina; });
        }
        allRespostas.forEach(r => {
          const d = qDisc[r.questao_id]; if (!d) return;
          if (!discMap[d]) discMap[d] = { total: 0, corretas: 0 };
          discMap[d].total++;
          if (r.correta) discMap[d].corretas++;
        });
      }
      const discArr = Object.entries(discMap).map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total);
      setDisciplinas(discArr);

      // Diagnóstico geral por disciplina (banco + simulados + simulado semanal)
      const { data: diagData } = await supabase.rpc("get_desempenho_disciplinas", { p_curso_id: cursoId });
      const diagMap: Record<string, { total: number; corretas: number }> = {};
      (diagData || []).forEach((row: { disciplina: string; total: number; corretas: number }) => {
        const nome = normalizarDisciplina(row.disciplina, cursoSlug) || row.disciplina;
        if (!diagMap[nome]) diagMap[nome] = { total: 0, corretas: 0 };
        diagMap[nome].total += Number(row.total) || 0;
        diagMap[nome].corretas += Number(row.corretas) || 0;
      });
      setDiagnostico(Object.entries(diagMap).map(([name, v]) => ({ name, ...v })));

      // Atividades recentes
      const acts: AtividadeRecente[] = [];
      sims.slice(0, 4).forEach(s => acts.push({
        text: `Você concluiu o simulado ${s.disciplina}`,
        time: formatRelativeTime(s.created_at),
        icon: <CheckCircle className="w-4 h-4 text-success" />,
        sortDate: new Date(s.created_at),
      }));
      // Top discipline of day grouping
      const recent = [...allRespostas].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 100);
      const grp: Record<string, { c: number; date: string; disc: string }> = {};
      const rIds = [...new Set(recent.map(r => r.questao_id))];
      const rDisc: Record<number, string> = {};
      if (rIds.length) {
        for (let i = 0; i < rIds.length; i += 500) {
          const { data } = await supabase.from("questoes").select("id, disciplina").in("id", rIds.slice(i, i + 500));
          (data || []).forEach(q => { rDisc[q.id] = q.disciplina; });
        }
      }
      recent.forEach(r => {
        const disc = rDisc[r.questao_id] || "Geral";
        const k = `${r.created_at.slice(0, 10)}|${disc}`;
        if (!grp[k]) grp[k] = { c: 0, date: r.created_at, disc };
        grp[k].c++;
      });
      Object.values(grp).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4).forEach(g => acts.push({
          text: `Resolveu ${g.c} questões de ${g.disc}`,
          time: formatRelativeTime(g.date),
          icon: <FileText className="w-4 h-4 text-primary" />,
          sortDate: new Date(g.date),
        }));
      if (streak >= 7) acts.push({
        text: `Nova sequência alcançada: ${streak} dias!`,
        time: "Hoje",
        icon: <Flame className="w-4 h-4 text-warning" />,
        sortDate: new Date(),
      });
      acts.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
      setAtividades(acts.slice(0, 6));

      // Simulado incompleto
      const { data: progressData } = await supabase
        .from("simulado_progress").select("*").eq("user_id", user.id).single();
      if (progressData) {
        let respostas: Record<string, number> = {};
        try { respostas = typeof progressData.respostas === "string" ? JSON.parse(progressData.respostas) : (progressData.respostas as Record<string, number>) || {}; }
        catch { respostas = {}; }
        setIncompleteSimulado({ disciplina: progressData.disciplina, respondidas: Object.keys(respostas).length, total: progressData.total });
      }

      // BizuAulas: contagem de vídeos por disciplina (filtrado pelo curso ativo)
      let bizuQuery = supabase.from("bizuaulas_videos").select("disciplina_id");
      const bizuFilter = cursoOrFilter(cursoId, cursoSlug);
      if (bizuFilter) bizuQuery = bizuQuery.or(bizuFilter);
      const { data: bizuRows } = await bizuQuery;
      const bizuCount: Record<string, number> = {};
      (bizuRows || []).forEach((r: { disciplina_id: string }) => {
        bizuCount[r.disciplina_id] = (bizuCount[r.disciplina_id] || 0) + 1;
      });
      const temVideos = (bizuRows || []).length > 0;
      const bizuList: BizuAulaItem[] = !temVideos ? [] : getBizuAulaDisciplinas(cursoSlug)
        .map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: d.subtitle,
          count: bizuCount[d.id] || 0,
          restricted: d.restricted,
          destaque: d.id === ANALISE_EDITAL_DISC.id,
        }))
        // mantém a Análise do Edital sempre; demais só se tiverem vídeo
        .filter((d) => d.destaque || d.count > 0);
      setBizuAulas(bizuList);

      setLoading(false);
    })();
  }, [user, cursoId, cursoSlug]);

  useEffect(() => {
    if (!user) return;

    const refreshLiveStudyProgress = () => {
      const snapshot = getLocalStudyTimerSnapshot();
      const currentLiveTimer = !snapshot.userId || snapshot.userId === user.id ? snapshot : null;
      const mergedSessions = mergeLiveStudySession(studySessions, currentLiveTimer);
      const metrics = calculateStudyMetrics(mergedSessions);
      setHorasEstudoTotal(Math.round((metrics.totalSec / 3600) * 10) / 10);
      setMinutosEstudoHoje(Math.round(metrics.todaySec / 60));
      setHorasMesAtual(Math.round((metrics.monthSec / 3600) * 10) / 10);
      setStudyByHour(metrics.byHour);
    };

    refreshLiveStudyProgress();
    window.addEventListener("study-timer-updated", refreshLiveStudyProgress);
    const interval = window.setInterval(refreshLiveStudyProgress, 15000);

    return () => {
      window.removeEventListener("study-timer-updated", refreshLiveStudyProgress);
      window.clearInterval(interval);
    };
  }, [studySessions, user]);

  const taxaAcertos = totalRespondidas > 0 ? Math.round((totalCorretas / totalRespondidas) * 100) : 0;
  const totalErros = totalRespondidas - totalCorretas;

  const acertosDelta = acertosSemana - acertosSemanaAnterior;
  const respostasDelta = respondidaSemanaAnterior > 0
    ? Math.round(((respondidaSemana - respondidaSemanaAnterior) / respondidaSemanaAnterior) * 100)
    : (respondidaSemana > 0 ? 100 : 0);
  const simDelta = simuladosMesAnterior > 0
    ? Math.round(((simuladosMes - simuladosMesAnterior) / simuladosMesAnterior) * 100)
    : (simuladosMes > 0 ? 100 : 0);

  const metaPctMensal = Math.min(100, Math.round((horasMesAtual / metaMensal) * 100));
  const metaDiariaPct = Math.min(100, Math.round((minutosEstudoHoje / (dailyGoalHours * 60)) * 100));

  const doughnutData = totalRespondidas > 0
    ? [{ name: "Acertos", value: totalCorretas }, { name: "Erros", value: totalErros }]
    : [{ name: "Vazio", value: 1 }];

  const horasFmt = useMemo(() => {
    const h = Math.floor(horasMesAtual);
    const m = Math.round((horasMesAtual - h) * 60);
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }, [horasMesAtual]);

  const minHojeFmt = `${Math.floor(minutosEstudoHoje / 60)}h ${(minutosEstudoHoje % 60).toString().padStart(2, "0")}m`;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full min-w-0">
        {/* Header com badges */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-start justify-between gap-4"
        >
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words flex items-center gap-2">
              Bem-vindo, <span className="text-gradient-primary">{firstName}!</span>
              <span className="text-2xl">👋</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md">
              Continue firme na sua jornada. Cada minuto de hoje aproxima você da sua aprovação!
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="glass-card rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-warning/15"><Flame className="w-4 h-4 text-warning" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">Sequência</p>
                <p className="text-sm font-bold text-warning">{streakDias} {streakDias === 1 ? "dia" : "dias"}</p>
              </div>
            </div>
            <div className="glass-card rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/15"><Shield className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">Acerto</p>
                <p className="text-sm font-bold text-primary">{taxaAcertos}%</p>
              </div>
            </div>
          </div>
        </motion.div>

        {showWhatsAppBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5"
          >
            <button onClick={dismissWhatsAppBanner} aria-label="Fechar"
              className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 shrink-0">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0 pr-6">
                <p className="font-bold text-sm sm:text-base">Entre no nosso Grupo de Avisos no WhatsApp!</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Fique por dentro de todas as novidades, atualizações do edital, novas questões, simulados e conteúdos exclusivos em primeira mão. <span className="text-emerald-400 font-semibold">Não perca nada da sua preparação!</span>
                </p>
                <a
                  href={cursoSlug === "cbmto" ? "https://chat.whatsapp.com/IULXiiK2vhHBgroDKbJsZO" : "https://chat.whatsapp.com/Djve82S6zXM2TvmcmDalK9"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Entrar no Grupo
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {showNewToolsBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5"
          >
            <button onClick={dismissNewToolsBanner} aria-label="Fechar"
              className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/15 shrink-0"><Sparkles className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0 pr-6">
                <p className="font-bold text-sm sm:text-base">Novas ferramentas chegaram!</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Estamos evoluindo a plataforma para potencializar sua aprovação. Confira:
                </p>
                <div className="grid sm:grid-cols-3 gap-2 mt-3">
                  <Link to="/bizuaula" className="flex items-start gap-2 p-2.5 rounded-lg bg-card/60 border border-border/40 hover:border-primary/40 transition-colors">
                    <Youtube className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div><p className="text-xs font-semibold">BizuAula</p><p className="text-[11px] text-muted-foreground leading-snug">Aulas curtas e diretas.</p></div>
                  </Link>
                  <Link to="/cronograma" className="flex items-start gap-2 p-2.5 rounded-lg bg-card/60 border border-border/40 hover:border-primary/40 transition-colors">
                    <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div><p className="text-xs font-semibold">Cronograma</p><p className="text-[11px] text-muted-foreground leading-snug">Otimize suas horas semanais.</p></div>
                  </Link>
                  <Link to="/mapas-mentais" className="flex items-start gap-2 p-2.5 rounded-lg bg-card/60 border border-border/40 hover:border-primary/40 transition-colors">
                    <Brain className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div><p className="text-xs font-semibold">Mapas Mentais</p><p className="text-[11px] text-muted-foreground leading-snug">Revisão e fixação visual.</p></div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SimuladoSemanalDestaque />

            {incompleteSimulado && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-warning/30 bg-warning/5">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-warning/15 shrink-0"><PlayCircle className="w-5 h-5 text-warning" /></div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">Simulado Incompleto</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {incompleteSimulado.disciplina} • {incompleteSimulado.respondidas}/{incompleteSimulado.total} respondidas
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate("/simulados")}
                  className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto">
                  <PlayCircle className="w-3.5 h-3.5" />Continuar
                </button>
              </motion.div>
            )}

            {/* Linha de KPIs principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KpiCard
                title="Questões Respondidas"
                value={totalRespondidas.toLocaleString("pt-BR")}
                icon={<ClipboardCheck className="w-5 h-5" />}
                delta={respostasDelta}
                deltaLabel="vs. semana anterior"
                sparkColor={COLORS.primary}
                sparkData={sparkRespostas}
              />
              <DonutKpiCard
                title="Horas de Estudo"
                value={horasFmt}
                icon={<Clock className="w-5 h-5" />}
                pct={metaPctMensal}
                pctLabel="da meta mensal"
                subline={`Meta: ${metaMensal}h${cronogramaInfo ? "" : " (padrão)"}`}
                hint="Conta tempo de plataforma aberta + resolução de questões"
                ctaLabel={cronogramaInfo ? null : "Criar cronograma para meta personalizada"}
                ctaHref="/cronograma"
                color={COLORS.primary}
              />
              <KpiCard
                title="Simulados Realizados"
                value={String(totalSimulados)}
                icon={<BookOpen className="w-5 h-5" />}
                delta={simDelta}
                deltaLabel="vs. mês anterior"
                sparkColor={COLORS.success}
                sparkData={sparkSimulados}
              />
              {/* Taxa de acerto donut acertos/erros */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                className="glass-card rounded-xl p-4 sm:p-5 relative overflow-hidden min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary"><TrendingUp className="w-4 h-4" /></div>
                    <p className="text-sm font-semibold">Taxa de Acerto</p>
                  </div>
                </div>
                <div className="relative h-32 sm:h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={doughnutData} cx="50%" cy="50%" innerRadius="65%" outerRadius="92%"
                        dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                        <Cell fill={totalRespondidas > 0 ? COLORS.success : COLORS.muted} />
                        <Cell fill={COLORS.destructive} />
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, n: string) => [`${v}`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl sm:text-3xl font-bold">{taxaAcertos}%</span>
                    <span className="text-[10px] text-muted-foreground">de acerto</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] mt-2">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />Acertos: {totalCorretas}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" />Erros: {totalErros}</span>
                </div>
                {totalRespondidas > 0 && (
                  <div className={`mt-1 text-[10px] flex items-center gap-1 ${acertosDelta >= 0 ? "text-success" : "text-destructive"}`}>
                    {acertosDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {acertosDelta >= 0 ? "+" : ""}{acertosDelta}pp vs. semana anterior
                  </div>
                )}
              </motion.div>
            </div>

            {/* Linha principal: Progresso, Metas, Atividades */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Progresso por disciplina */}
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
                className="glass-card rounded-xl p-4 sm:p-5 lg:col-span-1 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="font-semibold text-sm sm:text-base">Progresso por Disciplina</h2>
                </div>
                {disciplinas.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {disciplinas.map(d => {
                      const pct = d.total > 0 ? Math.round((d.corretas / d.total) * 100) : 0;
                      const colorClass = pct >= 70 ? "from-success to-success/70"
                        : pct >= 50 ? "from-warning to-warning/70"
                        : "from-destructive to-destructive/70";
                      const textColor = pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";
                      return (
                        <div key={d.name} className="space-y-1.5" title={`${d.corretas}/${d.total} acertos`}>
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="font-medium truncate mr-2">{d.name}</span>
                            <span className={`font-bold shrink-0 ${textColor}`}>{pct}%</span>
                          </div>
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/60">
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full bg-gradient-to-r ${colorClass}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => navigate("/edital")}
                      className="w-full mt-2 text-xs text-primary font-medium flex items-center justify-center gap-1 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                      Ver detalhes por disciplina <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>

              {/* Metas de estudo */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="glass-card rounded-xl p-4 sm:p-5 min-w-0">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Target className="w-5 h-5 text-warning shrink-0" />
                    <h2 className="font-semibold text-sm sm:text-base truncate">Metas de Estudo</h2>
                  </div>
                  <Link to="/cronograma"
                    className="text-[11px] bg-secondary/50 hover:bg-secondary border border-border/40 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0">
                    {cronogramaInfo ? "Editar cronograma" : "Criar cronograma"}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ v: metaDiariaPct, fill: COLORS.warning }]} startAngle={90} endAngle={-270}>
                        <RadialBar background={{ fill: COLORS.muted }} dataKey="v" cornerRadius={6} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-warning">{metaDiariaPct}%</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Meta diária</p>
                    <p className="text-lg font-bold text-warning leading-tight">
                      {dailyGoalHours.toFixed(1).replace(/\.0$/, "")}h de estudo
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">{minHojeFmt} de plataforma aberta hoje</p>
                    {cronogramaInfo ? (
                      <p className="text-[10px] text-primary/80 mt-1 truncate">
                        {cronogramaInfo.horasSemanais}h/sem • {cronogramaInfo.diasSemana.length} dias
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/70 mt-1 italic">Sem cronograma ativo</p>
                    )}
                  </div>
                </div>


                {/* Mini chart por hora */}
                <div className="mt-4 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={studyByHour}>
                      <defs>
                        <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLORS.warning} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={COLORS.warning} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`${Math.round(v)} min`, "Estudo"]}
                        labelFormatter={(h: number) => `${h}h`}
                      />
                      <Area type="monotone" dataKey="v" stroke={COLORS.warning} fill="url(#hourFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground px-1">
                  <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                </div>

                <Link to="/cronograma"
                  className="mt-4 flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground leading-tight">Próxima meta</p>
                      <p className="text-xs font-semibold truncate">Estudar {dailyGoalHours.toFixed(1).replace(/\.0$/, "")}h amanhã</p>

                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-primary shrink-0" />
                </Link>
              </motion.div>

              {/* Calendário Inteligente CHOA */}
              <CalendarioInteligente />
            </div>

            {/* Diagnóstico de estudo — onde focar (contexto geral) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
              className="glass-card rounded-xl p-4 sm:p-5 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Brain className="w-5 h-5 text-primary shrink-0" />
                <h2 className="font-semibold text-sm sm:text-base">Diagnóstico de Estudo — Onde Focar</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Visão geral do seu percentual de erro por disciplina, somando o banco de questões e os simulados resolvidos. Use para priorizar o que revisar.
              </p>
              <AnaliseDificuldade
                items={diagnostico}
                minAmostra={5}
                unidade="disciplina"
                emptyHint="Resolva pelo menos 5 questões por disciplina para gerar seu diagnóstico."
              />
            </motion.div>



            {/* BizuAulas — atalho rápido (Análise do Edital em destaque) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="glass-card rounded-xl p-4 sm:p-5 min-w-0">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Youtube className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="font-semibold text-sm sm:text-base truncate">BizuAulas</h2>
                </div>
                <Link to="/bizuaula"
                  className="text-[11px] bg-secondary/50 hover:bg-secondary border border-border/40 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0">
                  Ver todas <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {bizuAulas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  BizuAulas em breve para o {cursoAtivo?.nome ?? "curso"}.
                </p>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {bizuAulas.map((b) => (
                  <Link
                    key={b.id}
                    to={`/bizuaula?disciplina=${b.id}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors min-w-0 ${
                      b.destaque
                        ? "bg-gold/10 border-gold/40 hover:border-gold/70"
                        : "bg-secondary/30 border-border/40 hover:border-primary/40"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${b.destaque ? "bg-gold/20 text-gold" : "bg-primary/10 text-primary"}`}>
                      {b.destaque ? <Sparkles className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${b.destaque ? "text-gold" : ""}`}>{b.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {b.restricted
                          ? "Documento sigiloso"
                          : b.count > 0
                            ? `${b.count} vídeo${b.count > 1 ? "s" : ""}`
                            : b.destaque ? "Comece por aqui" : "Em breve"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>

            
          </>
        )}
      </div>
    </AppLayout>
  );
};

/* ---------- Sub-componentes ---------- */

function KpiCard({ title, value, icon, delta, deltaLabel, sparkColor, sparkData }: {
  title: string; value: string; icon: React.ReactNode;
  delta: number; deltaLabel: string; sparkColor: string;
  sparkData: { d: string; v: number }[];
}) {
  const positive = delta >= 0;
  const gradId = `spark-${title.replace(/\s+/g, "")}`;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card rounded-xl p-4 sm:p-5 relative overflow-hidden group hover:border-primary/30 transition-all min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
      </div>
      <h3 className="text-2xl sm:text-3xl font-bold">{value}</h3>
      <div className="flex items-center gap-1.5 text-[11px] mt-1.5">
        <span className={`flex items-center gap-0.5 font-semibold ${positive ? "text-success" : "text-destructive"}`}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {positive ? "+" : ""}{delta}%
        </span>
        <span className="text-muted-foreground truncate">{deltaLabel}</span>
      </div>
      <div className="h-12 mt-2 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.5} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [v, "Total"]} labelFormatter={(l: string) => new Date(l).toLocaleDateString("pt-BR")}
            />
            <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} fill={`url(#${gradId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function DonutKpiCard({ title, value, icon, pct, pctLabel, subline, color, hint, ctaLabel, ctaHref }: {
  title: string; value: string; icon: React.ReactNode;
  pct: number; pctLabel: string; subline: string; color: string;
  hint?: string; ctaLabel?: string | null; ctaHref?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card rounded-xl p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
      </div>
      <h3 className="text-2xl sm:text-3xl font-bold">{value}</h3>
      <div className="flex items-center gap-3 mt-2">
        <div className="relative w-16 h-16 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ v: pct, fill: color }]} startAngle={90} endAngle={-270}>
              <RadialBar background={{ fill: COLORS.muted }} dataKey="v" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{pct}%</div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{pctLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subline}</p>
        </div>
      </div>
      {hint && (
        <p className="text-[10px] text-muted-foreground/80 mt-2 leading-snug">{hint}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link to={ctaHref} className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">
          <Sparkles className="w-3 h-3" />{ctaLabel}
        </Link>
      )}
    </motion.div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Há ${diffMin}min`;
  if (diffHours < 24) return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `Ontem, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return date.toLocaleDateString("pt-BR");
}

export default Dashboard;
