import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CreditCard, CalendarDays, Loader2, RefreshCw, ShieldAlert, CheckCircle2, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SubDetails {
  status: "active_recurring" | "active_oneoff" | "trial" | "blocked" | "none";
  provider: "mercadopago" | "mercadopago_avulso" | "stripe" | null;
  paymentMethod: string | null;
  planName: string;
  planPrice: string;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  preapprovalId: string | null;
  stripeSubscriptionId: string | null;
  canCancel: boolean;
  cancelledAt: string | null;
  isBlocked: boolean;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const daysLeft = (iso: string | null) => {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
};

export const SubscriptionSection = () => {
  const { checkSubscription } = useAuth();
  const navigate = useNavigate();
  const [details, setDetails] = useState<SubDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("subscription-details");
      if (error) throw error;
      setDetails(data as SubDetails);
    } catch (err: any) {
      console.error("[SubscriptionSection] load error", err);
      toast.error("Não foi possível carregar dados da assinatura");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao cancelar");
      toast.success(data.message || "Assinatura cancelada");
      setConfirmOpen(false);
      await load();
      await checkSubscription();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar assinatura");
    } finally {
      setCancelling(false);
    }
  };

  const renderBadge = () => {
    if (!details) return null;
    const cancelled = !!details.cancelledAt;

    if (details.isBlocked || details.status === "blocked") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-semibold border border-destructive/30">
          <Ban className="w-3.5 h-3.5" /> Acesso Bloqueado — Renove para continuar
        </span>
      );
    }
    if (details.status === "trial") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-500 text-xs font-semibold border border-yellow-500/30">
          <Clock className="w-3.5 h-3.5" /> Período de Teste — Expira em {fmt(details.endDate)}
        </span>
      );
    }
    if (details.status === "active_recurring") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/15 text-success text-xs font-semibold border border-success/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {cancelled
            ? `Cancelada — Acesso até ${fmt(details.endDate)}`
            : `Assinatura Ativa — Renovação em ${fmt(details.nextBillingDate)}`}
        </span>
      );
    }
    if (details.status === "active_oneoff") {
      const d = daysLeft(details.endDate);
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-semibold border border-blue-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Acesso Ativo — Expira em {fmt(details.endDate)} ({d} dias restantes)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold border border-border">
        <ShieldAlert className="w-3.5 h-3.5" /> Sem assinatura ativa
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-foreground">Minha Assinatura</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && !details ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : details ? (
        <>
          <div>{renderBadge()}</div>

          <div className="p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-2 text-sm">
            <Row label="Plano" value={details.planName} />
            <Row label="Valor" value={details.planPrice} />
            {details.paymentMethod && <Row label="Método" value={details.paymentMethod} />}
            {details.startDate && (
              <Row label="Início do acesso" value={fmt(details.startDate)} />
            )}
            {details.endDate && (
              <Row
                label={
                  details.status === "active_recurring" && !details.cancelledAt
                    ? "Próxima cobrança"
                    : "Acesso até"
                }
                value={fmt(details.endDate)}
                icon={<CalendarDays className="w-3.5 h-3.5" />}
              />
            )}
          </div>

          {/* Cancelled state */}
          {details.cancelledAt && details.status === "active_recurring" && (
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50 text-sm space-y-3">
              <p className="text-muted-foreground">
                Sua assinatura foi cancelada. Você continuará tendo acesso até{" "}
                <strong className="text-foreground">{fmt(details.endDate)}</strong>.
                Após essa data, seu acesso será bloqueado. Você pode reativar a
                qualquer momento fazendo um novo pagamento.
              </p>
              <Button size="sm" onClick={() => navigate("/assinatura")}>
                Reativar Assinatura
              </Button>
            </div>
          )}

          {/* Avulso info */}
          {details.status === "active_oneoff" && (
            <p className="text-xs text-muted-foreground">
              Você pagou via Pix/Boleto. Não há renovação automática — seu
              acesso expira em <strong>{fmt(details.endDate)}</strong>. Para
              continuar após essa data, basta realizar um novo pagamento.
            </p>
          )}

          {/* Cancel button (only for active recurring not yet cancelled) */}
          {details.canCancel && details.status === "active_recurring" && !details.cancelledAt && (
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => setConfirmOpen(true)}
            >
              Cancelar Assinatura
            </Button>
          )}

          {/* Renew CTA when blocked or none */}
          {(details.isBlocked ||
            details.status === "blocked" ||
            details.status === "none") && (
            <Button size="sm" onClick={() => navigate("/assinatura")}>
              Renovar Assinatura
            </Button>
          )}
        </>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao cancelar, você continuará tendo acesso até o final do período já
              pago{details?.endDate ? ` (${fmt(details.endDate)})` : ""}. Após
              essa data, seu acesso será bloqueado e você não será mais cobrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Manter minha assinatura
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={cancelling}
              className="bg-muted text-muted-foreground hover:bg-muted/80"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

const Row = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-muted-foreground flex items-center gap-1">
      {icon}
      {label}
    </span>
    <span className="font-medium text-foreground text-right">{value}</span>
  </div>
);
