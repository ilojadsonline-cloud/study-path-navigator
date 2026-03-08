import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCPF, cleanCPF, validateCPF } from "@/lib/cpf";
import {
  Users, HelpCircle, BarChart3, Trash2, Eye, Search, ChevronLeft, ChevronRight,
  Loader2, Shield, CheckCircle, Wrench, AlertCircle, ShieldCheck, Zap, UserPlus, UserMinus
} from "lucide-react";

// ── Types ──
interface UserProfile { user_id: string; nome: string; cpf: string; email: string | null; created_at: string; }
interface Questao { id: number; disciplina: string; assunto: string; dificuldade: string; enunciado: string; alt_a: string; alt_b: string; alt_c: string; alt_d: string; alt_e: string; gabarito: number; comentario: string; }
interface Stats { totalUsers: number; totalQuestoes: number; totalRespostas: number; totalSimulados: number; totalStudyHours: number; acertoGeral: number; }
interface BatchResult { disciplina?: string; batch: number; status: "pending" | "loading" | "success" | "error"; geradas?: number; validated?: number; ok?: number; fixed?: number; deleted?: number; error?: string; }

const DISCIPLINES = [
  "Lei nº 2.578/2012", "LC nº 128/2021", "Lei nº 2.575/2012",
  "CPPM", "RDMETO", "Direito Penal Militar", "Lei Orgânica PM",
];

