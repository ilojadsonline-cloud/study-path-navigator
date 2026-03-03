import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Handle PKCE flow: exchange code from URL query params
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const errorParam = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (errorParam) {
      setError(true);
      toast({ title: "Erro no link", description: errorDescription || errorParam, variant: "destructive" });
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          console.error("Code exchange error:", exchangeError);
          setError(true);
          toast({ title: "Link expirado ou inválido", description: "Solicite um novo link de recuperação.", variant: "destructive" });
        } else {
          setSessionReady(true);
        }
      });
      return;
    }

    // Handle implicit/hash flow
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Check if session already exists (hash was auto-processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    // Timeout after 5s if nothing works
    const timeout = setTimeout(() => {
      if (!sessionReady) {
        setError(true);
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">Senha atualizada!</h1>
            <p className="text-sm text-muted-foreground">Redirecionando para o painel...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground">
              O link de recuperação pode ter expirado. Solicite um novo.
            </p>
          </div>
          <Link to="/esqueci-senha" className="inline-block px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity">
            Solicitar novo link
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando link de recuperação...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary glow-primary flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-black text-gradient-primary">CHOA 2026</h1>
          <p className="text-xs text-muted-foreground mt-1">Nova senha</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-bold">Definir nova senha</h2>
            <p className="text-xs text-muted-foreground mt-1">Escolha uma nova senha segura</p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nova senha (mín. 6 caracteres)"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirmar nova senha"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all"
              />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? "Atualizando..." : "Atualizar Senha"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
