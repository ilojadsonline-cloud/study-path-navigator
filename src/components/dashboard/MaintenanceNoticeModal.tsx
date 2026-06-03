import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Wrench, AlertTriangle } from "lucide-react";

// Bump this key to re-show the notice after content changes
const NOTICE_KEY = "maintenance_notice_edital_choa_2026";

export function MaintenanceNoticeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const alreadyShown = localStorage.getItem(`${NOTICE_KEY}_${user.id}`);
    if (!alreadyShown) {
      setOpen(true);
    }
  }, [user]);

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`${NOTICE_KEY}_${user.id}`, "true");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-6 h-6 text-gold" />
            <DialogTitle className="text-lg">🔧 Aviso de Manutenção</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed space-y-3 text-left">
            <span className="block">
              Nos próximos dias, o sistema passará por uma{" "}
              <strong>manutenção</strong> para adequar a plataforma ao{" "}
              <strong>novo edital do CHOA</strong>, recentemente publicado.
            </span>
            <span className="block">
              Durante esse período, o site continuará funcionando normalmente, mas
              poderá apresentar <strong>instabilidades e erros pontuais</strong>.
            </span>
            <span className="flex items-start gap-2 rounded-lg bg-gold/10 border border-gold/30 p-3 text-foreground">
              <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <span>
                Agradecemos a sua compreensão enquanto deixamos tudo pronto para a
                nova fase da sua preparação. 💪
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button onClick={handleClose} className="w-full gradient-primary">
            Entendi, continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
