import { motion } from "framer-motion";
import {
  Shield, ArrowRight, BookOpen, HelpCircle, Shuffle, Trophy,
  Star, Zap, CheckCircle2, Clock, BarChart3, Lock, Users, Target,
} from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  { icon: <BookOpen className="w-6 h-6" />, title: "Edital Verticalizado", desc: "Trilha de estudos completa baseada no edital CHOA/CHOM 2024 com 7 disciplinas e links diretos para legislação." },
  { icon: <HelpCircle className="w-6 h-6" />, title: "Banco de Questões", desc: "Centenas de questões no estilo PMTO com correção automática, comentários fundamentados e filtros por disciplina." },
  { icon: <Shuffle className="w-6 h-6" />, title: "Simulados Inteligentes", desc: "Gerador de simulados com randomização de questões e alternativas. Simule a prova real quantas vezes quiser." },
  { icon: <Trophy className="w-6 h-6" />, title: "Dashboard de Desempenho", desc: "Acompanhe aproveitamento geral, acertos por disciplina, horas de estudo e evolução ao longo do tempo." },
  { icon: <Zap className="w-6 h-6" />, title: "Legislação do Tocantins", desc: "Acesso rápido às leis 2.578, 2.575, LC 128, CPPM e RDMETO com links para lei seca e videoaulas." },
  { icon: <Lock className="w-6 h-6" />, title: "Anti-compartilhamento", desc: "Sistema seguro com controle de sessão, proteção de conteúdo e login por CPF exclusivo." },
];

const benefits = [
  "Acesso ilimitado a todas as disciplinas",
  "Questões com gabarito comentado",
  "Simulados ilimitados com randomização",
  "Dashboard completo de desempenho",
  "Cronômetro de estudo integrado",
  "Suporte via e-mail",
  "Atualizações constantes de conteúdo",
  "Acesso por 90 dias corridos",
];

const stats = [
  { icon: <HelpCircle className="w-5 h-5" />, value: "600+", label: "Questões" },
  { icon: <BookOpen className="w-5 h-5" />, value: "7", label: "Disciplinas" },
  { icon: <Users className="w-5 h-5" />, value: "100%", label: "Legislação TO" },
  { icon: <Target className="w-5 h-5" />, value: "90", label: "Dias de acesso" },
];

const Landing = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/3 right-10 w-[400px] h-[400px] bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between p-4 md:p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary glow-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-sm text-gradient-primary">Método CHOA 2026</span>
              <span className="block text-[10px] text-muted-foreground">Rumo ao Oficialato</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Página Inicial
            </Link>
            <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link to="/assinatura" className="hidden sm:inline-flex px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              Assinar Agora
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-16 md:pt-28 pb-20 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 text-gold text-xs font-semibold mb-6 glow-gold">
              <Star className="w-3.5 h-3.5" />
              Preparação exclusiva para PMTO 2026
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.1] mb-6">
              Sua aprovação no
              <br />
              <span className="text-gradient-primary">CHOA começa aqui</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-10 text-base md:text-lg leading-relaxed">
              Plataforma completa e exclusiva para preparação do Processo Seletivo Interno 
              da <strong className="text-foreground">Polícia Militar do Estado do Tocantins</strong>. 
              Questões, simulados e edital verticalizado 100% baseados na legislação tocantinense.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/assinatura"
                className="px-10 py-4 rounded-xl gradient-primary text-primary-foreground font-bold text-base flex items-center gap-2 hover:opacity-90 transition-opacity glow-primary"
              >
                Começar Agora
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/"
                className="px-10 py-4 rounded-xl border border-border/50 text-foreground font-medium text-base hover:bg-secondary transition-colors"
              >
                Conhecer a Plataforma
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Stats */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {stats.map((s, i) => (
              <div key={i} className="glass-card rounded-xl p-5 text-center">
                <div className="inline-flex p-2 rounded-lg bg-primary/10 text-primary mb-3">
                  {s.icon}
                </div>
                <p className="text-2xl md:text-3xl font-black text-gradient-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Como funciona */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Como funciona o <span className="text-gradient-primary">Método CHOA</span>?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
              Um sistema completo de preparação dividido em módulos estratégicos para maximizar sua performance.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            {[
              { step: "01", icon: <BookOpen className="w-7 h-7" />, title: "Estude pelo Edital", desc: "Siga a trilha verticalizada com todas as disciplinas organizadas por tópico. Acesse a lei seca e videoaulas em um clique." },
              { step: "02", icon: <HelpCircle className="w-7 h-7" />, title: "Pratique com Questões", desc: "Resolva questões no estilo da prova real. Receba correção imediata com comentários fundamentados na legislação." },
              { step: "03", icon: <BarChart3 className="w-7 h-7" />, title: "Acompanhe sua Evolução", desc: "Visualize estatísticas detalhadas no dashboard: taxa de acerto, horas de estudo e progresso por disciplina." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
              >
                <span className="absolute top-4 right-4 text-4xl font-black text-primary/10 group-hover:text-primary/20 transition-colors">
                  {item.step}
                </span>
                <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-4 group-hover:glow-primary transition-all">
                  {item.icon}
                </div>
                <h3 className="font-bold text-base mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Funcionalidades */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Tudo que você precisa, <span className="text-gradient-gold">em um só lugar</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
              Ferramentas criadas especificamente para o Processo Seletivo Interno da PMTO.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-3 group-hover:glow-primary transition-all">
                  {f.icon}
                </div>
                <h3 className="font-bold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Plano Único */}
        <section className="max-w-3xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Investimento <span className="text-gradient-gold">acessível</span>
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Um único plano com acesso completo. Sem pegadinhas, sem surpresas.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-2xl p-8 md:p-10 border-primary/20 glow-primary relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 text-gold text-xs font-semibold mb-4">
                <Star className="w-3 h-3" />
                Plano Único
              </div>
              <div className="mb-6">
                <span className="text-5xl md:text-6xl font-black text-gradient-gold">R$ 69,90</span>
                <span className="text-muted-foreground ml-2 text-base">/ 90 dias</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8 max-w-md">
                Acesso completo a toda a plataforma por 90 dias corridos. 
                Estude sem limites e garanta sua aprovação.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="text-sm text-foreground">{b}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/assinatura"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl gradient-gold text-gold-foreground font-bold text-base hover:opacity-90 transition-opacity glow-gold"
              >
                Assinar Agora
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </section>

        {/* CTA Final */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="glass-card rounded-2xl p-8 md:p-12 text-center border-primary/20"
          >
            <div className="inline-flex p-3 rounded-xl gradient-primary glow-primary mb-6">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              Pronto para garantir sua vaga?
            </h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto mb-8">
              Comece sua preparação hoje com o método mais completo para o CHOA 2026. 
              Junte-se aos policiais que escolheram se preparar de verdade.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/assinatura"
                className="px-10 py-4 rounded-xl gradient-primary text-primary-foreground font-bold text-base flex items-center gap-2 hover:opacity-90 transition-opacity glow-primary"
              >
                Começar Agora
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/"
                className="px-10 py-4 rounded-xl border border-border/50 text-foreground font-medium text-base hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Voltar à Página Inicial
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/30 py-8">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-gradient-primary">Método CHOA 2026</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">Página Inicial</Link>
              <Link to="/login" className="hover:text-foreground transition-colors">Entrar</Link>
              <Link to="/cadastro" className="hover:text-foreground transition-colors">Cadastro</Link>
              <a href="mailto:contato@metodochoa.com.br" className="hover:text-foreground transition-colors">Contato</a>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 Método CHOA – Todos os direitos reservados</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
