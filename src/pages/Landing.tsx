import { motion } from "framer-motion";
import {
  Shield, ArrowRight, BookOpen, HelpCircle, Shuffle, Trophy,
  Star, Zap, CheckCircle2, Clock, BarChart3, Lock, Users, Target,
  ChevronRight, Eye, Gift, Lightbulb, TrendingUp, Brain, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import mockupDashboard from "@/assets/mockup-dashboard.jpg";
import mockupQuestoes from "@/assets/mockup-questoes.jpg";
import mockupEdital from "@/assets/mockup-edital.jpg";

const features = [
  { icon: <BookOpen className="w-6 h-6" />, title: "Edital Verticalizado", desc: "Trilha de estudos completa baseada no edital CHOA/CHOM 2024 com 7 disciplinas e links diretos para legislação." },
  { icon: <HelpCircle className="w-6 h-6" />, title: "+1.000 Questões", desc: "Mais de mil questões no estilo PMTO com correção automática, comentários fundamentados na lei seca e filtros por disciplina." },
  { icon: <Shuffle className="w-6 h-6" />, title: "Simulados Inteligentes", desc: "Gerador de simulados com randomização de questões e alternativas. Simule a prova real quantas vezes quiser." },
  { icon: <Trophy className="w-6 h-6" />, title: "Ranking Top 10", desc: "Acompanhe sua posição entre os melhores guerreiros. Medalhas para os 3 primeiros e atualização em tempo real." },
  { icon: <Zap className="w-6 h-6" />, title: "Legislação do Tocantins", desc: "Acesso rápido às leis 2.578, 2.575, LC 128, CPPM e RDMETO com links para lei seca e videoaulas." },
  { icon: <Lock className="w-6 h-6" />, title: "Anti-compartilhamento", desc: "Sistema seguro com controle de sessão, proteção de conteúdo e login por CPF exclusivo." },
];

const benefits = [
  "Acesso ilimitado a todas as disciplinas",
  "+1.000 questões com gabarito comentado",
  "Simulados ilimitados com randomização",
  "Ranking Top 10 Guerreiros 🏆",
  "Dashboard completo de desempenho",
  "Cronômetro de estudo integrado",
  "Suporte via e-mail",
  "Acesso por 90 dias corridos",
];

const stats = [
  { icon: <HelpCircle className="w-5 h-5" />, value: "1.000+", label: "Questões" },
  { icon: <BookOpen className="w-5 h-5" />, value: "7", label: "Disciplinas" },
  { icon: <Trophy className="w-5 h-5" />, value: "Top 10", label: "Ranking" },
  { icon: <Target className="w-5 h-5" />, value: "90", label: "Dias de acesso" },
];

// Questões reais verificadas com base na legislação vigente
const exampleQuestions = [
  {
    disciplina: "RDMETO (Decreto 4.994/14)",
    enunciado: "De acordo com o RDMETO (Decreto nº 4.994/2014), como são classificadas as transgressões disciplinares quanto à sua natureza?",
    alternativas: [
      "Simples, compostas e qualificadas.",
      "Leves, médias e graves.",
      "Administrativas, penais e civis.",
      "De primeira, segunda e terceira classe.",
      "Ordinárias, especiais e extraordinárias.",
    ],
    gabarito: 1,
    comentario: "Conforme o Art. 18 do RDMETO (Decreto 4.994/2014), as transgressões disciplinares são classificadas em leves, médias e graves, de acordo com a sua natureza e a repercussão do ato praticado.",
  },
  {
    disciplina: "Estatuto dos Militares (Lei 2.578/12)",
    enunciado: "Nos termos da Lei nº 2.578/2012, assinale a alternativa que apresenta corretamente uma das formas de ingresso na Polícia Militar do Estado do Tocantins:",
    alternativas: [
      "Transferência de outras forças estaduais mediante aprovação do Comandante-Geral.",
      "Nomeação direta pelo Governador do Estado para qualquer posto ou graduação.",
      "Matrícula em curso de formação, após aprovação em concurso público de provas ou de provas e títulos.",
      "Indicação de oficial superior com mais de 20 anos de serviço.",
      "Convocação compulsória de reservistas das Forças Armadas.",
    ],
    gabarito: 2,
    comentario: "Conforme o Art. 11 da Lei 2.578/2012, o ingresso na Polícia Militar será voluntário e dar-se-á mediante matrícula em curso de formação, após aprovação em concurso público de provas ou de provas e títulos.",
  },
  {
    disciplina: "CPPM (Decreto-Lei 1.002/69)",
    enunciado: "Segundo o Código de Processo Penal Militar (CPPM), qual é o prazo para conclusão do Inquérito Policial Militar quando o indiciado estiver preso?",
    alternativas: [
      "10 dias, improrrogáveis.",
      "30 dias, prorrogáveis por mais 30.",
      "20 dias, prorrogáveis por mais 20.",
      "15 dias, prorrogáveis uma única vez.",
      "40 dias, improrrogáveis.",
    ],
    gabarito: 2,
    comentario: "Conforme o Art. 20 do CPPM (Decreto-Lei 1.002/69), o inquérito deverá terminar dentro em 20 (vinte) dias, se o indiciado estiver preso, contado esse prazo a partir do dia em que se executar a ordem de prisão.",
  },
];

const whyQuestions = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: "Fixação pela prática",
    desc: "Resolver questões ativa a memória de longo prazo. Você aprende mais resolvendo do que apenas relendo a lei.",
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: "Foco no que cai na prova",
    desc: "Nossas questões são baseadas nos artigos mais cobrados, direcionando seu estudo para o que realmente importa.",
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Mede sua evolução real",
    desc: "Dashboard com taxa de acertos, horas de estudo e progresso por disciplina — saiba exatamente onde melhorar.",
  },
  {
    icon: <Lightbulb className="w-6 h-6" />,
    title: "Comentários na lei seca",
    desc: "Cada questão tem gabarito comentado com citação do artigo da lei, reforçando a fundamentação legal.",
  },
];

