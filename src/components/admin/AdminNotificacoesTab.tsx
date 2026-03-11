import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Send } from "lucide-react";

export function AdminNotificacoesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const { data } = await supabase.from("notifications" as any).select("*").order("created_at", { ascending: false }).limit(50);
    setNotifications((data as any[]) || []);
    setLoading(false);
  };

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Preencha título e mensagem", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("notifications" as any).insert({ title: title.trim(), message: message.trim(), created_by: user?.id } as any);
    setSending(false);
    if (error) {
      toast({ title: "Erro ao enviar notificação", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notificação enviada com sucesso!" });
      setTitle("");
      setMessage("");
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
            {sending ? "Enviando..." : "Enviar para todos"}
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
                    <p className="font-semibold text-sm">{n.title}</p>
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
