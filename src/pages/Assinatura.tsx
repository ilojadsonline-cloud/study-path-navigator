import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Check, Shield, Star, Clock, Loader2, Mail, AlertTriangle, LogOut, Gift, QrCode, Barcode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Assinatura = () => {
  const [loadingCard, setLoadingCard] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);
  const [mpEmail, setMpEmail] = useState("");
  const [showMpEmail, setShowMpEmail] = useState(false);
  const [reactEmail, setReactEmail] = useState("");
  const [reactLoading, setReactLoading] = useState(false);
  const { toast } = useToast();
  const { user, subscribed, checkSubscription, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentStatus = searchParams.get("payment");
  const trialExpiredParam = searchParams.get("trial_expired") === "1";

  const handleReactivate = async () => {
    const email = reactEmail.trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      toast({ title: "Email inválido", description: "Informe o mesmo email usado no pagamento.", variant: "destructive" });
      return;
    }
    setReactLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reactivate-access", { body: { email } });
      if (error) throw error;
      if (data?.reactivated) {
        toast({ title: "Acesso reativado!", description: data.message || "Pagamento confirmado. Faça login normalmente." });
        navigate("/login", { replace: true });
      } else {
        toast({ title: "Pagamento não localizado", description: data?.message || "Não encontramos pagamento ativo neste email.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao reativar", description: err.message, variant: "destructive" });
    }
    setReactLoading(false);
  };

  useEffect(() => {
    if (paymentStatus === "success" && user) checkSubscription();
    if (paymentStatus === "canceled") {
      toast({ title: "Pagamento cancelado", description: "O pagamento não foi concluído.", variant: "destructive" });
    }
  }, [paymentStatus, user, checkSubscription, toast]);

  const isExpired = trialExpiredParam || (user && !subscribed);

  const ensureEmail = (): string | null => {
    const emailToUse = (user?.email || mpEmail).trim().toLowerCase();
    if (!emailToUse) {
      setShowMpEmail(true);
      toast({ title: "Informe seu email", description: "Digite o email para iniciar o pagamento.", variant: "destructive" });
      return null;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(emailToUse)) {
      toast({ title: "Email inválido", variant: "destructive" });
      return null;
    }
    return emailToUse;
  };

  const handleCheckoutCard = async () => {
    const email = ensureEmail();
    if (!email) return;
    setLoadingCard(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-checkout", { body: { email } });
      if (error) throw error;
      if (data?.error) { toast({ title: "Erro", description: data.error, variant: "destructive" }); return; }
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
    } finally { setLoadingCard(false); }
  };

  const handleCheckoutPix = async () => {
    const email = ensureEmail();
    if (!email) return;
    setLoadingPix(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-pix-boleto", {
        body: { email, userId: user?.id ?? null },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Erro", description: data.error, variant: "destructive" }); return; }
      if (data?.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
    } finally { setLoadingPix(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl animate-float" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-3xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl gradient-gold glow-gold flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-gold-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient-gold">Plano CHOA Trimestral — R$ 89,90</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acesso completo à plataforma por 90 dias</p>
          {isExpired && (
            <div className="mt-3 flex items-center justify-center gap-2 text-warning text-xs font-medium">
              <AlertTriangle className="w-4 h-4" /> Sua assinatura expirou. Renove para continuar acessando.
            </div>
          )}
        </div>

        {isExpired && (
          <div className="glass-card rounded-2xl p-5 mb-4 border-primary/30">
            <div className="flex items-start gap-3 mb-3">
              <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Já paguei — reativar acesso</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se você já assinou (Stripe ou Mercado Pago), informe o email do pagamento.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="email" placeholder="email@usado.no.pagamento" value={reactEmail}
                onChange={(e) => setReactEmail(e.target.value)} disabled={reactLoading}
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <button onClick={handleReactivate} disabled={reactLoading}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {reactLoading && <Loader2 className="w-4 h-4 animate-spin" />} Reativar acesso
              </button>
            </div>
          </div>
        )}

        {!user && (
          <div className="glass-card rounded-2xl p-4 mb-4">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Seu email para o pagamento</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="email" value={mpEmail} onChange={e => setMpEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Cartão de crédito recorrente */}
          <div className="glass-card rounded-2xl p-6 border-gold/20 glow-gold flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-gold-foreground" />
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                <Gift className="w-3 h-3" /> 1 DIA GRÁTIS
              </div>
            </div>
            <h2 className="text-lg font-bold mb-1">Cartão de Crédito</h2>
            <p className="text-xs text-muted-foreground mb-3">Renovação automática</p>
            <p className="text-sm text-foreground mb-4">
              Pague <strong>R$ 89,90 a cada 3 meses</strong>. Cancele quando quiser.
              Inclui <strong>1 dia de acesso gratuito</strong> para testar.
            </p>
            <ul className="space-y-2 text-xs text-foreground/80 mb-5">
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-success" /> Renovação sem dor de cabeça</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-success" /> Acesso imediato após confirmação</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-success" /> Cancelamento a qualquer momento</li>
            </ul>
            <button
              onClick={handleCheckoutCard}
              disabled={loadingCard || loadingPix}
              className="mt-auto w-full py-3.5 rounded-xl gradient-gold text-gold-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              {loadingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Assinar com Cartão
            </button>
          </div>

          {/* Pix / Boleto avulso */}
          <div className="glass-card rounded-2xl p-6 border-primary/20 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold">
                <Star className="w-3 h-3" /> SEM RECORRÊNCIA
              </div>
            </div>
            <h2 className="text-lg font-bold mb-1">Pix ou Boleto</h2>
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
              Pagamento único <Barcode className="w-3.5 h-3.5" />
            </p>
            <p className="text-sm text-foreground mb-4">
              Pague <strong>R$ 89,90 uma única vez</strong> e tenha acesso por
              <strong> 90 dias</strong>. Sem renovação automática.
            </p>
            <ul className="space-y-2 text-xs text-foreground/80 mb-5">
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-success" /> Pix com confirmação em minutos</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-success" /> Boleto bancário (até 3 dias úteis)</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-success" /> Você decide quando renovar</li>
            </ul>
            <button
              onClick={handleCheckoutPix}
              disabled={loadingCard || loadingPix}
              className="mt-auto w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              {loadingPix ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              Pagar com Pix ou Boleto
            </button>
          </div>
        </div>

        <div className="text-center mt-6 space-y-2">
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Pagamento seguro</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Acesso imediato</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <Mail className="inline w-3 h-3 mr-1" />
            Contato: <a href="mailto:contato@metodochoa.com.br" className="text-primary hover:underline">contato@metodochoa.com.br</a>
          </p>
          {user && (
            <button onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}
              className="flex items-center justify-center gap-2 mx-auto text-sm text-destructive hover:underline font-medium">
              <LogOut className="w-4 h-4" /> Sair da conta
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            {user ? (
              <Link to="/login" className="text-primary font-medium hover:underline">Entrar com outro usuário</Link>
            ) : (
              <>Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link></>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Assinatura;
