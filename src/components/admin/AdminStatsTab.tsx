import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";
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
  const { cursoId, cursoSlug, cursoAtivo } = useCurso();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const filter = cursoOrFilter(cursoId, cursoSlug);

    const questoesQ = supabase
      .from("questoes")
      .select("*", { count: "exact", head: true })
      .in("audit_status", ["approved", "auto_corrected", "admin_resolved", "pending"]);
    if (filter) questoesQ.or(filter);

    // respostas_usuario não tem curso_id — usa join com questoes
    const respostasQ = supabase
      .from("respostas_usuario")
      .select("id, questoes!inner(curso_id)", { count: "exact", head: true });
    if (filter) respostasQ.or(filter, { foreignTable: "questoes" });

    const corretasQ = supabase
      .from("respostas_usuario")
      .select("id, questoes!inner(curso_id)", { count: "exact", head: true })
      .eq("correta", true);
    if (filter) corretasQ.or(filter, { foreignTable: "questoes" });

    const simuladosQ = supabase.from("simulados").select("*", { count: "exact", head: true });
    if (filter) simuladosQ.or(filter);

    const studyQ = supabase.from("study_sessions").select("duration_seconds");
    if (filter) studyQ.or(filter);

    const [profilesRes, questoesRes, respostasRes, simuladosRes, studyRes, correctRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      questoesQ,
      respostasQ,
      simuladosQ,
      studyQ,
      corretasQ,
    ]);
    const totalRespostas = respostasRes.count || 0;
    const totalCorretas = correctRes.count || 0;
    const totalSeconds = (studyRes.data || []).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
    setStats({
      totalUsers: profilesRes.count || 0,
      totalQuestoes: questoesRes.count || 0,
      totalRespostas,
      totalSimulados: simuladosRes.count || 0,
      totalStudyHours: Math.round(totalSeconds / 3600),
      acertoGeral: totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0,
    });
    setLoading(false);
  }, [cursoId, cursoSlug]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const items = [
    { label: "Usuários (todos os cursos)", value: stats.totalUsers, icon: Users },
    { label: "Questões", value: stats.totalQuestoes, icon: HelpCircle },
    { label: "Respostas", value: stats.totalRespostas, icon: CheckCircle },
    { label: "Simulados", value: stats.totalSimulados, icon: BarChart3 },
    { label: "Horas de Estudo", value: `${stats.totalStudyHours}h`, icon: Clock },
    { label: "Taxa de Acerto", value: `${stats.acertoGeral}%`, icon: CheckCircle },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Dados filtrados pelo curso ativo: <span className="font-semibold text-foreground">{cursoAtivo?.nome ?? "—"}</span>
      </p>
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
    </div>
  );
}
