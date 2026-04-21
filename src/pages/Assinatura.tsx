import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Check, Shield, Zap, Star, Clock, Loader2, Mail, AlertTriangle, LogOut, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type Provider = "stripe" | "mercadopago";

const Assinatura = () => {
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialEmail, setTrialEmail] = useState("");
  const [showTrialEmail, setShowTrialEmail] = useState(false);
  const [provider, setProvider] = useState<Provider>("stripe");
  const [mpEmail, setMpEmail] = useState("");
  const [showMpEmail, setShowMpEmail] = useState(false);
  const { toast } = useToast();
  const { user, subscribed, subscriptionEnd, checkSubscription, signOut, isTrial, trialEndsAt } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    if (paymentStatus === "success" && user) {
      checkSubscription();
    }
    if (paymentStatus === "canceled") {
      toast({ title: "Pagamento cancelado", description: "O pagamento não foi concluído. Você pode tentar novamente quando quiser.", variant: "destructive" });
    }
  }, [paymentStatus, user, checkSubscription, toast]);

  const isExpired = user && !subscribed;

  const handleCheckout = async () => {
    setLoading(true);
    try {
      if (provider === "stripe") {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { trial: false },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } else {
        // Mercado Pago precisa do email
        const emailToUse = user?.email || mpEmail.trim();
        if (!emailToUse) {
          setShowMpEmail(true);
          toast({ title: "Informe seu email", description: "Digite o email para continuar com Mercado Pago.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailToUse)) {
          toast({ title: "Email inválido", description: "Verifique o email informado.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("create-mp-checkout", {
          body: { trial: false, email: emailToUse },
        });
        if (error) throw error;
        if (data?.error) {
          toast({ title: "Erro", description: data.error, variant: "destructive" });
          setLoading(false);
          return;
        }
        if (data?.url) {
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleTrialCheckout = async () => {
    // Trial é exclusivo do Stripe
    const emailToUse = user?.email || trialEmail.trim();
    if (!emailToUse) {
      setShowTrialEmail(true);
      toast({ title: "Informe seu email", description: "Digite o email para iniciar o teste grátis.", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      toast({ title: "Email inválido", description: "Verifique o email informado.", variant: "destructive" });
      return;
    }
    setTrialLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { trial: true, email: emailToUse },
      });
      if (error) throw error;
      if (data?.trial_used) {
        toast({ title: "Teste já utilizado", description: data.error || "Este email já usou o teste grátis.", variant: "destructive" });
        setTrialLoading(false);
        return;
      }
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        setTrialLoading(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar teste grátis", description: err.message, variant: "destructive" });
    }
    setTrialLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl gradient-gold glow-gold flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-gold-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient-gold">Plano CHOA Trimestral</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acesso completo à plataforma por 90 dias</p>
          {isExpired && (
            <div className="mt-3 flex items-center justify-center gap-2 text-warning text-xs font-medium">
              <AlertTriangle className="w-4 h-4" />
              Sua assinatura expirou. Renove para continuar acessando.
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-8 relative overflow-hidden glow-gold border-gold/20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gold/5 rounded-full -translate-y-16 translate-x-16" />

          <div className="text-center mb-6">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold/10 text-gold text-xs font-semibold">
                <Star className="w-3 h-3" /> PLANO ÚNICO
              </div>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold animate-pulse">
                🔥 OFERTA POR TEMPO LIMITADO
              </div>
            </div>
            <div className="text-base text-muted-foreground line-through mb-1">R$ 99,90</div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <span className="text-5xl font-black text-gradient-gold">89</span>
              <span className="text-xl font-bold text-gradient-gold">,90</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Válido por 90 dias
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {[
              "Acesso completo ao banco de questões",
              "Gerador de simulados",
              "Edital verticalizado com trilha guiada",
              "Baseado 100% na legislação do Tocantins",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-success" />
                </div>
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>

          {/* Provider selector */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 text-center">Escolha o método de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider("stripe")}
                className={`py-3 px-3 rounded-xl border text-sm font-semibold transition-all text-left ${
                  provider === "stripe"
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border/50 bg-secondary text-muted-foreground hover:border-border"
                }`}
              >
                <div className="flex items-center gap-1.5">💳 Stripe</div>
                <span className="block text-[10px] font-normal opacity-80 mt-0.5">Cartão de crédito internacional</span>
                <span className="block text-[10px] font-medium text-success mt-1">✓ Teste sem cartão</span>
              </button>
              <button
                type="button"
                onClick={() => setProvider("mercadopago")}
                className={`py-3 px-3 rounded-xl border text-sm font-semibold transition-all text-left ${
                  provider === "mercadopago"
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border/50 bg-secondary text-muted-foreground hover:border-border"
                }`}
              >
                <div className="flex items-center gap-1.5">🇧🇷 Mercado Pago</div>
                <span className="block text-[10px] font-normal opacity-80 mt-0.5">Cartão, PIX ou Boleto</span>
                <span className="block text-[10px] font-medium text-warning mt-1">⚠ Teste exige cartão</span>
              </button>
            </div>
          </div>

          {/* Aviso contextual do provedor */}
          {provider === "stripe" && (
            <div className="mb-3 p-2.5 rounded-lg bg-success/5 border border-success/20 text-[11px] text-foreground/80 leading-relaxed">
              <strong className="text-success">Stripe:</strong> aceita apenas <strong>cartão de crédito</strong> por enquanto (PIX em breve). 
              Inclui <strong>teste grátis de 1 dia sem precisar de cartão</strong>.
            </div>
          )}
          {provider === "mercadopago" && (
            <div className="mb-3 p-2.5 rounded-lg bg-warning/5 border border-warning/20 text-[11px] text-foreground/80 leading-relaxed">
              <strong className="text-warning">Mercado Pago:</strong> aceita cartão, PIX e boleto. 
              <strong> Não há teste grátis aqui</strong> — o pagamento da assinatura trimestral (R$ 89,90) é cobrado imediatamente. 
              Se quer testar antes de pagar, use o <strong>Stripe</strong>.
            </div>
          )}

          {/* Email input para Mercado Pago (quando não logado) */}
          {provider === "mercadopago" && !user && (showMpEmail || mpEmail) && (
            <div className="relative mb-3">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={mpEmail}
                onChange={e => setMpEmail(e.target.value)}
                placeholder="Seu email para o pagamento"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              />
            </div>
          )}

          <button
            onClick={() => {
              if (provider === "mercadopago" && !user && !mpEmail && !showMpEmail) {
                setShowMpEmail(true);
                return;
              }
              handleCheckout();
            }}
            disabled={loading}
            className="w-full py-4 rounded-xl gradient-gold text-gold-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity glow-gold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {loading ? "Redirecionando..." : `Assinar R$ 89,90 via ${provider === "stripe" ? "Stripe" : "Mercado Pago"}`}
          </button>

          {/* Trial Section */}
          <div className="mt-3 space-y-2">
            {!user && (showTrialEmail || trialEmail) && (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={trialEmail}
                  onChange={e => setTrialEmail(e.target.value)}
                  placeholder="Seu email para o teste grátis"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
            )}
            <button
              onClick={() => {
                if (!user && !trialEmail && !showTrialEmail) {
                  setShowTrialEmail(true);
                  return;
                }
                handleTrialCheckout();
              }}
              disabled={trialLoading}
              className="w-full py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {trialLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              {trialLoading ? "Verificando..." : `Testar Grátis por 1 Dia (${provider === "stripe" ? "Stripe" : "Mercado Pago"})`}
            </button>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              {provider === "stripe"
                ? "✓ Sem cartão de crédito • Cancela automaticamente após 24h"
                : "⚠ Exige cartão de crédito (não é cobrado) • Cancela em 24h"}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Pagamento seguro</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Acesso imediato</span>
          </div>

          <div className="mt-6 pt-4 border-t border-border/30 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Mail className="w-3 h-3" /> Contato: <a href="mailto:contato@metodochoa.com.br" className="text-primary hover:underline">contato@metodochoa.com.br</a>
            </p>
          </div>
        </div>

        <div className="text-center mt-4 space-y-2">
          {user && (
            <button
              onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}
              className="flex items-center justify-center gap-2 mx-auto text-sm text-destructive hover:underline font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            {user ? (
              <Link to="/login" className="text-primary font-medium hover:underline">Entrar com outro usuário</Link>
            ) : (
              <>
                Já tem conta?{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Assinatura;
