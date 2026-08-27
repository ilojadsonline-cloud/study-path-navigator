import { motion } from "framer-motion";
import { Shield, ArrowRight, BookOpen, HelpCircle, Shuffle, Trophy, Star, Zap, UserPlus, MessageCircle, ExternalLink } from "lucide-react";
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
              <span className="font-bold text-sm text-gradient-primary">Método CHOA</span>
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
              Processo Seletivo Interno da PM e do Corpo de Bombeiros Militar do Estado do Tocantins
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4">
              <span className="text-gradient-primary">Método CHOA</span>
              <br />
              <span className="text-foreground">Rumo ao Oficialato</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-sm md:text-base">
              Plataforma de questões e simulados para preparação do Processo Seletivo Interno da Polícia Militar e do Corpo de Bombeiros Militar do Estado do Tocantins.
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

        {/* Finalizar Cadastro + Contato — destaque */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <Link
              to="/cadastro"
              className="glass-card rounded-xl p-6 flex items-start gap-4 border-2 border-primary/40 hover:border-primary/70 transition-all group relative overflow-hidden glow-primary"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-8 translate-x-8" />
              <div className="p-3 rounded-xl bg-primary/15 text-primary group-hover:scale-110 transition-transform">
                <UserPlus className="w-7 h-7" />
              </div>
              <div className="relative">
                <h3 className="font-bold text-base mb-1 text-foreground">Finalizar Cadastro</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Já efetuou o pagamento mas não conseguiu finalizar o cadastro? <span className="text-primary font-semibold">Clique aqui</span> para completar seu registro.
                </p>
              </div>
            </Link>

            <Link
              to="/contato-publico"
              className="glass-card rounded-xl p-6 flex items-start gap-4 border-2 border-gold/40 hover:border-gold/70 transition-all group relative overflow-hidden glow-gold"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gold/10 rounded-full -translate-y-8 translate-x-8" />
              <div className="p-3 rounded-xl bg-gold/15 text-gold group-hover:scale-110 transition-transform">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div className="relative">
                <h3 className="font-bold text-base mb-1 text-foreground">Fale com o Suporte</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Problemas com pagamento ou cadastro? <span className="text-gold font-semibold">Envie uma mensagem</span> para nossa equipe de suporte.
                </p>
              </div>
            </Link>
          </motion.div>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: <BookOpen className="w-6 h-6" />, title: "Edital Verticalizado", desc: "Trilha de estudos guiada baseada no edital CHOA/CHOM com todas as disciplinas." },
              { icon: <HelpCircle className="w-6 h-6" />, title: "Banco de Questões", desc: "Questões no estilo PMTO com correção automática e comentários fundamentados." },
              { icon: <Shuffle className="w-6 h-6" />, title: "Simulados Inteligentes", desc: "Gerador de simulados com randomização forte de questões e alternativas." },
              { icon: <Trophy className="w-6 h-6" />, title: "Meu Desempenho", desc: "Acompanhe seu progresso, taxa de acertos e evolução em tempo real." },
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

        {/* Como funciona */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-black text-center mb-2">Como começar</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Três passos simples para iniciar sua preparação.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { n: "1", title: "Crie sua conta", desc: "Cadastro gratuito com CPF e e-mail. Leva menos de 1 minuto." },
              { n: "2", title: "Escolha seu curso", desc: "CHOA PMTO ou CHOA CBMTO — conteúdo, questões e ranking separados." },
              { n: "3", title: "Escolha o pagamento", desc: "Cartão com renovação automática, Pix ou boleto pelo Mercado Pago." },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="glass-card rounded-xl p-5"
              >
                <div className="w-9 h-9 rounded-lg gradient-primary text-primary-foreground font-black flex items-center justify-center mb-3">
                  {s.n}
                </div>
                <h3 className="font-bold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Planos por curso */}
        <section id="planos" className="max-w-5xl mx-auto px-4 pb-20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
              PLANOS DISPONÍVEIS
            </div>
            <h2 className="text-2xl font-black">Escolha o seu curso</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cada curso tem seu próprio edital verticalizado, banco de questões, simulados e ranking.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-6 border-primary/30 glow-primary flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-md bg-primary/15 text-primary text-[11px] font-black">CHOA PMTO</span>
                <span className="text-[11px] text-muted-foreground">Polícia Militar do Tocantins</span>
              </div>
              <h3 className="text-xl font-black mb-1">
                <span className="text-gradient-primary">R$ 39,99</span>
                <span className="text-sm font-normal text-muted-foreground"> / mês</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                ou <strong className="text-foreground">R$ 449,99</strong> no plano anual (economize mais de 6%).
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground mb-6 flex-1">
                <li>• Edital verticalizado CHOA/2026 PMTO</li>
                <li>• Banco de questões (5 alternativas) com comentários</li>
                <li>• Simulados inteligentes e Simulado Semanal com ranking</li>
                <li>• BizuAulas, mapas mentais e cronograma de estudos</li>
              </ul>
              <Link
                to="/assinatura?curso=pmto"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Assinar CHOA PMTO
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="glass-card rounded-2xl p-6 border-destructive/30 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-[11px] font-black">CHOA CBMTO</span>
                <span className="text-[11px] text-muted-foreground">Corpo de Bombeiros Militar do TO</span>
              </div>
              <h3 className="text-xl font-black mb-1">
                <span className="text-gradient-gold">R$ 49,99</span>
                <span className="text-sm font-normal text-muted-foreground"> / mês</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                ou <strong className="text-foreground">R$ 549,99</strong> no plano anual. Acesso completo ao conteúdo exclusivo do certame do CBMTO.
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground mb-6 flex-1">
                <li>• Edital verticalizado CHOA/2026 CBMTO (14 disciplinas)</li>
                <li>• Questões no padrão do certame (4 alternativas A–D)</li>
                <li>• Simulados e Simulado Semanal com ranking próprio</li>
                <li>• Cronograma focado em lei seca + resolução de questões</li>
              </ul>
              <Link
                to="/assinatura?curso=cbmto"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Assinar CHOA CBMTO
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Prefere se cadastrar antes?{" "}
            <Link to="/cadastro" className="text-primary font-semibold hover:underline">
              Crie sua conta gratuita
            </Link>{" "}
            e escolha o curso depois do login.
          </p>
        </section>


        <footer className="border-t border-border/30 py-6 text-center">
          <p className="text-xs text-muted-foreground">© 2026 Método CHOA – Todos os direitos reservados</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
