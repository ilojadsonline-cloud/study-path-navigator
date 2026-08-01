import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield, ArrowRight, Lock, CheckCircle2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurso, type Curso } from "@/contexts/CursoContext";
import { cn } from "@/lib/utils";

const EscolherCurso = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading, subscriptionLoading, signOut } = useAuth();
  const { todosCursos, loading, temAcesso, setCursoSlug } = useCurso();

  useEffect(() => {
    if (!authLoading && !session) navigate("/login", { replace: true });
  }, [authLoading, session, navigate]);

  const handleSelect = (curso: Curso) => {
    setCursoSlug(curso.slug);
    if (temAcesso(curso)) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate(`/assinatura?curso=${curso.slug}`, { replace: true });
    }
  };

  if (authLoading || subscriptionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl animate-float" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-3xl"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-gold glow-gold flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-gold-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient-gold">Escolha seu curso</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione a preparação que você vai estudar agora. Você pode trocar de curso a qualquer momento.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {todosCursos.map((curso, i) => {
            const liberado = temAcesso(curso);
            const isCbmto = curso.slug === "cbmto";
            const badgeClasses = isCbmto
              ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/40"
              : curso.cor === "gold"
              ? "bg-gold text-gold-foreground"
              : "bg-primary text-primary-foreground";

            return (
              <motion.button
                key={curso.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => handleSelect(curso)}
                className="rounded-2xl p-6 text-left transition-all group glass-card hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm", badgeClasses)}>
                    {curso.sigla}
                  </div>
                  {liberado ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Liberado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Lock className="w-3.5 h-3.5" /> Assinar
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-foreground">{curso.nome}</h2>
                <p className="text-xs mt-1 text-muted-foreground">
                  {liberado
                    ? "Sua assinatura está ativa. Entrar na plataforma."
                    : "Você ainda não tem assinatura ativa para este curso."}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold group-hover:gap-2.5 transition-all text-primary">
                  {liberado ? "Acessar curso" : "Ver planos"} <ArrowRight className="w-4 h-4" />
                </span>
              </motion.button>

            );
          })}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair da conta
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EscolherCurso;
