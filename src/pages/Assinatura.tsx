import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Check, Shield, Zap, Star, Clock, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const Assinatura = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
    }
    setLoading(false);
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
        </div>

        <div className="glass-card rounded-2xl p-8 relative overflow-hidden glow-gold border-gold/20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gold/5 rounded-full -translate-y-16 translate-x-16" />

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold/10 text-gold text-xs font-semibold mb-4">
              <Star className="w-3 h-3" /> PLANO ÚNICO
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <span className="text-5xl font-black text-gradient-gold">69</span>
              <span className="text-xl font-bold text-gradient-gold">,90</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Válido por 90 dias
            </p>
          </div>

          <div className="space-y-3 mb-8">
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

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-4 rounded-xl gradient-gold text-gold-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity glow-gold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {loading ? "Redirecionando..." : "Assinar Agora"}
          </button>

          <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Pagamento seguro</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Acesso imediato</span>
          </div>

          <div className="mt-6 pt-4 border-t border-border/30 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Mail className="w-3 h-3" /> Contato: <a href="mailto:contato@metodochoa.store" className="text-primary hover:underline">contato@metodochoa.store</a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Assinatura;
