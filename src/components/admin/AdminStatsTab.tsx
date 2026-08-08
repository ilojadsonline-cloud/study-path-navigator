import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurso, cursoOrFilter, type Curso } from "@/contexts/CursoContext";
import { Users, HelpCircle, CheckCircle, BarChart3, Clock, Loader2 } from "lucide-react";

interface Stats {
  alunosComAcesso: number;
  totalQuestoes: number;
  totalRespostas: number;
  totalSimulados: number;
  totalStudyHours: number;
  acertoGeral: number;
}

async function loadStatsForCurso(cursoId: string, cursoSlug: string): Promise<Stats> {
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

  const acessosQ = supabase
    .from("acessos_curso")
    .select("*", { count: "exact", head: true })
    .eq("curso_id", cursoId)
    .eq("ativo", true);

  const [acessosRes, questoesRes, respostasRes, simuladosRes, studyRes, correctRes] = await Promise.all([
    acessosQ,
    questoesQ,
    respostasQ,
    simuladosQ,
    studyQ,
    corretasQ,
  ]);

  const totalRespostas = respostasRes.count || 0;
  const totalCorretas = correctRes.count || 0;
  const totalSeconds = (studyRes.data || []).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);

  return {
    alunosComAcesso: acessosRes.count || 0,
    totalQuestoes: questoesRes.count || 0,
    totalRespostas,
    totalSimulados: simuladosRes.count || 0,
    totalStudyHours: Math.round(totalSeconds / 3600),
    acertoGeral: totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0,
  };
}

function StatsGrid({ stats }: { stats: Stats }) {
  const items = [
    { label: "Alunos com acesso", value: stats.alunosComAcesso, icon: Users },
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
          <CardContent><p className="text-2xl sm:text-3xl font-bold text-foreground">{s.value}</p></CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AdminStatsTab() {
  const { cursoId, cursoSlug, cursoAtivo, todosCursos } = useCurso();
  const [modo, setModo] = useState<"ativo" | "comparativo">("ativo");
  const [stats, setStats] = useState<Stats | null>(null);
  const [porCurso, setPorCurso] = useState<{ curso: Curso; stats: Stats }[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    setTotalUsers(count || 0);

    if (modo === "ativo") {
      if (cursoId) setStats(await loadStatsForCurso(cursoId, cursoSlug));
      else setStats(null);
    } else {
      const results = await Promise.all(
        todosCursos.map(async (c) => ({ curso: c, stats: await loadStatsForCurso(c.id, c.slug) })),
      );
      setPorCurso(results);
    }
    setLoading(false);
  }, [cursoId, cursoSlug, modo, todosCursos]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={modo === "ativo" ? "default" : "outline"} onClick={() => setModo("ativo")}>
          Curso ativo
        </Button>
        <Button size="sm" variant={modo === "comparativo" ? "default" : "outline"} onClick={() => setModo("comparativo")}>
          Comparar perfis
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          Usuários cadastrados (todos os cursos): <span className="font-semibold text-foreground">{totalUsers}</span>
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : modo === "ativo" ? (
        <>
          <p className="text-xs text-muted-foreground">
            Dados do curso ativo: <span className="font-semibold text-foreground">{cursoAtivo?.nome ?? "—"}</span>
          </p>
          {stats ? <StatsGrid stats={stats} /> : <p className="text-sm text-muted-foreground">Nenhum curso ativo.</p>}
        </>
      ) : (
        <div className="space-y-6">
          {porCurso.map(({ curso, stats: s }) => (
            <div key={curso.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: curso.cor }} />
                <h3 className="text-sm font-semibold text-foreground">{curso.nome}</h3>
                <span className="text-[10px] text-muted-foreground uppercase">{curso.sigla}</span>
              </div>
              <StatsGrid stats={s} />
            </div>
          ))}
          {porCurso.length === 0 && <p className="text-sm text-muted-foreground">Nenhum curso ativo cadastrado.</p>}
        </div>
      )}
    </div>
  );
}
