import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, HelpCircle, CheckCircle, BarChart3, Clock, Loader2 } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalQuestoes: number;
  totalRespostas: number;
  totalSimulados: number;
  totalStudyHours: number;
  acertoGeral: number;
}

export function AdminStatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    const [profilesRes, questoesRes, respostasRes, simuladosRes, studyRes, correctRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("questoes").select("*", { count: "exact", head: true }),
      supabase.from("respostas_usuario").select("*", { count: "exact", head: true }),
      supabase.from("simulados").select("*", { count: "exact", head: true }),
      supabase.from("study_sessions").select("duration_seconds"),
      supabase.from("respostas_usuario").select("*", { count: "exact", head: true }).eq("correta", true),
    ]);
    const totalRespostas = respostasRes.count || 0;
    const totalCorretas = correctRes.count || 0;
    const totalSeconds = (studyRes.data || []).reduce((sum, s) => sum + s.duration_seconds, 0);
    setStats({
      totalUsers: profilesRes.count || 0,
      totalQuestoes: questoesRes.count || 0,
      totalRespostas,
      totalSimulados: simuladosRes.count || 0,
      totalStudyHours: Math.round(totalSeconds / 3600),
      acertoGeral: totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0,
    });
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const items = [
    { label: "Usuários", value: stats.totalUsers, icon: Users },
    { label: "Questões", value: stats.totalQuestoes, icon: HelpCircle },
    { label: "Respostas", value: stats.totalRespostas, icon: CheckCircle },
    { label: "Simulados", value: stats.totalSimulados, icon: BarChart3 },
    { label: "Horas de Estudo", value: `${stats.totalStudyHours}h`, icon: Clock },
    { label: "Taxa de Acerto", value: `${stats.acertoGeral}%`, icon: CheckCircle },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((s, i) => (
        <Card key={i} className="glass-card border-none">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <s.icon className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{s.value}</p></CardContent>
        </Card>
      ))}
    </div>
  );
}
