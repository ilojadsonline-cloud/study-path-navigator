import { motion } from "framer-motion";
import { Shield, ArrowRight, BookOpen, HelpCircle, Shuffle, Trophy, Star, Zap, UserPlus, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-[400px] h-[400px] bg-gold/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        <nav className="flex items-center justify-between p-4 md:p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary glow-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-sm text-gradient-primary">CHOA 2026</span>
              <span className="block text-[10px] text-muted-foreground">Rumo ao Oficialato</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link to="/assinatura" className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              Começar Agora
            </Link>
          </div>
        </nav>

        <section className="max-w-4xl mx-auto px-4 pt-16 md:pt-24 pb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 text-gold text-xs font-semibold mb-6 glow-gold">
              <Star className="w-3.5 h-3.5" />
              Preparação exclusiva para PMTO
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4">
              <span className="text-gradient-primary">Método CHOA 2026</span>
              <br />
              <span className="text-foreground">Rumo ao Oficialato</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-sm md:text-base">
              Plataforma de questões e simulados para preparação do Processo Seletivo Interno da Polícia Militar do Estado do Tocantins.
              100% baseada na legislação do Tocantins.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/assinatura"
                className="px-8 py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity glow-primary"
              >
                Começar Agora
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 rounded-xl border border-border/50 text-foreground font-medium text-sm hover:bg-secondary transition-colors"
              >
                Já tenho conta
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Finalizar Cadastro + Contato */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <Link
              to="/cadastro"
              className="glass-card rounded-xl p-5 flex items-start gap-4 hover:border-primary/30 transition-all group"
            >
              <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:glow-primary transition-all">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm mb-1">Finalizar Cadastro</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Já efetuou o pagamento mas não conseguiu finalizar o cadastro? Clique aqui para completar seu registro.
                </p>
              </div>
            </Link>

            <Link
              to="/contato"
              className="glass-card rounded-xl p-5 flex items-start gap-4 hover:border-primary/30 transition-all group"
            >
              <div className="p-3 rounded-xl bg-gold/10 text-gold group-hover:glow-gold transition-all">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm mb-1">Fale com o Suporte</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Problemas com pagamento ou cadastro? Entre em contato com nossa equipe de suporte.
                </p>
              </div>
            </Link>
          </motion.div>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: <BookOpen className="w-6 h-6" />, title: "Edital Verticalizado", desc: "Trilha de estudos guiada baseada no edital CHOA/CHOM 2024 com todas as disciplinas." },
              { icon: <HelpCircle className="w-6 h-6" />, title: "Banco de Questões", desc: "Questões no estilo PMTO com correção automática e comentários fundamentados." },
              { icon: <Shuffle className="w-6 h-6" />, title: "Simulados Inteligentes", desc: "Gerador de simulados com randomização forte de questões e alternativas." },
              { icon: <Trophy className="w-6 h-6" />, title: "Dashboard Completo", desc: "Acompanhe seu progresso, taxa de acertos e evolução em tempo real." },
              { icon: <Zap className="w-6 h-6" />, title: "Base Legal do TO", desc: "Leis 2.578, 2.575, LC 128, CPPM e RDMETO – legislação exclusiva do Tocantins." },
              { icon: <Shield className="w-6 h-6" />, title: "Segurança", desc: "Anti-compartilhamento, controle de sessão e proteção de conteúdo." },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-3 group-hover:glow-primary transition-all">
                  {f.icon}
                </div>
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="glass-card rounded-2xl p-8 glow-primary border-primary/20"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold mb-3 animate-pulse">
              🔥 OFERTA POR TEMPO LIMITADO
            </div>
            <h2 className="text-2xl font-black mb-2">
              <span className="text-base font-normal text-muted-foreground line-through mr-2">R$ 99,90</span>
              <span className="text-gradient-gold">R$ 89,90</span>
              <span className="text-base font-normal text-muted-foreground ml-2">/ 90 dias</span>
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Acesso completo a toda a plataforma</p>
            <Link
              to="/assinatura"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl gradient-gold text-gold-foreground font-bold text-sm hover:opacity-90 transition-opacity glow-gold"
            >
              Assinar Agora
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </section>

        <footer className="border-t border-border/30 py-6 text-center">
          <p className="text-xs text-muted-foreground">© 2026 Método CHOA – Todos os direitos reservados</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