const AdminPanel = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Questões
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [questoesLoading, setQuestoesLoading] = useState(false);
  const [questoesPage, setQuestoesPage] = useState(0);
  const [questoesTotal, setQuestoesTotal] = useState(0);
  const [questoesDisciplina, setQuestoesDisciplina] = useState("todas");
  const [questoesSearch, setQuestoesSearch] = useState("");
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [viewQuestion, setViewQuestion] = useState<Questao | null>(null);

  // Gerar Questões
  const [genRunning, setGenRunning] = useState(false);
  const [genDisciplina, setGenDisciplina] = useState("todas");
  const [genBatchSize, setGenBatchSize] = useState(10);
  const [genResults, setGenResults] = useState<BatchResult[]>([]);
  const [genTotal, setGenTotal] = useState(0);

  // Validar Questões
  const [valRunning, setValRunning] = useState(false);
  const [valOffset, setValOffset] = useState(0);
  const [valResults, setValResults] = useState<BatchResult[]>([]);
  const [valTotals, setValTotals] = useState({ validated: 0, ok: 0, fixed: 0, deleted: 0 });

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (isAdmin) { loadStats(); loadDisciplinas(); }
  }, [isAdmin]);

  const loadStats = async () => {
    setStatsLoading(true);
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
      totalUsers: profilesRes.count || 0, totalQuestoes: questoesRes.count || 0,
      totalRespostas, totalSimulados: simuladosRes.count || 0,
      totalStudyHours: Math.round(totalSeconds / 3600),
      acertoGeral: totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0,
    });
    setStatsLoading(false);
  };

  const loadDisciplinas = async () => {
    const { data } = await supabase.from("questoes").select("disciplina");
    if (data) setDisciplinas([...new Set(data.map(d => d.disciplina))].sort());
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    let query = supabase.from("profiles").select("user_id, nome, cpf, email, created_at").order("created_at", { ascending: false });
    if (userSearch) query = query.or(`nome.ilike.%${userSearch}%,cpf.ilike.%${userSearch}%,email.ilike.%${userSearch}%`);
    const { data } = await query.limit(100);
    setUsers(data || []);
    setUsersLoading(false);
  };

  const loadQuestoes = async (page = 0) => {
    setQuestoesLoading(true);
    const from = page * PAGE_SIZE;
    let countQuery = supabase.from("questoes").select("*", { count: "exact", head: true });
    let query = supabase.from("questoes").select("*").order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (questoesDisciplina !== "todas") { countQuery = countQuery.eq("disciplina", questoesDisciplina); query = query.eq("disciplina", questoesDisciplina); }
    if (questoesSearch) { countQuery = countQuery.ilike("enunciado", `%${questoesSearch}%`); query = query.ilike("enunciado", `%${questoesSearch}%`); }
    const [{ count }, { data }] = await Promise.all([countQuery, query]);
    setQuestoesTotal(count || 0);
    setQuestoes((data as Questao[]) || []);
    setQuestoesPage(page);
    setQuestoesLoading(false);
  };

  const deleteQuestion = async (id: number) => {
    await supabase.from("respostas_usuario").delete().eq("questao_id", id);
    const { error } = await supabase.from("questoes").delete().eq("id", id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Questão excluída" }); loadQuestoes(questoesPage); loadStats(); }
  };

  // ── Gerar Questões ──
  const startGeneration = async () => {
    setGenRunning(true);
    setGenTotal(0);
    const indices = genDisciplina === "todas"
      ? DISCIPLINES.map((_, i) => i)
      : [DISCIPLINES.indexOf(genDisciplina)];

    const batches: BatchResult[] = indices.map((i, idx) => ({
      batch: idx + 1, disciplina: DISCIPLINES[i], status: "pending" as const,
    }));
    setGenResults([...batches]);

    let total = 0;
    for (let i = 0; i < batches.length; i++) {
      batches[i].status = "loading";
      setGenResults([...batches]);
      try {
        const { data, error } = await supabase.functions.invoke("generate-questions-batch", {
          body: { disciplina_index: DISCIPLINES.indexOf(batches[i].disciplina!), batch_size: genBatchSize },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        batches[i].status = "success";
        batches[i].geradas = data?.inserted || 0;
        total += data?.inserted || 0;
        setGenTotal(total);
      } catch (err: any) {
        batches[i].status = "error";
        batches[i].error = err.message;
        if (err.message?.includes("402") || err.message?.includes("credits")) {
          toast({ title: "Sem créditos", description: err.message, variant: "destructive" });
          break;
        }
      }
      setGenResults([...batches]);
      if (i < batches.length - 1) await new Promise(r => setTimeout(r, 3000));
    }
    setGenRunning(false);
    toast({ title: "Geração concluída!", description: `${total} questões geradas.` });
    loadStats();
  };

  // ── Validar Questões ──
  const startValidation = async () => {
    setValRunning(true);
    setValTotals({ validated: 0, ok: 0, fixed: 0, deleted: 0 });

    const { count } = await supabase.from("questoes").select("*", { count: "exact", head: true });
    const total = count || 0;
    const batchSize = 5;
    const remaining = total - valOffset;
    const numBatches = Math.ceil(remaining / batchSize);

    const batches: BatchResult[] = Array.from({ length: numBatches }, (_, i) => ({ batch: i + 1, status: "pending" as const }));
    setValResults([...batches]);

    let runningTotals = { validated: 0, ok: 0, fixed: 0, deleted: 0 };
    for (let i = 0; i < numBatches; i++) {
      batches[i].status = "loading";
      setValResults([...batches]);
      try {
        const offset = valOffset + i * batchSize;
        const { data, error } = await supabase.functions.invoke("validate-questions", {
          body: { offset, limit: batchSize },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        batches[i].status = "success";
        batches[i].validated = data?.validated || 0;
        batches[i].ok = data?.ok || 0;
        batches[i].fixed = data?.fixed || 0;
        batches[i].deleted = data?.deleted || 0;
        runningTotals.validated += data?.validated || 0;
        runningTotals.ok += data?.ok || 0;
        runningTotals.fixed += data?.fixed || 0;
        runningTotals.deleted += data?.deleted || 0;
        setValTotals({ ...runningTotals });
      } catch (err: any) {
        batches[i].status = "error";
        batches[i].error = err.message;
        if (err.message?.includes("429") || err.message?.includes("402") || err.message?.includes("Rate limit")) {
          toast({ title: "Pausado", description: err.message, variant: "destructive" });
          break;
        }
      }
      setValResults([...batches]);
      await new Promise(r => setTimeout(r, 3000));
    }
    setValRunning(false);
    toast({ title: "Validação concluída!", description: `${runningTotals.validated} revisadas, ${runningTotals.fixed} corrigidas, ${runningTotals.deleted} excluídas.` });
    loadStats();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const gabaritoLabel = (g: number) => ["A", "B", "C", "D", "E"][g] || "?";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-gradient-primary">Painel Administrativo</h1>
        </div>

        <Tabs defaultValue="stats" onValueChange={(v) => {
          if (v === "users") loadUsers();
          if (v === "questoes") loadQuestoes(0);
        }}>
          <TabsList className="flex flex-wrap gap-1 h-auto max-w-2xl">
            <TabsTrigger value="stats" className="flex items-center gap-2 text-xs"><BarChart3 className="w-3.5 h-3.5" />Estatísticas</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 text-xs"><Users className="w-3.5 h-3.5" />Usuários</TabsTrigger>
            <TabsTrigger value="questoes" className="flex items-center gap-2 text-xs"><HelpCircle className="w-3.5 h-3.5" />Questões</TabsTrigger>
            <TabsTrigger value="gerar" className="flex items-center gap-2 text-xs"><Zap className="w-3.5 h-3.5" />Gerar</TabsTrigger>
            <TabsTrigger value="validar" className="flex items-center gap-2 text-xs"><ShieldCheck className="w-3.5 h-3.5" />Validar</TabsTrigger>
          </TabsList>

          {/* STATS */}
          <TabsContent value="stats" className="mt-6">
            {statsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Usuários", value: stats.totalUsers },
                  { label: "Questões", value: stats.totalQuestoes },
                  { label: "Respostas", value: stats.totalRespostas },
                  { label: "Simulados", value: stats.totalSimulados },
                  { label: "Horas de Estudo", value: `${stats.totalStudyHours}h` },
                  { label: "Taxa de Acerto", value: `${stats.acertoGeral}%` },
                ].map((s, i) => (
                  <Card key={i} className="glass-card border-none">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold text-foreground">{s.value}</p></CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users" className="mt-6 space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, CPF ou email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadUsers()} className="pl-9" />
              </div>
              <Button onClick={loadUsers} variant="secondary" size="sm">Buscar</Button>
            </div>
            {usersLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>CPF</TableHead><TableHead>Cadastro</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
                    ) : users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.nome}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">{u.cpf}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* QUESTÕES */}
          <TabsContent value="questoes" className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={questoesDisciplina} onValueChange={setQuestoesDisciplina}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Disciplina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as disciplinas</SelectItem>
                  {disciplinas.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar no enunciado..." value={questoesSearch} onChange={(e) => setQuestoesSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadQuestoes(0)} className="pl-9" />
              </div>
              <Button onClick={() => loadQuestoes(0)} variant="secondary" size="sm">Filtrar</Button>
            </div>
            {questoesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{questoesTotal} questões encontradas</p>
                <div className="glass-card rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-16">ID</TableHead><TableHead>Enunciado</TableHead><TableHead className="w-32">Disciplina</TableHead><TableHead className="w-20">Dif.</TableHead><TableHead className="w-16">Gab.</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {questoes.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma questão encontrada</TableCell></TableRow>
                      ) : questoes.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="font-mono text-xs">{q.id}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{q.enunciado}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{q.disciplina}</Badge></TableCell>
                          <TableCell className="text-xs">{q.dificuldade}</TableCell>
                          <TableCell className="font-bold text-primary">{gabaritoLabel(q.gabarito)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewQuestion(q)}><Eye className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteQuestion(q.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Página {questoesPage + 1} de {Math.max(1, Math.ceil(questoesTotal / PAGE_SIZE))}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={questoesPage === 0} onClick={() => loadQuestoes(questoesPage - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" disabled={(questoesPage + 1) * PAGE_SIZE >= questoesTotal} onClick={() => loadQuestoes(questoesPage + 1)}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* GERAR QUESTÕES */}
          <TabsContent value="gerar" className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Gerar Questões via IA</h2>
              <p className="text-sm text-muted-foreground">Gera questões baseadas na legislação do edital verticalizado. Cada questão cita artigos específicos da lei seca.</p>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Disciplina</label>
                <Select value={genDisciplina} onValueChange={setGenDisciplina}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas (7 disciplinas)</SelectItem>
                    {DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Questões por lote</label>
                <Input type="number" value={genBatchSize} onChange={(e) => setGenBatchSize(Number(e.target.value))} className="w-24" min={1} max={20} disabled={genRunning} />
              </div>
              <Button onClick={startGeneration} disabled={genRunning} className="gradient-primary text-primary-foreground font-bold">
                {genRunning ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Gerando... ({genTotal})</> : <><Zap className="w-4 h-4 mr-2" />Iniciar Geração</>}
              </Button>
            </div>

            {genResults.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {genResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 glass-card rounded-lg p-3 text-sm">
                    {r.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {r.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {r.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                    {r.status === "pending" && <div className="w-4 h-4 rounded-full bg-muted" />}
                    <span className="font-medium">{r.disciplina}</span>
                    {r.status === "success" && <span className="text-muted-foreground ml-auto text-xs">{r.geradas} geradas</span>}
                    {r.error && <span className="text-destructive text-xs ml-auto truncate max-w-xs">{r.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* VALIDAR QUESTÕES */}
          <TabsContent value="validar" className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Validação de Questões via IA</h2>
              <p className="text-sm text-muted-foreground">A IA revisa cada questão, corrige alternativas problemáticas, ajusta gabaritos e remove questões irrecuperáveis.</p>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Iniciar do offset</label>
                <Input type="number" value={valOffset} onChange={(e) => setValOffset(Number(e.target.value))} className="w-24" disabled={valRunning} />
              </div>
              <Button onClick={startValidation} disabled={valRunning} className="gradient-primary text-primary-foreground font-bold">
                {valRunning ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Validando... ({valTotals.validated})</> : <><ShieldCheck className="w-4 h-4 mr-2" />Iniciar Validação</>}
              </Button>
            </div>

            {valTotals.validated > 0 && (
              <div className="flex gap-4 flex-wrap">
                <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" /><span className="font-medium">{valTotals.ok} OK</span></div>
                <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm"><Wrench className="w-4 h-4 text-primary" /><span className="font-medium">{valTotals.fixed} Corrigidas</span></div>
                <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-sm"><Trash2 className="w-4 h-4 text-destructive" /><span className="font-medium">{valTotals.deleted} Excluídas</span></div>
              </div>
            )}

            {valResults.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {valResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 glass-card rounded-lg p-3 text-sm">
                    {r.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {r.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {r.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                    {r.status === "pending" && <div className="w-4 h-4 rounded-full bg-muted" />}
                    <span className="font-medium">Lote {r.batch}</span>
                    {r.status === "success" && <span className="text-muted-foreground ml-auto text-xs">{r.ok} ok · {r.fixed} corrigidas · {r.deleted} excluídas</span>}
                    {r.error && <span className="text-destructive text-xs ml-auto truncate max-w-xs">{r.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* View question dialog */}
        <Dialog open={!!viewQuestion} onOpenChange={() => setViewQuestion(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {viewQuestion && (
              <>
                <DialogHeader><DialogTitle className="text-sm font-mono text-muted-foreground">Questão #{viewQuestion.id}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Disciplina: {viewQuestion.disciplina} · {viewQuestion.assunto} · {viewQuestion.dificuldade}</p>
                    <p className="text-sm">{viewQuestion.enunciado}</p>
                  </div>
                  <div className="space-y-2">
                    {[viewQuestion.alt_a, viewQuestion.alt_b, viewQuestion.alt_c, viewQuestion.alt_d, viewQuestion.alt_e].map((alt, i) => (
                      <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${i === viewQuestion.gabarito ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
                        <span className="font-bold text-xs mt-0.5">{["A", "B", "C", "D", "E"][i]})</span>
                        <span>{alt}</span>
                        {i === viewQuestion.gabarito && <CheckCircle className="w-4 h-4 text-primary shrink-0 ml-auto" />}
                      </div>
                    ))}
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário:</p>
                    <p className="text-sm">{viewQuestion.comentario}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="destructive" size="sm" onClick={() => { deleteQuestion(viewQuestion.id); setViewQuestion(null); }}>
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminPanel;
