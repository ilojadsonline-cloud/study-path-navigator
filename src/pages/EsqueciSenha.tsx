import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isCPF, cleanCPF } from "@/lib/cpf";

const EsqueciSenha = () => {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      toast({ title: "Informe seu email ou CPF", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let email = identifier.trim();

      // If input looks like CPF, resolve to email
      if (isCPF(identifier)) {
        const cpf = cleanCPF(identifier);
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc("get_email_by_cpf", { p_cpf: cpf });
        if (rpcError || !resolvedEmail) {
          toast({ title: "CPF não encontrado", description: "Verifique o CPF informado.", variant: "destructive" });
          setLoading(false);
          return;
        }
        email = resolvedEmail;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({ title: "Erro ao enviar email", description: error.message, variant: "destructive" });
      } else {
        setSent(true);
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">Email enviado!</h1>
            <p className="text-sm text-muted-foreground">
              Verifique sua caixa de entrada (e spam) para o link de recuperação de senha.
            </p>
          </div>
          <Link to="/login" className="inline-block text-sm text-primary hover:underline">
            Voltar para o login
          </Link>
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
          <p className="text-xs text-muted-foreground mt-1">Recuperação de senha</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-bold">Esqueceu sua senha?</h2>
            <p className="text-xs text-muted-foreground mt-1">Informe seu email ou CPF e enviaremos um link de recuperação</p>
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Email ou CPF"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all"
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? "Enviando..." : "Enviar Link de Recuperação"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Lembrou sua senha?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default EsqueciSenha;
