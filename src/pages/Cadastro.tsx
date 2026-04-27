import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Eye, EyeOff, User, CreditCard, ArrowRight, Loader2, AlertTriangle, Mail, Search, Phone } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, cleanCPF, validateCPF } from "@/lib/cpf";
import { useToast } from "@/hooks/use-toast";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";

const Cadastro = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termos, setTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveringPayment, setRecoveringPayment] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [stripeEmail, setStripeEmail] = useState("");
  const sessionId = searchParams.get("session_id");
  // Mercado Pago Preference retorna: payment_id, collection_id, status, preference_id
  const mpPaymentId = searchParams.get("payment_id") || searchParams.get("collection_id");
  const mpStatus = searchParams.get("mp_status") || searchParams.get("status") || searchParams.get("collection_status");

  useEffect(() => {
    const verifyPayment = async () => {
      // Mercado Pago — usuário voltou do checkout MP (Preference: Pix/Cartão/Boleto)
      if (mpPaymentId || mpStatus === "success" || mpStatus === "approved") {
        try {
          if (mpPaymentId) {
            const { data, error } = await supabase.functions.invoke("verify-mp-payment", {
              body: { payment_id: mpPaymentId, status: mpStatus },
            });
            if (error) throw error;
            if (data?.paid) {
              setPaymentVerified(true);
              if (data.customer_email) {
                setStripeEmail(data.customer_email);
                setEmail(data.customer_email);
              }
            }
          }
        } catch (err) {
          console.error("Erro ao verificar pagamento MP:", err);
        }
        setVerifyingPayment(false);
        return;
      }

      // Stripe
      if (!sessionId) {
        setVerifyingPayment(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { session_id: sessionId },
        });

        if (error) throw error;
        if (data?.paid) {
          setPaymentVerified(true);
          if (data.customer_email) {
            setStripeEmail(data.customer_email);
            setEmail(data.customer_email);
          }
        }
      } catch (err) {
        console.error("Erro ao verificar pagamento:", err);
      }
      setVerifyingPayment(false);
    };

    verifyPayment();
  }, [sessionId, mpPaymentId, mpStatus]);

  const handleRecoverPayment = async () => {
    if (!recoveryEmail.trim()) {
      toast({ title: "Informe o email", description: "Digite o email usado no pagamento.", variant: "destructive" });
      return;
    }
    setRecoveringPayment(true);
    try {
      let found = false;
      // Tenta Stripe primeiro
      const { data: stripeData } = await supabase.functions.invoke("verify-payment", {
        body: { recovery_email: recoveryEmail.trim() },
      });
      if (stripeData?.paid) {
        setPaymentVerified(true);
        setStripeEmail(stripeData.customer_email || recoveryEmail.trim());
        setEmail(stripeData.customer_email || recoveryEmail.trim());
        toast({ title: "Pagamento encontrado!", description: "Pagamento Stripe localizado. Complete seu cadastro." });
        found = true;
      }
      // Se não encontrou no Stripe, tenta Mercado Pago
      if (!found) {
        const { data: mpData } = await supabase.functions.invoke("verify-mp-payment", {
          body: { recovery_email: recoveryEmail.trim() },
        });
        if (mpData?.paid) {
          setPaymentVerified(true);
          setStripeEmail(mpData.customer_email || recoveryEmail.trim());
          setEmail(mpData.customer_email || recoveryEmail.trim());
          toast({ title: "Pagamento encontrado!", description: "Pagamento Mercado Pago localizado. Complete seu cadastro." });
          found = true;
        }
      }
      if (!found) {
        toast({ title: "Pagamento não encontrado", description: "Nenhuma assinatura ativa para este email em Stripe ou Mercado Pago.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar pagamento", description: err.message, variant: "destructive" });
    }
    setRecoveringPayment(false);
  };

  const handleCpfChange = (value: string) => {
    setCpf(formatCPF(value));
  };

  const formatTelefone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentVerified) {
      toast({ title: "Pagamento não verificado", description: "Efetue o pagamento antes de criar sua conta.", variant: "destructive" });
      return;
    }

    if (!nome || !email || !cpf || !telefone || !password || !confirmPassword) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const telefoneDigits = telefone.replace(/\D/g, "");
    if (telefoneDigits.length < 10 || telefoneDigits.length > 11) {
      toast({ title: "WhatsApp inválido", description: "Informe DDD + número (10 ou 11 dígitos).", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Email inválido", description: "Verifique o email informado.", variant: "destructive" });
      return;
    }
    if (!validateCPF(cpf)) {
      toast({ title: "CPF inválido", description: "Verifique o CPF informado.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    if (!termos) {
      toast({ title: "Aceite os termos de uso", variant: "destructive" });
      return;
    }

    setLoading(true);
    const cleanedCpf = cleanCPF(cpf);

    const { data: cpfExists } = await supabase.rpc("check_cpf_exists", { p_cpf: cleanedCpf });
    if (cpfExists) {
      toast({ title: "CPF já cadastrado", description: "Este CPF já possui uma conta.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl("/") },
    });

    if (authError) {
      toast({ title: "Erro no cadastro", description: authError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Store Stripe email in profile if different from registration email,
      // so check-subscription can find the Stripe customer
      const profileEmail = stripeEmail && stripeEmail.toLowerCase() !== email.toLowerCase()
        ? stripeEmail
        : email;
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: authData.user.id,
        nome,
        cpf: cleanedCpf,
        email: profileEmail,
      });

      if (!profileError) {
        await supabase.from("trial_usage").update({
          cpf: cleanedCpf,
          user_id: authData.user.id,
        } as never).eq("email", profileEmail.toLowerCase());
      }

      if (profileError) {
        toast({ title: "Erro ao criar perfil", description: profileError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      toast({ title: "Conta criada com sucesso!", description: "Você já pode acessar a plataforma." });
      navigate("/dashboard");
    }

    setLoading(false);
  };

  if (verifyingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando pagamento...</p>
        </motion.div>
      </div>
    );
  }

  if (!paymentVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">Pagamento Necessário</h1>
            <p className="text-sm text-muted-foreground">
              Para criar sua conta, é necessário efetuar o pagamento da assinatura primeiro.
            </p>
          </div>

          {/* Recovery section for users who paid but lost session_id */}
          <div className="glass-card rounded-xl p-4 text-left space-y-3">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-primary" />
              Já pagou e fechou a página? Recupere aqui:
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={e => setRecoveryEmail(e.target.value)}
                  placeholder="Email usado no pagamento"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={handleRecoverPayment}
                disabled={recoveringPayment}
                className="px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
              >
                {recoveringPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/assinatura"
              className="w-full py-3 rounded-xl gradient-gold text-gold-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity glow-gold"
            >
              <CreditCard className="w-4 h-4" />
              Ir para Assinatura
            </Link>
            <Link
              to="/login"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Já tem conta? Entrar
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl gradient-primary glow-primary flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-black text-gradient-primary">CHOA 2026</h1>
          <p className="text-xs text-muted-foreground">Pagamento confirmado! Crie sua conta abaixo.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/20 mb-2">
            <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs font-medium text-success">Pagamento verificado com sucesso</span>
          </div>

          <h2 className="text-lg font-bold text-center">Cadastro</h2>

          <div className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all" />
            </div>
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={e => !stripeEmail && setEmail(e.target.value)} readOnly={!!stripeEmail} placeholder="Email"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all ${stripeEmail ? 'opacity-70 cursor-not-allowed' : ''}`} />
              </div>
              {stripeEmail && (
                <p className="text-[10px] text-muted-foreground mt-1 ml-1">Email vinculado ao pagamento (não pode ser alterado)</p>
              )}
            </div>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={cpf} onChange={e => handleCpfChange(e.target.value)} placeholder="CPF" maxLength={14}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all" />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmar senha"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all" />
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)} className="rounded border-border mt-0.5" />
            <span>Aceito os <a href="#" className="text-primary hover:underline">Termos de Uso</a> e <a href="#" className="text-primary hover:underline">Política de Privacidade</a></span>
          </label>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? "Criando conta..." : "Criar Conta"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Cadastro;
