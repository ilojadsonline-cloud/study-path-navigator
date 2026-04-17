import { useState, useEffect, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Shield, Bell, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: number;
  title: string;
  message: string;
  created_at: string;
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

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase.from("notifications" as any).select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("notification_reads" as any).select("notification_id").eq("user_id", user.id),
    ]);
    setNotifications((notifs as any[]) || []);
    setReadIds(new Set(((reads as any[]) || []).map((r: any) => r.notification_id)));
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
                <span className="text-sm font-semibold text-gradient-primary">Método CHOA 2026</span>
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
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                {initials}
              </div>

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
      </div>
    </SidebarProvider>
  );
}
