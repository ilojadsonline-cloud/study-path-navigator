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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatCPF, cleanCPF, validateCPF } from "@/lib/cpf";
import {
  Users, HelpCircle, BarChart3, Trash2, Eye, Search, ChevronLeft, ChevronRight,
  Loader2, Shield, CheckCircle, Wrench, AlertCircle, ShieldCheck, Zap, UserPlus,
  UserMinus, Ban, ShieldAlert, Pencil, Save, Clock, Crown, RefreshCw
} from "lucide-react";

// ── Types ──
interface EnrichedUser {
  user_id: string; nome: string; cpf: string; email: string | null; created_at: string;
  is_admin: boolean; is_blocked: boolean; subscribed: boolean; subscription_end: string | null;
}
interface EditUserData {
  user_id: string; nome: string; email: string; cpf: string;
}
interface Questao {
  id: number; disciplina: string; assunto: string; dificuldade: string; enunciado: string;
  alt_a: string; alt_b: string; alt_c: string; alt_d: string; alt_e: string; gabarito: number; comentario: string;
}
interface Stats { totalUsers: number; totalQuestoes: number; totalRespostas: number; totalSimulados: number; totalStudyHours: number; acertoGeral: number; }
interface BatchResult {
  disciplina?: string; batch: number; status: "pending" | "loading" | "success" | "error";
  geradas?: number; validated?: number; ok?: number; fixed?: number; deleted?: number; error?: string;
}

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
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Questões
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [questoesLoading, setQuestoesLoading] = useState(false);
  const [questoesPage, setQuestoesPage] = useState(0);
  const [questoesTotal, setQuestoesTotal] = useState(0);
  const [questoesDisciplina, setQuestoesDisciplina] = useState("todas");
  const [questoesSearch, setQuestoesSearch] = useState("");
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [viewQuestion, setViewQuestion] = useState<Questao | null>(null);
  const [editQuestion, setEditQuestion] = useState<Questao | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [confirmDeleteQ, setConfirmDeleteQ] = useState<Questao | null>(null);

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
  const [valFinished, setValFinished] = useState(false);

  // Add user dialog
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserNome, setNewUserNome] = useState("");
  const [newUserCpf, setNewUserCpf] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  // Confirm delete user dialog
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<EnrichedUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  // Edit user dialog
  const [editUser, setEditUser] = useState<EditUserData | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  // Cursor for validation
  const [valCursor, setValCursor] = useState(0);

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (isAdmin) { loadStats(); loadDisciplinas(); }
  }, [isAdmin]);

  // ── Stats ──
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

  // ── Users (via edge function for enriched data) ──
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "list_users", search: userSearch || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(data?.users || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar usuários", description: err.message, variant: "destructive" });
    }
    setUsersLoading(false);
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserNome || !newUserCpf) {
      toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
    }
    if (!validateCPF(newUserCpf)) { toast({ title: "CPF inválido", variant: "destructive" }); return; }
    if (newUserPassword.length < 6) { toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" }); return; }
    setAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "create", email: newUserEmail, password: newUserPassword, nome: newUserNome, cpf: cleanCPF(newUserCpf) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário criado com sucesso!" });
      setShowAddUser(false);
      setNewUserEmail(""); setNewUserPassword(""); setNewUserNome(""); setNewUserCpf("");
      loadUsers(); loadStats();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    }
    setAddingUser(false);
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário excluído com sucesso!" });
      setConfirmDeleteUser(null);
      loadUsers(); loadStats();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
    setDeletingUserId(null);
  };

  const handleToggleAdmin = async (userId: string) => {
    setActionLoading(userId + "_admin");
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "toggle_admin", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: data.is_admin ? "Usuário promovido a admin" : "Admin removido do usuário" });
      loadUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleToggleBlock = async (userId: string, block: boolean) => {
    setActionLoading(userId + "_block");
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "toggle_block", user_id: userId, block },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: block ? "Usuário bloqueado" : "Usuário desbloqueado" });
      loadUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    setSavingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "update_user", user_id: editUser.user_id, nome: editUser.nome, email: editUser.email, cpf: cleanCPF(editUser.cpf) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário atualizado!" });
      setEditUser(null);
      loadUsers();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    }
    setSavingUser(false);
  };

  // ── Questões ──
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
    else { toast({ title: "Questão excluída" }); setConfirmDeleteQ(null); setViewQuestion(null); loadQuestoes(questoesPage); loadStats(); }
  };

  const handleSaveQuestion = async () => {
    if (!editQuestion) return;
    setSavingQuestion(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "update_question",
          question_id: editQuestion.id,
          updates: {
            enunciado: editQuestion.enunciado,
            alt_a: editQuestion.alt_a, alt_b: editQuestion.alt_b, alt_c: editQuestion.alt_c,
            alt_d: editQuestion.alt_d, alt_e: editQuestion.alt_e,
            gabarito: editQuestion.gabarito, comentario: editQuestion.comentario,
            disciplina: editQuestion.disciplina, assunto: editQuestion.assunto, dificuldade: editQuestion.dificuldade,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Questão atualizada!" });
      setEditQuestion(null);
      loadQuestoes(questoesPage);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSavingQuestion(false);
  };

  // ── Gerar Questões ──
  const startGeneration = async () => {
    setGenRunning(true); setGenTotal(0);
    const indices = genDisciplina === "todas" ? DISCIPLINES.map((_, i) => i) : [DISCIPLINES.indexOf(genDisciplina)];
    const batches: BatchResult[] = indices.map((i, idx) => ({ batch: idx + 1, disciplina: DISCIPLINES[i], status: "pending" as const }));
    setGenResults([...batches]);
    let total = 0;
    for (let i = 0; i < batches.length; i++) {
      batches[i].status = "loading"; setGenResults([...batches]);
      try {
        const { data, error } = await supabase.functions.invoke("generate-questions-batch", {
          body: { disciplina_index: DISCIPLINES.indexOf(batches[i].disciplina!), batch_size: genBatchSize },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        batches[i].status = "success"; batches[i].geradas = data?.inserted || 0;
        total += data?.inserted || 0; setGenTotal(total);
      } catch (err: any) {
        batches[i].status = "error"; batches[i].error = err.message;
        if (err.message?.includes("402") || err.message?.includes("credits")) {
          toast({ title: "Sem créditos", description: err.message, variant: "destructive" }); break;
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
    setValRunning(true); setValFinished(false);
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
      batches[i].status = "loading"; setValResults([...batches]);
      try {
        const offset = valOffset + i * batchSize;
        const { data, error } = await supabase.functions.invoke("validate-questions", { body: { offset, limit: batchSize } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        batches[i].status = "success";
        batches[i].validated = data?.validated || 0; batches[i].ok = data?.ok || 0;
        batches[i].fixed = data?.fixed || 0; batches[i].deleted = data?.deleted || 0;
        runningTotals.validated += data?.validated || 0; runningTotals.ok += data?.ok || 0;
        runningTotals.fixed += data?.fixed || 0; runningTotals.deleted += data?.deleted || 0;
        setValTotals({ ...runningTotals });
      } catch (err: any) {
        batches[i].status = "error"; batches[i].error = err.message;
        if (err.message?.includes("429") || err.message?.includes("402") || err.message?.includes("Rate limit")) {
          toast({ title: "Pausado", description: err.message, variant: "destructive" }); break;
        }
      }
      setValResults([...batches]);
      await new Promise(r => setTimeout(r, 3000));
    }
    setValRunning(false); setValFinished(true);
    toast({ title: "Validação concluída!", description: `${runningTotals.validated} revisadas, ${runningTotals.fixed} corrigidas, ${runningTotals.deleted} excluídas.` });
    loadStats();
  };

  const handleSaveValidation = () => {
    toast({ title: "Alterações salvas!", description: "Todas as correções e exclusões já foram aplicadas diretamente no banco de dados durante a validação." });
    setValFinished(false);
    setValResults([]); setValTotals({ validated: 0, ok: 0, fixed: 0, deleted: 0 });
  };

  // ── Helpers ──
  const gabaritoLabel = (g: number) => ["A", "B", "C", "D", "E"][g] || "?";

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

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
            <TabsTrigger value="stats" className="flex items-center gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" />Estatísticas</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />Usuários</TabsTrigger>
            <TabsTrigger value="questoes" className="flex items-center gap-1.5 text-xs"><HelpCircle className="w-3.5 h-3.5" />Questões</TabsTrigger>
            <TabsTrigger value="gerar" className="flex items-center gap-1.5 text-xs"><Zap className="w-3.5 h-3.5" />Gerar</TabsTrigger>
            <TabsTrigger value="validar" className="flex items-center gap-1.5 text-xs"><ShieldCheck className="w-3.5 h-3.5" />Validar</TabsTrigger>
          </TabsList>

          {/* ── STATS ── */}
          <TabsContent value="stats" className="mt-6">
            {statsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Usuários", value: stats.totalUsers, icon: Users },
                  { label: "Questões", value: stats.totalQuestoes, icon: HelpCircle },
                  { label: "Respostas", value: stats.totalRespostas, icon: CheckCircle },
                  { label: "Simulados", value: stats.totalSimulados, icon: BarChart3 },
                  { label: "Horas de Estudo", value: `${stats.totalStudyHours}h`, icon: Clock },
                  { label: "Taxa de Acerto", value: `${stats.acertoGeral}%`, icon: CheckCircle },
                ].map((s, i) => (
                  <Card key={i} className="glass-card border-none">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <s.icon className="w-4 h-4 text-primary" />
                      <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-3xl font-bold text-foreground">{s.value}</p></CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── USERS ── */}
          <TabsContent value="users" className="mt-6 space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, CPF ou email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadUsers()} className="pl-9" />
              </div>
              <Button onClick={loadUsers} variant="secondary" size="sm"><RefreshCw className="w-3.5 h-3.5 mr-1" />Buscar</Button>
              <Button onClick={() => setShowAddUser(true)} size="sm" className="gradient-primary text-primary-foreground font-bold">
                <UserPlus className="w-4 h-4 mr-1" /> Cadastrar
              </Button>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Assinatura</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="w-40">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
                    ) : users.map((u) => {
                      const daysLeft = getDaysRemaining(u.subscription_end);
                      return (
                        <TableRow key={u.user_id} className={u.is_blocked ? "opacity-60" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {u.nome}
                              {u.is_admin && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{u.email || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">{u.cpf}</TableCell>
                          <TableCell>
                            {u.is_blocked ? (
                              <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600">Ativo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.is_admin ? (
                              <Badge variant="secondary" className="text-[10px]">Admin</Badge>
                            ) : u.subscribed && daysLeft !== null ? (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-primary" />
                                <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-destructive" : daysLeft <= 30 ? "text-yellow-600" : "text-green-600"}`}>
                                  {daysLeft}d restantes
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem assinatura</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" title={u.is_admin ? "Remover admin" : "Tornar admin"}
                                onClick={() => handleToggleAdmin(u.user_id)} disabled={actionLoading === u.user_id + "_admin"}>
                                {actionLoading === u.user_id + "_admin" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                                  <ShieldAlert className={`w-3.5 h-3.5 ${u.is_admin ? "text-yellow-500" : "text-muted-foreground"}`} />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title={u.is_blocked ? "Desbloquear" : "Bloquear"}
                                onClick={() => handleToggleBlock(u.user_id, !u.is_blocked)} disabled={actionLoading === u.user_id + "_block"}>
                                {actionLoading === u.user_id + "_block" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                                  <Ban className={`w-3.5 h-3.5 ${u.is_blocked ? "text-destructive" : "text-muted-foreground"}`} />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir"
                                onClick={() => setConfirmDeleteUser(u)}>
                                <UserMinus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── QUESTÕES ── */}
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
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">ID</TableHead><TableHead>Enunciado</TableHead>
                        <TableHead className="w-32">Disciplina</TableHead><TableHead className="w-20">Dif.</TableHead>
                        <TableHead className="w-16">Gab.</TableHead><TableHead className="w-28">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questoes.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma questão</TableCell></TableRow>
                      ) : questoes.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="font-mono text-xs">{q.id}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{q.enunciado}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{q.disciplina}</Badge></TableCell>
                          <TableCell className="text-xs">{q.dificuldade}</TableCell>
                          <TableCell className="font-bold text-primary">{gabaritoLabel(q.gabarito)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewQuestion(q)} title="Visualizar"><Eye className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditQuestion({ ...q })} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteQ(q)} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>
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

          {/* ── GERAR ── */}
          <TabsContent value="gerar" className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Gerar Questões via IA</h2>
              <p className="text-sm text-muted-foreground">Questões baseadas na legislação do edital verticalizado com citação de artigos.</p>
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

          {/* ── VALIDAR ── */}
          <TabsContent value="validar" className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Validação de Questões via IA</h2>
              <p className="text-sm text-muted-foreground">A IA revisa, corrige e remove questões problemáticas automaticamente.</p>
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Iniciar do offset</label>
                <Input type="number" value={valOffset} onChange={(e) => setValOffset(Number(e.target.value))} className="w-24" disabled={valRunning} />
              </div>
              <Button onClick={startValidation} disabled={valRunning} className="gradient-primary text-primary-foreground font-bold">
                {valRunning ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Validando... ({valTotals.validated})</> : <><ShieldCheck className="w-4 h-4 mr-2" />Iniciar Validação</>}
              </Button>
              {valFinished && !valRunning && (
                <Button onClick={handleSaveValidation} className="bg-green-600 hover:bg-green-700 text-white font-bold">
                  <Save className="w-4 h-4 mr-2" />Salvar Alterações
                </Button>
              )}
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

        {/* ── View Question Dialog ── */}
        <Dialog open={!!viewQuestion} onOpenChange={() => setViewQuestion(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {viewQuestion && (
              <>
                <DialogHeader><DialogTitle className="text-sm font-mono text-muted-foreground">Questão #{viewQuestion.id}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{viewQuestion.disciplina} · {viewQuestion.assunto} · {viewQuestion.dificuldade}</p>
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
                <DialogFooter className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditQuestion({ ...viewQuestion }); setViewQuestion(null); }}>
                    <Pencil className="w-4 h-4 mr-1" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => { setConfirmDeleteQ(viewQuestion); setViewQuestion(null); }}>
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Edit Question Dialog ── */}
        <Dialog open={!!editQuestion} onOpenChange={() => setEditQuestion(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {editQuestion && (
              <>
                <DialogHeader><DialogTitle>Editar Questão #{editQuestion.id}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Disciplina</label>
                      <Input value={editQuestion.disciplina} onChange={(e) => setEditQuestion({ ...editQuestion, disciplina: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Assunto</label>
                      <Input value={editQuestion.assunto} onChange={(e) => setEditQuestion({ ...editQuestion, assunto: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Dificuldade</label>
                      <Select value={editQuestion.dificuldade} onValueChange={(v) => setEditQuestion({ ...editQuestion, dificuldade: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fácil">Fácil</SelectItem>
                          <SelectItem value="Médio">Médio</SelectItem>
                          <SelectItem value="Difícil">Difícil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Enunciado</label>
                    <Textarea value={editQuestion.enunciado} onChange={(e) => setEditQuestion({ ...editQuestion, enunciado: e.target.value })} rows={3} />
                  </div>
                  {(["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const).map((key, i) => (
                    <div key={key} className="flex items-start gap-2">
                      <div className="flex items-center gap-1 mt-2">
                        <input type="radio" name="gabarito" checked={editQuestion.gabarito === i}
                          onChange={() => setEditQuestion({ ...editQuestion, gabarito: i })} className="accent-primary" />
                        <span className="text-xs font-bold">{["A", "B", "C", "D", "E"][i]}</span>
                      </div>
                      <Textarea value={editQuestion[key]} onChange={(e) => setEditQuestion({ ...editQuestion, [key]: e.target.value })} rows={1} className="flex-1" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-muted-foreground">Comentário</label>
                    <Textarea value={editQuestion.comentario} onChange={(e) => setEditQuestion({ ...editQuestion, comentario: e.target.value })} rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditQuestion(null)}>Cancelar</Button>
                  <Button onClick={handleSaveQuestion} disabled={savingQuestion} className="gradient-primary text-primary-foreground font-bold">
                    {savingQuestion ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                    {savingQuestion ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Confirm Delete Question Dialog ── */}
        <Dialog open={!!confirmDeleteQ} onOpenChange={() => setConfirmDeleteQ(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Excluir Questão</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir a questão <strong>#{confirmDeleteQ?.id}</strong>? As respostas dos usuários também serão removidas.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteQ(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => confirmDeleteQ && deleteQuestion(confirmDeleteQ.id)}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add User Dialog ── */}
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cadastrar Novo Usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome completo" value={newUserNome} onChange={(e) => setNewUserNome(e.target.value)} />
              <Input placeholder="Email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              <Input placeholder="CPF" value={newUserCpf} onChange={(e) => setNewUserCpf(formatCPF(e.target.value))} maxLength={14} />
              <Input placeholder="Senha (mín. 6 caracteres)" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancelar</Button>
              <Button onClick={handleAddUser} disabled={addingUser} className="gradient-primary text-primary-foreground font-bold">
                {addingUser ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                {addingUser ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Confirm Delete User Dialog ── */}
        <Dialog open={!!confirmDeleteUser} onOpenChange={() => setConfirmDeleteUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Excluir Usuário</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong>{confirmDeleteUser?.nome}</strong>? Todos os dados serão removidos permanentemente.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteUser(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => confirmDeleteUser && handleDeleteUser(confirmDeleteUser.user_id)} disabled={!!deletingUserId}>
                {deletingUserId ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                {deletingUserId ? "Excluindo..." : "Excluir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminPanel;
