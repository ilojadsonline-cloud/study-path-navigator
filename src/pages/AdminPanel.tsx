import { useState, useEffect } from "react";
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
import {
  Users, HelpCircle, BarChart3, Trash2, Eye, Search, ChevronLeft, ChevronRight,
  Loader2, Shield, BookOpen, CheckCircle, XCircle
} from "lucide-react";

interface UserProfile {
  user_id: string;
  nome: string;
  cpf: string;
  email: string | null;
  created_at: string;
}

interface Questao {
  id: number;
  disciplina: string;
  assunto: string;
  dificuldade: string;
  enunciado: string;
  alt_a: string;
  alt_b: string;
  alt_c: string;
  alt_d: string;
  alt_e: string;
  gabarito: number;
  comentario: string;
}

interface Stats {
  totalUsers: number;
  totalQuestoes: number;
  totalRespostas: number;
  totalSimulados: number;
  totalStudyHours: number;
  acertoGeral: number;
}

const AdminPanel = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();

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

  // View question dialog
  const [viewQuestion, setViewQuestion] = useState<Questao | null>(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadDisciplinas();
    }
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
      totalUsers: profilesRes.count || 0,
      totalQuestoes: questoesRes.count || 0,
      totalRespostas,
      totalSimulados: simuladosRes.count || 0,
      totalStudyHours: Math.round(totalSeconds / 3600),
      acertoGeral: totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0,
    });
    setStatsLoading(false);
  };

  const loadDisciplinas = async () => {
    const { data } = await supabase.from("questoes").select("disciplina");
    if (data) {
      const unique = [...new Set(data.map(d => d.disciplina))].sort();
      setDisciplinas(unique);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    let query = supabase.from("profiles").select("user_id, nome, cpf, email, created_at").order("created_at", { ascending: false });
    if (userSearch) {
      query = query.or(`nome.ilike.%${userSearch}%,cpf.ilike.%${userSearch}%,email.ilike.%${userSearch}%`);
    }
    const { data } = await query.limit(100);
    setUsers(data || []);
    setUsersLoading(false);
  };

  const loadQuestoes = async (page = 0) => {
    setQuestoesLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let countQuery = supabase.from("questoes").select("*", { count: "exact", head: true });
    let query = supabase.from("questoes").select("*").order("id", { ascending: false }).range(from, to);

    if (questoesDisciplina !== "todas") {
      countQuery = countQuery.eq("disciplina", questoesDisciplina);
      query = query.eq("disciplina", questoesDisciplina);
    }
    if (questoesSearch) {
      countQuery = countQuery.ilike("enunciado", `%${questoesSearch}%`);
      query = query.ilike("enunciado", `%${questoesSearch}%`);
    }

    const [{ count }, { data }] = await Promise.all([countQuery, query]);
    setQuestoesTotal(count || 0);
    setQuestoes((data as Questao[]) || []);
    setQuestoesPage(page);
    setQuestoesLoading(false);
  };

  const deleteQuestion = async (id: number) => {
    // Need service role for delete - use edge function or RPC
    // For now, delete via direct call (admin RLS needed)
    const { error: respError } = await supabase.from("respostas_usuario").delete().eq("questao_id", id);
    const { error } = await supabase.from("questoes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Questão excluída" });
      loadQuestoes(questoesPage);
      loadStats();
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

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
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="stats" className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Estatísticas</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2"><Users className="w-4 h-4" />Usuários</TabsTrigger>
            <TabsTrigger value="questoes" className="flex items-center gap-2"><HelpCircle className="w-4 h-4" />Questões</TabsTrigger>
          </TabsList>

          {/* STATS */}
          <TabsContent value="stats" className="mt-6">
            {statsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="glass-card border-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Usuários</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-foreground">{stats.totalUsers}</p></CardContent>
                </Card>
                <Card className="glass-card border-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Questões</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-foreground">{stats.totalQuestoes}</p></CardContent>
                </Card>
                <Card className="glass-card border-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Respostas</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-foreground">{stats.totalRespostas}</p></CardContent>
                </Card>
                <Card className="glass-card border-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Simulados</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-foreground">{stats.totalSimulados}</p></CardContent>
                </Card>
                <Card className="glass-card border-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horas de Estudo</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-foreground">{stats.totalStudyHours}h</p></CardContent>
                </Card>
                <Card className="glass-card border-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa de Acerto</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold text-foreground">{stats.acertoGeral}%</p></CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users" className="mt-6 space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                  className="pl-9"
                />
              </div>
              <Button onClick={loadUsers} variant="secondary" size="sm">Buscar</Button>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
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

          {/* QUESTOES */}
          <TabsContent value="questoes" className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={questoesDisciplina} onValueChange={(v) => { setQuestoesDisciplina(v); }}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Disciplina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as disciplinas</SelectItem>
                  {disciplinas.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar no enunciado..."
                  value={questoesSearch}
                  onChange={(e) => setQuestoesSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadQuestoes(0)}
                  className="pl-9"
                />
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
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">ID</TableHead>
                        <TableHead>Enunciado</TableHead>
                        <TableHead className="w-32">Disciplina</TableHead>
                        <TableHead className="w-20">Dificuldade</TableHead>
                        <TableHead className="w-16">Gab.</TableHead>
                        <TableHead className="w-24">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
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
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewQuestion(q)}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteQuestion(q.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {questoesPage + 1} de {Math.max(1, Math.ceil(questoesTotal / PAGE_SIZE))}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={questoesPage === 0} onClick={() => loadQuestoes(questoesPage - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={(questoesPage + 1) * PAGE_SIZE >= questoesTotal} onClick={() => loadQuestoes(questoesPage + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* View question dialog */}
        <Dialog open={!!viewQuestion} onOpenChange={() => setViewQuestion(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {viewQuestion && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-sm font-mono text-muted-foreground">Questão #{viewQuestion.id}</DialogTitle>
                </DialogHeader>
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
