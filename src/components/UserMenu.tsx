import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Settings, Flag, CreditCard, LogOut, CheckCircle, AlertTriangle, Clock, ChevronDown, Loader2, LifeBuoy, Ban } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserMenuProps {
  initials: string;
}

export function UserMenu({ initials }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const { profile, signOut, subscribed, subscriptionEnd, isTrial, trialEndsAt, trialExpired } = useAuth();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    navigate("/login");
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return "—"; }
  };

  // Status da assinatura
  let statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
  let statusLabel = "Sem assinatura ativa";
  let statusColor = "text-destructive";
  let statusBg = "bg-destructive/10 border-destructive/20";
  let endLabel: string | null = null;

  if (isTrial && !trialExpired) {
    statusIcon = <Clock className="w-3.5 h-3.5 text-warning" />;
    statusLabel = "Período de teste";
    statusColor = "text-warning";
    statusBg = "bg-warning/10 border-warning/20";
    endLabel = `Trial até ${formatDate(trialEndsAt)}`;
  } else if (subscribed) {
    statusIcon = <CheckCircle className="w-3.5 h-3.5 text-success" />;
    statusLabel = "Assinatura ativa";
    statusColor = "text-success";
    statusBg = "bg-success/10 border-success/20";
    endLabel = subscriptionEnd ? `Vigente até ${formatDate(subscriptionEnd)}` : null;
  } else if (trialExpired) {
    statusLabel = "Período de teste expirado";
    endLabel = "Renove para continuar";
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir menu do usuário"
        className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-xs sm:w-72 glass-card rounded-xl border border-border/50 shadow-xl z-50 overflow-hidden">
            {/* Header — perfil */}
            <div className="p-4 border-b border-border/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{profile?.nome || "Usuário"}</p>
                {profile?.cpf && (
                  <p className="text-[10px] text-muted-foreground">
                    CPF: {profile.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")}
                  </p>
                )}
              </div>
            </div>

            {/* Status assinatura */}
            <div className={`mx-3 mt-3 p-3 rounded-lg border ${statusBg}`}>
              <div className="flex items-center gap-2">
                {statusIcon}
                <p className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</p>
              </div>
              {endLabel && (
                <p className="text-[10px] text-muted-foreground mt-1 ml-5">{endLabel}</p>
              )}
            </div>

            {/* Ações */}
            <div className="p-2 mt-1">
              <Link
                to="/configuracoes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span>Configurações</span>
              </Link>
              <Link
                to="/meus-reportes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
              >
                <Flag className="w-4 h-4 text-muted-foreground" />
                <span>Meus Reportes</span>
              </Link>
              <Link
                to="/assinatura"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
              >
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span>Minha Assinatura</span>
              </Link>
            </div>

            <div className="border-t border-border/30 p-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
