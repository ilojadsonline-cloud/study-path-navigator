import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Send, Users, User, Search, X } from "lucide-react";

type ProfileLite = { user_id: string; nome: string | null; email: string | null };

export function AdminNotificacoesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Destinatário
  const [target, setTarget] = useState<"all" | "user">("all");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [selectedUser, setSelectedUser] = useState<ProfileLite | null>(null);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const { data } = await supabase.from("notifications" as any).select("*").order("created_at", { ascending: false }).limit(50);
    setNotifications((data as any[]) || []);
    setLoading(false);
  };

  const runSearch = async () => {
    const q = search.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nome, email")
      .or(`nome.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(15);
    setResults((data as ProfileLite[]) || []);
    setSearching(false);
  };

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Preencha título e mensagem", variant: "destructive" });
      return;
    }
    if (target === "user" && !selectedUser) {
      toast({ title: "Selecione um usuário destinatário", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("notifications" as any).insert({
      title: title.trim(),
      message: message.trim(),
      created_by: user?.id,
      user_id: target === "user" ? selectedUser?.user_id : null,
    } as any);
    setSending(false);
    if (error) {
      toast({ title: "Erro ao enviar notificação", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: target === "user"
          ? `Notificação enviada para ${selectedUser?.nome || selectedUser?.email}`
          : "Notificação enviada para todos!",
      });
      setTitle("");
      setMessage("");
      setSelectedUser(null);
      setSearch("");
      setResults([]);
      loadNotifications();
    }
  };

  const deleteNotification = async (id: number) => {
    await supabase.from("notifications" as any).delete().eq("id", id);
    loadNotifications();
    toast({ title: "Notificação excluída" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Send className="w-5 h-5" />Enviar Notificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Destinatário */}
          <div>
            <label className="text-sm font-medium text-foreground">Destinatário</label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={target === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => { setTarget("all"); setSelectedUser(null); }}
                className="gap-1"
              >
                <Users className="w-4 h-4" /> Todos
              </Button>
              <Button
                type="button"
                variant={target === "user" ? "default" : "outline"}
                size="sm"
                onClick={() => setTarget("user")}
                className="gap-1"
              >
                <User className="w-4 h-4" /> Usuário específico
              </Button>
            </div>
          </div>

          {target === "user" && (
            <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/20 p-3">
              {selectedUser ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold shrink-0">
                      {(selectedUser.nome || selectedUser.email || "U").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedUser.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
                      placeholder="Buscar por nome ou e-mail..."
                    />
                    <Button type="button" variant="secondary" onClick={runSearch} disabled={searching}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  {results.length > 0 && (
                    <div className="max-h-52 overflow-y-auto divide-y divide-border/40 rounded-md border border-border/40">
                      {results.map((p) => (
                        <button
                          key={p.user_id}
                          type="button"
                          onClick={() => { setSelectedUser(p); setResults([]); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold shrink-0">
                            {(p.nome || p.email || "U").charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.nome || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Nova atualização disponível" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Mensagem</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva a mensagem da notificação..." rows={4} />
          </div>
          <Button onClick={sendNotification} disabled={sending} className="gradient-primary text-primary-foreground font-bold">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            {sending
              ? "Enviando..."
              : target === "user"
                ? "Enviar para usuário"
                : "Enviar para todos"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notificações Enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação enviada ainda.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n: any) => (
                <div key={n.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{n.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${n.user_id ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                        {n.user_id ? "Individual" : "Todos"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteNotification(n.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
