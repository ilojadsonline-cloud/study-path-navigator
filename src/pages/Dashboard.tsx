import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle, Target, BookOpen, Clock, TrendingUp,
  Trophy, Calendar, Zap, Loader2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

type DisciplinaProgress = {
  name: string;
  total: number;
  corretas: number;
};

type AtividadeRecente = {
  text: string;
  time: string;
  icon: React.ReactNode;
};

// Helper to fetch all rows from a specific table bypassing 1000-row limit
async function fetchAllRespostas(userId: string) {
  const PAGE = 1000;
  let allData: { id: number; correta: boolean; created_at: string; questao_id: number }[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from("respostas_usuario")
      .select("id, correta, created_at, questao_id")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allData;
}

const Dashboard = () => {
  const { user, profile } = useAuth();
  const firstName = profile?.nome?.split(" ")[0] || "Aspirante";

  const [loading, setLoading] = useState(true);
  const [totalRespondidas, setTotalRespondidas] = useState(0);
  const [totalCorretas, setTotalCorretas] = useState(0);
  const [totalSimulados, setTotalSimulados] = useState(0);
  const [horasEstudo, setHorasEstudo] = useState(0);
  const [disciplinas, setDisciplinas] = useState<DisciplinaProgress[]>([]);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [respondidaSemana, setRespondidaSemana] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);

      // Fetch ALL user answers (bypassing 1000-row limit)
      const allRespostas = await fetchAllRespostas(user.id);

      setTotalRespondidas(allRespostas.length);
      const corretas = allRespostas.filter(r => r.correta).length;
      setTotalCorretas(corretas);

      // Respondidas esta semana
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const semana = allRespostas.filter(r => new Date(r.created_at) >= oneWeekAgo).length;
      setRespondidaSemana(semana);

      // Fetch simulados (count)
      const { count: simCount } = await supabase.from("simulados")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setTotalSimulados(simCount || 0);

      // Fetch recent simulados for activities
      const { data: recentSims } = await supabase.from("simulados")
        .select("id, disciplina, acertos, total, created_at, finalizado")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch study hours
      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("duration_seconds")
        .eq("user_id", user.id);

      const totalSeconds = (sessions || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      setHorasEstudo(Math.round((totalSeconds / 3600) * 10) / 10);

      // Build discipline progress from answered questions
      const questaoIds = [...new Set(allRespostas.map(r => r.questao_id))];
      let discMap: Record<string, { total: number; corretas: number }> = {};

      if (questaoIds.length > 0) {
        // Fetch in batches of 500 to avoid URL length issues
        const BATCH = 500;
        const allQuestoes: { id: number; disciplina: string }[] = [];
        for (let i = 0; i < questaoIds.length; i += BATCH) {
          const batch = questaoIds.slice(i, i + BATCH);
          const { data } = await supabase.from("questoes").select("id, disciplina").in("id", batch);
          if (data) allQuestoes.push(...data);
        }

        const questaoDiscMap: Record<number, string> = {};
        allQuestoes.forEach(q => { questaoDiscMap[q.id] = q.disciplina; });

        allRespostas.forEach(r => {
          const disc = questaoDiscMap[r.questao_id];
          if (!disc) return;
          if (!discMap[disc]) discMap[disc] = { total: 0, corretas: 0 };
          discMap[disc].total++;
          if (r.correta) discMap[disc].corretas++;
        });
      }

      const discArray = Object.entries(discMap).map(([name, v]) => ({
        name,
        total: v.total,
        corretas: v.corretas,
      }));
      discArray.sort((a, b) => b.total - a.total);
      setDisciplinas(discArray);

      // Build recent activities
      const recentActivities: AtividadeRecente[] = [];
      const sortedSims = (recentSims || []);
      sortedSims.slice(0, 3).forEach(s => {
        recentActivities.push({
          text: `Simulado ${s.disciplina} – ${s.acertos}/${s.total} acertos`,
          time: formatRelativeTime(s.created_at),
          icon: <Trophy className="w-4 h-4 text-gold" />,
        });
      });

      if (allRespostas.length > 0 && recentActivities.length < 4) {
        const today = new Date().toDateString();
        const answersToday = allRespostas.filter(r => new Date(r.created_at).toDateString() === today).length;
        if (answersToday > 0) {
          recentActivities.push({
            text: `${answersToday} questões respondidas hoje`,
            time: "Hoje",
            icon: <CheckCircle className="w-4 h-4 text-success" />,
          });
        }
      }

      setAtividades(recentActivities);
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  const taxaAcertos = totalRespondidas > 0 ? Math.round((totalCorretas / totalRespondidas) * 100) : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Bem-vindo, <span className="text-gradient-primary">{firstName}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Continue sua preparação para o CHOA 2026</p>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Questões Respondidas"
                value={String(totalRespondidas)}
                icon={<CheckCircle className="w-5 h-5" />}
                subtitle={respondidaSemana > 0 ? `+${respondidaSemana} esta semana` : "Nenhuma esta semana"}
              />
              <StatCard
                title="Taxa de Acertos"
                value={totalRespondidas > 0 ? `${taxaAcertos}%` : "—"}
                icon={<Target className="w-5 h-5" />}
                subtitle={totalRespondidas > 0 ? `${totalCorretas} corretas` : "Responda questões para ver"}
                glowing={taxaAcertos >= 70}
              />
              <StatCard
                title="Simulados Realizados"
                value={String(totalSimulados)}
                icon={<BookOpen className="w-5 h-5" />}
                subtitle={totalSimulados > 0 ? "Continue praticando" : "Nenhum ainda"}
              />
              <StatCard
                title="Horas de Estudo"
                value={horasEstudo > 0 ? `${horasEstudo}h` : "0h"}
                icon={<Clock className="w-5 h-5" />}
                subtitle={horasEstudo > 0 ? "Tempo no site" : "Comece a estudar"}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Progresso por Disciplina</h2>
                </div>
                {disciplinas.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma questão respondida ainda.</p>
                    <p className="text-xs text-muted-foreground mt-1">Responda questões para ver seu progresso aqui.</p>
                  </div>
                ) : (
                  disciplinas.slice(0, 6).map((d) => {
                    const pct = d.total > 0 ? Math.round((d.corretas / d.total) * 100) : 0;
                    return (
                      <div key={d.name} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate mr-2">{d.name}</span>
                          <span className="font-medium text-foreground shrink-0">{pct}% ({d.corretas}/{d.total})</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-gold" />
                  <h2 className="font-semibold">Últimas Atividades</h2>
                </div>
                {atividades.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
                    <p className="text-xs text-muted-foreground mt-1">Comece respondendo questões ou fazendo simulados.</p>
                  </div>
                ) : (
                  atividades.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                      <div className="p-2 rounded-lg bg-primary/10">{a.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.text}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {a.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Agora mesmo";
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return date.toLocaleDateString("pt-BR");
}

export default Dashboard;
