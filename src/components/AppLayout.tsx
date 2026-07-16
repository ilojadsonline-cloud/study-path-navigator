import { useState, useEffect, useCallback, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserMenu } from "@/components/UserMenu";
import { Shield, Bell, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Notification {
  id: number;
  title: string;
  message: string;
  created_at: string;
  user_id?: string | null;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { profile, user } = useAuth();
  const initials = profile?.nome ? profile.nome.charAt(0).toUpperCase() : "U";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [floatingAlert, setFloatingAlert] = useState<Notification | null>(null);
  const floatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase
        .from("notifications" as any)
        .select("*")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("notification_reads" as any).select("notification_id").eq("user_id", user.id),
    ]);
    setNotifications((notifs as any[]) || []);
    setReadIds(new Set(((reads as any[]) || []).map((r: any) => r.notification_id)));
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: novo alerta para este usuário (direcionado ou global)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notification;
          if (n.user_id && n.user_id !== user.id) return; // não é para mim
          setNotifications((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
          setFloatingAlert(n);
          if (floatingTimer.current) clearTimeout(floatingTimer.current);
          floatingTimer.current = setTimeout(() => setFloatingAlert(null), 9000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (floatingTimer.current) clearTimeout(floatingTimer.current);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markAsRead = async (notifId: number) => {
    if (!user || readIds.has(notifId)) return;
    await supabase.from("notification_reads" as any).insert({ notification_id: notifId, user_id: user.id } as any);
    setReadIds(prev => new Set(prev).add(notifId));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !readIds.has(n.id));
    if (unread.length === 0) return;
    const inserts = unread.map(n => ({ notification_id: n.id, user_id: user.id }));
    await supabase.from("notification_reads" as any).insert(inserts as any);
    setReadIds(prev => {
      const next = new Set(prev);
      unread.forEach(n => next.add(n.id));
      return next;
    });
  };

  const openFromFloating = () => {
    setFloatingAlert(null);
    setShowNotifications(true);
    fetchNotifications();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/50 px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="hidden sm:flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-gradient-primary">Método CHOA</span>
              </div>
            </div>
            <div className="flex items-center gap-3 relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) fetchNotifications(); }}
                className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <UserMenu initials={initials} />

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-sm sm:w-80 glass-card rounded-xl border border-border/50 shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border/30">
                      <h3 className="text-sm font-semibold">Notificações</h3>
                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-xs text-primary hover:underline mr-2">Marcar todas como lidas</button>
                        )}
                        <button onClick={() => setShowNotifications(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map(n => {
                          const isRead = readIds.has(n.id);
                          return (
                            <div
                              key={n.id}
                              onClick={() => markAsRead(n.id)}
                              className={`p-3 border-b border-border/20 cursor-pointer hover:bg-secondary/50 transition-colors ${!isRead ? "bg-primary/5" : ""}`}
                            >
                              <div className="flex items-start gap-2">
                                {!isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${!isRead ? "font-semibold" : "font-medium text-muted-foreground"}`}>{n.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                                  <p className="text-[10px] text-muted-foreground/50 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Alerta flutuante à esquerda — novo aviso recebido */}
        {floatingAlert && (
          <div className="fixed left-4 bottom-4 z-[60] w-[calc(100vw-2rem)] max-w-xs animate-in slide-in-from-left-4 fade-in duration-300">
            <div
              role="button"
              onClick={openFromFloating}
              className="glass-card cursor-pointer rounded-xl border border-primary/40 shadow-xl p-3 pr-8 relative"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setFloatingAlert(null); }}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{floatingAlert.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{floatingAlert.message}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
