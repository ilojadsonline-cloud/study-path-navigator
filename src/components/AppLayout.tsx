import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Shield, Bell, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { profile } = useAuth();
  const initials = profile?.nome ? profile.nome.charAt(0).toUpperCase() : "U";

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
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                {initials}
              </div>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 top-12 w-80 glass-card rounded-xl border border-border/50 shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border/30">
                      <h3 className="text-sm font-semibold">Notificações</h3>
                      <button onClick={() => setShowNotifications(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-6 text-center">
                      <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                      <p className="text-xs text-muted-foreground mt-1">Você será notificado sobre novidades e atualizações.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
