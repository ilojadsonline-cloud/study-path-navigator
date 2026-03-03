import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle, Target, BookOpen, Clock, TrendingUp,
  Trophy, Calendar, Zap
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Dashboard = () => {
  const { profile } = useAuth();
  const firstName = profile?.nome?.split(" ")[0] || "Aspirante";
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
          <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success">Assinatura Ativa</span>
            <span className="text-xs text-muted-foreground">• Expira em 67 dias</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Questões Respondidas" value="342" icon={<CheckCircle className="w-5 h-5" />} subtitle="+28 esta semana" />
          <StatCard title="Taxa de Acertos" value="78%" icon={<Target className="w-5 h-5" />} subtitle="Acima da média" glowing />
          <StatCard title="Simulados Realizados" value="12" icon={<BookOpen className="w-5 h-5" />} subtitle="3 esta semana" />
          <StatCard title="Horas de Estudo" value="86h" icon={<Clock className="w-5 h-5" />} subtitle="Meta: 120h" />
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
            {[
              { name: "Lei nº 2.578/2012", progress: 72, color: "bg-primary" },
              { name: "LC nº 128/2021", progress: 45, color: "bg-accent" },
              { name: "Lei nº 2.575/2012", progress: 60, color: "bg-success" },
              { name: "CPPM", progress: 30, color: "bg-warning" },
              { name: "RDMETO", progress: 55, color: "bg-gold" },
            ].map((d) => (
              <div key={d.name} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium text-foreground">{d.progress}%</span>
                </div>
                <Progress value={d.progress} className="h-2" />
              </div>
            ))}
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
            {[
              { text: "Simulado CPPM – 38/50 acertos", time: "Há 2 horas", icon: <Zap className="w-4 h-4 text-primary" /> },
              { text: "Questões Lei 2.578 – 15 resolvidas", time: "Há 5 horas", icon: <CheckCircle className="w-4 h-4 text-success" /> },
              { text: "Edital Verticalizado – RDMETO", time: "Ontem", icon: <BookOpen className="w-4 h-4 text-accent" /> },
              { text: "Simulado LC 128 – 42/50 acertos", time: "2 dias atrás", icon: <Trophy className="w-4 h-4 text-gold" /> },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="p-2 rounded-lg bg-primary/10">{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.text}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {a.time}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
