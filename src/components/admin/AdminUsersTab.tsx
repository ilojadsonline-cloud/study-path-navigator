import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCPF, cleanCPF, validateCPF } from "@/lib/cpf";
import {
  Users, Trash2, Search, Loader2, ShieldAlert, UserPlus, UserMinus, Ban, Pencil, Save, Clock, Crown, RefreshCw, KeyRound,
} from "lucide-react";

interface EnrichedUser {
  user_id: string; nome: string; cpf: string; email: string | null; telefone: string | null; created_at: string;
  is_admin: boolean; is_blocked: boolean; subscribed: boolean; subscription_end: string | null;
  trial_expired?: boolean;
}

interface EditUserData { user_id: string; nome: string; email: string; cpf: string; }

export function AdminUsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserNome, setNewUserNome] = useState("");
  const [newUserCpf, setNewUserCpf] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<EnrichedUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<EditUserData | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ user_id: string; nome: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "list_users", search: search || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(data?.users || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar usuários", description: err.message, variant: "destructive" });
    }
    setLoading(false);
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
      loadUsers();
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
      loadUsers();
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

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" }); return;
    }
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "reset_password", user_id: resetPasswordUser.user_id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Senha alterada com sucesso!" });
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
    }
    setResettingPassword(false);
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF ou email..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadUsers()} className="pl-9" />
        </div>
        <Button onClick={loadUsers} variant="secondary" size="sm"><RefreshCw className="w-3.5 h-3.5 mr-1" />Buscar</Button>
        <Button onClick={() => setShowAddUser(true)} size="sm" className="gradient-primary text-primary-foreground font-bold">
          <UserPlus className="w-4 h-4 mr-1" /> Cadastrar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
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
                    <TableCell className="text-muted-foreground text-xs">{u.telefone || "—"}</TableCell>
                    <TableCell>
                      {u.is_blocked ? (
                        <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.is_admin ? (
                        <Badge variant="secondary" className="text-[10px]">Admin</Badge>
                      ) : u.subscribed && daysLeft !== null ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary" />
                          <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-destructive" : daysLeft <= 30 ? "text-warning" : "text-success"}`}>
                            {daysLeft}d restantes
                          </span>
                        </div>
                      ) : u.trial_expired ? (
                        <Badge variant="destructive" className="text-[10px]">Teste expirado</Badge>
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
                            <ShieldAlert className={`w-3.5 h-3.5 ${u.is_admin ? "text-warning" : "text-muted-foreground"}`} />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title={u.is_blocked ? "Desbloquear" : "Bloquear"}
                          onClick={() => handleToggleBlock(u.user_id, !u.is_blocked)} disabled={actionLoading === u.user_id + "_block"}>
                          {actionLoading === u.user_id + "_block" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                            <Ban className={`w-3.5 h-3.5 ${u.is_blocked ? "text-destructive" : "text-muted-foreground"}`} />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Alterar senha"
                          onClick={() => setResetPasswordUser({ user_id: u.user_id, nome: u.nome })}>
                          <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar cadastro"
                          onClick={() => setEditUser({ user_id: u.user_id, nome: u.nome, email: u.email || "", cpf: u.cpf })}>
                          <Pencil className="w-3.5 h-3.5" />
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

      {/* Add User Dialog */}
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

      {/* Confirm Delete User Dialog */}
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

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          {editUser && (
            <>
              <DialogHeader><DialogTitle>Editar Cadastro</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <Input value={editUser.nome} onChange={(e) => setEditUser({ ...editUser, nome: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Email</label>
                  <Input type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">CPF</label>
                  <Input value={formatCPF(editUser.cpf)} onChange={(e) => setEditUser({ ...editUser, cpf: e.target.value })} maxLength={14} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                <Button onClick={handleEditUser} disabled={savingUser} className="gradient-primary text-primary-foreground font-bold">
                  {savingUser ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {savingUser ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={() => { setResetPasswordUser(null); setNewPassword(""); }}>
        <DialogContent className="max-w-sm">
          {resetPasswordUser && (
            <>
              <DialogHeader><DialogTitle>Alterar Senha</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                Definir nova senha para <strong>{resetPasswordUser.nome}</strong>
              </p>
              <Input
                type="password"
                placeholder="Nova senha (mín. 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setResetPasswordUser(null); setNewPassword(""); }}>Cancelar</Button>
                <Button onClick={handleResetPassword} disabled={resettingPassword} className="gradient-primary text-primary-foreground font-bold">
                  {resettingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <KeyRound className="w-4 h-4 mr-1" />}
                  {resettingPassword ? "Alterando..." : "Alterar Senha"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