const platformPreviews = [
  {
    title: "Dashboard & Ranking",
    desc: "Visualize seu progresso com gráficos detalhados, acompanhe o Ranking Top 10 Guerreiros e monitore horas de estudo.",
    image: mockupDashboard,
  },
  {
    title: "Banco de Questões",
    desc: "Mais de 1.000 questões com interface intuitiva, alternativas claras, correção automática e comentários na lei seca.",
    image: mockupQuestoes,
  },
  {
    title: "Edital Verticalizado",
    desc: "Trilha organizada por tópicos com checkboxes, progresso e links diretos para a legislação.",
    image: mockupEdital,
  },
];

const Landing = () => {
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [activePreview, setActivePreview] = useState(0);

  const currentQuestion = exampleQuestions[selectedQuestion];

  const handleAnswer = (index: number) => {
    if (showAnswer) return;
    setSelectedAnswer(index);
    setShowAnswer(true);
  };

  const resetQuestion = (qIndex: number) => {
    setSelectedQuestion(qIndex);
    setSelectedAnswer(null);
    setShowAnswer(false);
  };

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
              Complemento ideal para sua preparação PMTO 2026
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.1] mb-6">
              Pratique com
              <br />
              <span className="text-gradient-primary">questões reais do CHOA</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-4 text-base md:text-lg leading-relaxed">
              O <strong className="text-foreground">Método CHOA</strong> não é um cursinho online.
              É uma <strong className="text-foreground">plataforma de questões e simulados</strong> feita para quem já está estudando e quer
              {" "}<strong className="text-foreground">fixar o conteúdo praticando</strong>.
            </p>
            <p className="text-muted-foreground max-w-xl mx-auto mb-10 text-sm">
              +1.000 questões baseadas na legislação do Tocantins, com gabarito comentado na lei seca.
              Ideal para complementar seu cursinho, grupo de estudos ou preparação individual.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/assinatura?trial=1"
                className="px-10 py-4 rounded-xl gradient-primary text-primary-foreground font-bold text-base flex items-center gap-2 hover:opacity-90 transition-opacity glow-primary"
              >
                <Gift className="w-5 h-5" />
                Testar Grátis por 1 Dia
              </Link>
              <Link
                to="/assinatura"
                className="px-10 py-4 rounded-xl border border-primary/40 bg-primary/5 text-primary font-semibold text-base flex items-center gap-2 hover:bg-primary/10 transition-colors"
              >
                Assinar por R$ 89,90
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Teste grátis sem cartão de crédito • Cancela automaticamente após 24h</p>
          </motion.div>
        </section>

        {/* Aviso: não é cursinho */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-2xl p-6 md:p-8 border-gold/20"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gold/10 text-gold shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2 text-foreground">
                  O Método CHOA <span className="text-gradient-gold">não substitui</span> seu cursinho ou grupo de estudos
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Nossa plataforma é um <strong className="text-foreground">complemento</strong> para sua preparação.
                  Aqui você <strong className="text-foreground">pratica resolvendo questões</strong> baseadas na legislação cobrada no processo seletivo interno.
                  É a ferramenta ideal para quem já está estudando e quer testar o que aprendeu.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="text-foreground">Complementa qualquer método de estudo</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="text-foreground">Questões 100% baseadas na lei do TO</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="text-foreground">Ideal para fixação e revisão</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="text-foreground">Simula o estilo da prova real</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Por que estudar por questões? */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Brain className="w-3.5 h-3.5" />
              Ciência da aprendizagem
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Por que estudar por <span className="text-gradient-primary">questões funciona</span>?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
              Estudos comprovam que a prática ativa supera a leitura passiva. Resolver questões é o método mais eficaz de fixação.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {whyQuestions.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all duration-300 group text-center"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mx-auto mb-3 group-hover:glow-primary transition-all">
                  {item.icon}
                </div>
                <h3 className="font-bold text-sm mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
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

        {/* Exemplo de Questão Interativa */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 text-gold text-xs font-semibold mb-4">
              <HelpCircle className="w-3.5 h-3.5" />
              Experimente agora
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Resolva questões <span className="text-gradient-gold">reais da plataforma</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
              As questões abaixo são exemplos reais do nosso banco, com gabarito comentado na lei seca. Clique em uma alternativa!
            </p>
          </motion.div>

          {/* Question tabs */}
          <div className="flex gap-2 mb-6 justify-center flex-wrap">
            {exampleQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => resetQuestion(i)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  selectedQuestion === i
                    ? "gradient-primary text-primary-foreground glow-primary"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Questão {i + 1}
              </button>
            ))}
          </div>

          <motion.div
            key={selectedQuestion}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 md:p-8 border-primary/10"
          >
            {/* Discipline badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <BookOpen className="w-3 h-3" />
              {currentQuestion.disciplina}
            </div>

            {/* Question */}
            <p className="text-sm md:text-base text-foreground leading-relaxed mb-6 font-medium">
              {currentQuestion.enunciado}
            </p>

            {/* Alternatives */}
            <div className="space-y-3 mb-6">
              {currentQuestion.alternativas.map((alt, i) => {
                const letter = String.fromCharCode(65 + i);
                const isCorrect = i === currentQuestion.gabarito;
                const isSelected = selectedAnswer === i;

                let borderClass = "border-border/30 hover:border-primary/30";
                if (showAnswer) {
                  if (isCorrect) borderClass = "border-success/60 bg-success/10";
                  else if (isSelected && !isCorrect) borderClass = "border-destructive/60 bg-destructive/10";
                  else borderClass = "border-border/20 opacity-60";
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-300 ${borderClass} ${!showAnswer ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <span translate="no" className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      showAnswer && isCorrect ? "bg-success/20 text-success" :
                      showAnswer && isSelected && !isCorrect ? "bg-destructive/20 text-destructive" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {letter}
                    </span>
                    <span className="text-sm text-foreground/90 leading-relaxed pt-1">{alt}</span>
                  </button>
                );
              })}
            </div>

            {/* Answer feedback */}
            {showAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-4 border ${
                  selectedAnswer === currentQuestion.gabarito
                    ? "bg-success/5 border-success/30"
                    : "bg-destructive/5 border-destructive/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className={`w-4 h-4 ${
                    selectedAnswer === currentQuestion.gabarito ? "text-success" : "text-destructive"
                  }`} />
                  <span className={`text-sm font-bold ${
                    selectedAnswer === currentQuestion.gabarito ? "text-success" : "text-destructive"
                  }`}>
                    {selectedAnswer === currentQuestion.gabarito ? "Resposta Correta!" : "Resposta Incorreta"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {currentQuestion.comentario}
                </p>
              </motion.div>
            )}

            {/* Info */}
            {!showAnswer && (
              <p className="text-xs text-muted-foreground text-center">
                👆 Clique em uma alternativa para ver a resposta comentada
              </p>
            )}
          </motion.div>

          {/* CTA after question */}
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground mb-3">Gostou? Temos mais de 1.000 questões como estas.</p>
            <Link
              to="/assinatura?trial=1"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity glow-primary"
            >
              <Gift className="w-4 h-4" />
              Testar Grátis por 1 Dia
            </Link>
          </div>
        </section>

        {/* Conheça a Plataforma - Screenshots */}
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Eye className="w-3.5 h-3.5" />
              Veja como funciona
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Conheça a <span className="text-gradient-primary">plataforma por dentro</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
              Interface moderna e intuitiva, projetada para maximizar seu tempo de estudo.
            </p>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Tabs */}
            <div className="lg:w-72 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {platformPreviews.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActivePreview(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-300 shrink-0 ${
                    activePreview === i
                      ? "glass-card border-primary/40 glow-primary"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${activePreview === i ? "text-primary rotate-90" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-bold ${activePreview === i ? "text-foreground" : "text-muted-foreground"}`}>{p.title}</p>
                    <p className="text-xs text-muted-foreground hidden lg:block mt-0.5">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Image */}
            <motion.div
              key={activePreview}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex-1 glass-card rounded-2xl overflow-hidden border-primary/10"
            >
              <img
                src={platformPreviews[activePreview].image}
                alt={platformPreviews[activePreview].title}
                className="w-full h-auto object-cover"
              />
              <div className="p-4 border-t border-border/30">
                <h3 className="font-bold text-sm text-foreground">{platformPreviews[activePreview].title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{platformPreviews[activePreview].desc}</p>
              </div>
            </motion.div>
          </div>
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
              Use como complemento ao seu cursinho ou grupo de estudos. Pratique, meça sua evolução e fixe o conteúdo.
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
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 text-gold text-xs font-semibold">
                  <Star className="w-3 h-3" />
                  Plano Único
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold animate-pulse">
                  🔥 OFERTA POR TEMPO LIMITADO
                </div>
              </div>
              <div className="mb-6">
                <span className="text-2xl text-muted-foreground line-through mr-3">R$ 99,90</span>
                <span className="text-5xl md:text-6xl font-black text-gradient-gold">R$ 89,90</span>
                <span className="text-muted-foreground ml-2 text-base">/ 90 dias</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8 max-w-md">
                Acesso completo a toda a plataforma por 90 dias corridos.
                Complemente sua preparação com questões e simulados ilimitados.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="text-sm text-foreground">{b}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/assinatura"
                  className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl gradient-gold text-gold-foreground font-bold text-base hover:opacity-90 transition-opacity glow-gold"
                >
                  Assinar Agora
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/assinatura?trial=1"
                  className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl border border-primary/30 bg-primary/5 text-primary font-semibold text-base hover:bg-primary/10 transition-colors"
                >
                  <Gift className="w-5 h-5" />
                  Testar Grátis por 1 Dia
                </Link>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Teste grátis sem cartão • Cancela automaticamente após 24h</p>
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
              Já está estudando? Potencialize seus resultados.
            </h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto mb-8">
              Use o Método CHOA como complemento da sua preparação.
              Pratique com questões reais, meça sua evolução e chegue confiante na prova.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/assinatura?trial=1"
                className="px-10 py-4 rounded-xl gradient-primary text-primary-foreground font-bold text-base flex items-center gap-2 hover:opacity-90 transition-opacity glow-primary"
              >
                <Gift className="w-5 h-5" />
                Testar Grátis por 1 Dia
              </Link>
              <Link
                to="/assinatura"
                className="px-10 py-4 rounded-xl border border-primary/40 bg-primary/5 text-primary font-semibold text-base flex items-center gap-2 hover:bg-primary/10 transition-colors"
              >
                Assinar por R$ 89,90
                <ArrowRight className="w-5 h-5" />
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
