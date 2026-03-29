import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnlineUser {
  nome: string;
  email: string | null;
  last_seen_at: string | null;
  user_id: string;
}

export function AdminOnlineTab() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nome, email, last_seen_at" as any)
      .not("last_seen_at" as any, "is", null)
      .order("last_seen_at" as any, { ascending: false })
      .limit(50);
    setUsers((data as any[]) || []);
    setLoading(false);
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  const formatTime = (lastSeen: string | null) => {
    if (!lastSeen) return "Nunca";
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 60000) return "Agora";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return new Date(lastSeen).toLocaleDateString("pt-BR");
  };

  const onlineCount = users.filter(u => isOnline(u.last_seen_at)).length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="w-5 h-5 text-success" />
          <span className="text-sm font-medium">{onlineCount} usuário(s) online agora</span>
        </div>
        <Button variant="outline" size="sm" onClick={loadUsers}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" />Atualizar
        </Button>
      </div>

      <div className="grid gap-2">
        {users.map((u) => {
          const online = isOnline(u.last_seen_at);
          return (
            <Card key={u.user_id} className="glass-card border-none">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${online ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.nome}</p>
                    {u.email && <p className="text-[10px] text-muted-foreground">{u.email}</p>}
                  </div>
                </div>
                <Badge variant="outline" className={online ? "bg-success/10 text-success border-success/30 text-xs" : "text-xs"}>
                  {online ? <><Wifi className="w-3 h-3 mr-1" />Online</> : <><WifiOff className="w-3 h-3 mr-1" />{formatTime(u.last_seen_at)}</>}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
        {users.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum usuário com atividade recente.</p>
        )}
      </div>
    </div>
  );
}
