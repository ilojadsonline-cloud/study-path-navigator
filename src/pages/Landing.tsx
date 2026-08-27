import { motion } from "framer-motion";
import {
  Shield, ArrowRight, BookOpen, HelpCircle, Shuffle, Trophy,
  Star, Zap, CheckCircle2, Clock, BarChart3, Lock, Users, Target,
  ChevronRight, Eye, Lightbulb, TrendingUp, Brain, AlertTriangle,
  CreditCard, QrCode, Receipt, PlayCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import mockupDashboard from "@/assets/mockup-dashboard.jpg";
import mockupQuestoes from "@/assets/mockup-questoes.jpg";
import mockupEdital from "@/assets/mockup-edital.jpg";

const features = [
  { icon: <BookOpen className="w-6 h-6" />, title: "Edital Verticalizado", desc: "Trilha completa e separada por curso: CHOA PMTO e CHOA CBMTO, com links diretos para a legislação de cada certame." },
  { icon: <HelpCircle className="w-6 h-6" />, title: "Banco de Questões", desc: "Milhares de questões no estilo da banca, com correção automática, comentários na lei seca e filtros por disciplina e assunto." },
  { icon: <Shuffle className="w-6 h-6" />, title: "Simulados Inteligentes", desc: "Gerador de simulados com randomização de questões e alternativas, no formato de cada edital (5 alternativas na PMTO, 4 no CBMTO)." },
  { icon: <Clock className="w-6 h-6" />, title: "Simulado Semanal Online", desc: "Prova semanal cronometrada com tentativa única, correção, recursos e ranking geral — simulando o dia da prova." },
  { icon: <Trophy className="w-6 h-6" />, title: "Ranking e Desempenho", desc: "Ranking dos melhores guerreiros por curso, diagnóstico por disciplina e assunto e cronômetro de estudo integrado." },
  { icon: <BarChart3 className="w-6 h-6" />, title: "Cronograma de Estudos", desc: "Gerador de cronograma personalizado conforme suas horas disponíveis, com exportação em PDF." },
  { icon: <Zap className="w-6 h-6" />, title: "Legislação do Tocantins", desc: "Acesso rápido às leis exigidas em cada edital, com material de apoio e videoaulas (BizuAulas) para o CHOA PMTO." },
  { icon: <Lock className="w-6 h-6" />, title: "Conta Individual e Segura", desc: "Login por CPF, controle de sessão, conteúdo protegido e acesso liberado somente para o curso adquirido." },
];

const benefits = [
  "Acesso completo ao curso escolhido (PMTO ou CBMTO)",
  "Banco de questões com gabarito comentado",
  "Simulados ilimitados com randomização",
  "Simulado Semanal com ranking 🏆",
  "Cronograma de estudos personalizado em PDF",
  "Meu Desempenho e diagnóstico por disciplina",
  "Cronômetro de estudo integrado",
  "Suporte via e-mail e grupo de avisos no WhatsApp",
];

const stats = [
  { icon: <HelpCircle className="w-5 h-5" />, value: "Milhares", label: "Questões" },
  { icon: <Shield className="w-5 h-5" />, value: "2", label: "Cursos (PMTO e CBMTO)" },
  { icon: <Trophy className="w-5 h-5" />, value: "Semanal", label: "Simulado com ranking" },
  { icon: <Target className="w-5 h-5" />, value: "30/365", label: "Dias de acesso" },
];

// Questões reais extraídas diretamente do banco da plataforma
const exampleQuestions = [
  {
    disciplina: "CPPM",
    assunto: "Arquivamento e reabertura do inquérito policial militar",
    dificuldade: "Médio",
    enunciado:
      "Após o arquivamento de um inquérito policial militar por falta de provas, sobrevêm novas provas indicando a autoria do crime. Nesse caso, o CPPM permite a reabertura do inquérito, desde que respeitados os limites do caso julgado e da extinção da punibilidade. Essa possibilidade está prevista no art. 25 do CPPM e é corretamente descrita como:",
    alternativas: [
      "princípio da indisponibilidade do inquérito, que impede o arquivamento definitivo enquanto não prescrita a pretensão punitiva.",
      "exceção à regra do arquivamento, permitindo a reabertura independentemente de novas provas, desde que dentro do prazo prescricional.",
      "hipótese de reabertura do inquérito, que depende de autorização do juiz e de manifestação do Ministério Público, mas não exige novas provas.",
      "possibilidade de arquivamento condicionado, que permite ao juiz determinar o sobrestamento do inquérito até o surgimento de novas provas.",
      "regra de que o arquivamento não obsta a instauração de outro inquérito se novas provas aparecerem, ressalvados o caso julgado e a extinção da punibilidade.",
    ],
    gabarito: 4,
    comentario:
      "A questão trata da reabertura do inquérito policial militar após arquivamento, prevista no art. 25 do CPPM. O dispositivo estabelece que 'o arquivamento de inquérito não obsta a instauração de outro, se novas provas aparecerem em relação ao fato, ao indiciado ou a terceira pessoa, ressalvados o caso julgado e os casos de extinção da punibilidade'. A alternativa E reproduz fielmente essa regra. Cuidado com a alternativa A: o princípio da indisponibilidade não impede o arquivamento definitivo; ele apenas veda que o Ministério Público desista da ação penal já proposta. As alternativas B e C erram ao dispensar a exigência de novas provas, e a D cria uma figura de 'arquivamento condicionado' inexistente no CPPM. Portanto, a reabertura depende do surgimento de novas provas e respeita os limites do caso julgado e da prescrição.",
  },
  {
    disciplina: "Lei nº 2.578/2012",
    assunto: "Hierarquia e disciplina — Círculos hierárquicos",
    dificuldade: "Médio",
    enunciado:
      "O Estatuto dos Militares Estaduais do Tocantins (Lei nº 2.578/2012) estabelece a hierarquia e a disciplina como bases institucionais da Corporação. Sobre os círculos hierárquicos e a precedência entre os militares estaduais, assinale a alternativa correta:",
    alternativas: [
      "A antiguidade entre militares de mesmo posto ou graduação é definida exclusivamente pela idade do militar.",
      "Os círculos hierárquicos são âmbitos de convivência entre militares da mesma categoria, visando ao desenvolvimento do espírito de camaradagem e do respeito à hierarquia.",
      "A precedência entre praças especiais e demais praças independe do grau hierárquico, prevalecendo apenas o tempo de serviço.",
      "A hierarquia militar não comporta a noção de subordinação, limitando-se à ordenação da autoridade em graus.",
      "O comando é uma prerrogativa transferível a qualquer militar, independentemente do posto ou da função exercida.",
    ],
    gabarito: 1,
    comentario:
      "A questão aborda os fundamentos da hierarquia militar previstos no Estatuto (Lei nº 2.578/2012). Os círculos hierárquicos são âmbitos de convivência entre militares da mesma categoria, com o objetivo de desenvolver o espírito de camaradagem e o respeito mútuo, dentro da estrutura de hierarquia e disciplina — por isso a alternativa B está correta. A alternativa A erra ao reduzir a antiguidade à idade, pois ela decorre da precedência hierárquica e dos critérios legais de ordenação. A C contraria a regra de precedência por grau hierárquico. A D é incorreta porque a hierarquia pressupõe subordinação. A E desvirtua o conceito de comando, que é exercido em razão do posto/graduação e da função, não sendo prerrogativa livremente transferível.",
  },
  {
    disciplina: "RDMETO",
    assunto: "Recursos disciplinares — Apelação",
    dificuldade: "Médio",
    enunciado:
      "Sobre as medidas que a autoridade competente pode adotar ao apreciar um recurso de apelação interposto contra decisão de Conselho, assinale a alternativa CORRETA.",
    alternativas: [
      "A autoridade competente pode, após análise, determinar a produção de novas provas, devolvendo o processo aos membros do Conselho, sem necessidade de observância do contraditório e da ampla defesa, em nome da celeridade processual.",
      "A autoridade competente, ao apreciar o recurso, está limitada a apenas manter ou anular a decisão proferida no julgamento, não podendo modificar a sanção aplicada.",
      "A autoridade competente, após análise dos pressupostos básicos, pode, conforme o caso, anular a medida disciplinar imposta ao acusado, determinando o arquivamento do processo.",
      "A autoridade competente, ao dar tipificação diversa à infração imputada ao acusado, está obrigada a aplicar automaticamente uma sanção mais grave, em razão da nova qualificação jurídica.",
      "A autoridade competente, ao apreciar o recurso, pode determinar a produção de novas provas, mas apenas se o acusado apresentar requerimento específico nesse sentido, sob pena de preclusão.",
    ],
    gabarito: 2,
    comentario:
      "A questão trata das medidas que a autoridade competente pode adotar ao julgar recurso de apelação contra decisão de Conselho, conforme o Art. 164 do RDMETO. O inciso III do referido artigo autoriza expressamente a anulação da medida disciplinar e o arquivamento do processo, desde que analisados os pressupostos de admissibilidade. A alternativa C reproduz exatamente essa possibilidade. Cuidado com a alternativa A: a produção de novas provas é possível (inciso I), mas sempre com observância do contraditório e ampla defesa, não podendo suprimi-los. A alternativa B é falsa, pois a autoridade pode modificar a sanção (agravar ou atenuar). A alternativa D é incorreta, pois a nova tipificação não obriga sanção mais grave. A alternativa E também erra, pois a produção de provas pode ser determinada de ofício.",
  },
  {
    disciplina: "LC nº 128/2021 (PMTO)",
    assunto: "Unidades administrativas de direção",
    dificuldade: "Médio",
    enunciado:
      "As unidades administrativas de direção da PMTO, conforme a Lei Complementar nº 128/2021, são responsáveis perante o Comandante-Geral pelo planejamento estratégico da Corporação. Nesse contexto, qual das seguintes atribuições é especificamente conferida a essas unidades?",
    alternativas: [
      "Executar diretamente as operações policiais militares, como o policiamento ostensivo.",
      "Elaborar diretrizes e ordens do Comando-Geral para o acionamento das unidades de apoio e de execução.",
      "Assessorar juridicamente o Comandante-Geral em matérias disciplinares e administrativas.",
      "Gerir o orçamento e a contabilidade da Corporação, incluindo a folha de pagamento.",
      "Fiscalizar e controlar internamente as unidades operacionais, realizando correições.",
    ],
    gabarito: 1,
    comentario:
      "A questão exige conhecimento do art. 8º da LC 128/2021, que define a responsabilidade das unidades de direção pelo planejamento estratégico e pela elaboração de diretrizes e ordens do Comando-Geral para acionar as unidades de apoio e execução. A alternativa B é a correta. Cuidado com a alternativa A: a execução direta das operações é atribuição das unidades de execução (art. 7º), não das de direção. As demais alternativas (C, D, E) não correspondem ao art. 8º; a assessoria jurídica, a gestão orçamentária e a fiscalização interna são funções de outros órgãos ou não constam como atribuição específica das unidades de direção.",
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
    desc: "Meu Desempenho com taxa de acertos, horas de estudo e progresso por disciplina — saiba exatamente onde melhorar.",
  },
  {
    icon: <Lightbulb className="w-6 h-6" />,
    title: "Comentários na lei seca",
    desc: "Cada questão tem gabarito comentado com citação do artigo da lei, reforçando a fundamentação legal.",
  },
];

const platformPreviews = [
  {
    title: "Meu Desempenho & Ranking",
    desc: "Visualize seu progresso com gráficos detalhados, acompanhe o Ranking Top 10 Guerreiros e monitore horas de estudo.",
    image: mockupDashboard,
  },
  {
    title: "Banco de Questões",
    desc: "Milhares de questões com interface intuitiva, alternativas claras, correção automática e comentários na lei seca.",
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
              <span className="font-bold text-sm text-gradient-primary">Método CHOA</span>
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
              Agora com dois cursos: CHOA PMTO e CHOA CBMTO
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
              Questões baseadas na legislação do Tocantins, com gabarito comentado na lei seca,
              simulado semanal com ranking e cronograma de estudos — em trilhas separadas para o
              {" "}<strong className="text-foreground">CHOA PMTO</strong> e o <strong className="text-foreground">CHOA CBMTO</strong>.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#demonstracao"
                className="px-10 py-4 rounded-xl border border-primary/40 bg-primary/5 text-primary font-semibold text-base flex items-center gap-2 hover:bg-primary/10 transition-colors"
              >
                <PlayCircle className="w-5 h-5" />
                Ver demonstração
              </a>
              <Link
                to="/assinatura"
                className="px-10 py-4 rounded-xl gradient-primary text-primary-foreground font-bold text-base flex items-center gap-2 hover:opacity-90 transition-opacity glow-primary"
              >
                Assinar a partir de R$ 39,99/mês
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Pague com <strong className="text-foreground">Cartão</strong>, <strong className="text-foreground">Pix</strong> ou <strong className="text-foreground">Boleto</strong> via Mercado Pago • planos mensais (30 dias) ou anuais (365 dias)</p>
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
        <section id="demonstracao" className="max-w-4xl mx-auto px-4 pb-20 scroll-mt-20">
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
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <BookOpen className="w-3 h-3" />
                {currentQuestion.disciplina}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted/40 text-muted-foreground text-xs font-medium">
                {currentQuestion.assunto}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                currentQuestion.dificuldade === "Difícil"
                  ? "bg-destructive/10 text-destructive"
                  : currentQuestion.dificuldade === "Médio"
                  ? "bg-gold/10 text-gold"
                  : "bg-success/10 text-success"
              }`}>
                {currentQuestion.dificuldade}
              </span>
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
                <div className="mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold/15 text-gold text-[10px] font-bold">CH</span>
                    <span className="text-xs font-bold text-foreground">Comentário do Professor</span>
                  </div>
                  <p className="text-xs md:text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {currentQuestion.comentario}
                  </p>
                </div>
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
            <p className="text-sm text-muted-foreground mb-3">Gostou? O banco tem milhares de questões como estas — assine e libere o curso completo.</p>
            <Link
              to="/assinatura"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity glow-primary"
            >
              Assinar agora
              <ArrowRight className="w-4 h-4" />
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
              { step: "03", icon: <BarChart3 className="w-7 h-7" />, title: "Acompanhe sua Evolução", desc: "Visualize estatísticas detalhadas no Meu Desempenho: taxa de acerto, horas de estudo e progresso por disciplina." },
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

        {/* Planos por curso */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Escolha o seu <span className="text-gradient-gold">curso</span>
            </h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
              Conteúdo, questões, simulados e ranking totalmente separados por certame.
              Planos mensais (30 dias) ou anuais (365 dias). Sem pegadinhas, sem surpresas.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* CHOA PMTO */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl p-8 border-primary/20 glow-primary relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-2.5 py-1 rounded-md bg-primary/15 text-primary text-[11px] font-black">CHOA PMTO</span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold/10 text-gold text-[11px] font-semibold">
                    <Star className="w-3 h-3" /> Mais procurado
                  </span>
                </div>
                <div className="mb-4">
                  <span className="text-4xl md:text-5xl font-black text-gradient-primary">R$ 39,99</span>
                  <span className="text-muted-foreground ml-2 text-sm">/ mês</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  ou <strong className="text-foreground">R$ 449,99</strong> no plano anual (365 dias).
                  Edital verticalizado CHOA/2026 PMTO, banco de questões, BizuAulas e simulado semanal.
                </p>
                <Link
                  to="/assinatura"
                  className="inline-flex w-full items-center justify-center gap-2 px-8 py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  Assinar CHOA PMTO
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* CHOA CBMTO */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl p-8 border-destructive/25 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-destructive/5 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-[11px] font-black">CHOA CBMTO</span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-bold">
                    🔥 Novo
                  </span>
                </div>
                <div className="mb-4">
                  <span className="text-4xl md:text-5xl font-black text-gradient-gold">R$ 49,99</span>
                  <span className="text-muted-foreground ml-2 text-sm">/ mês</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  ou <strong className="text-foreground">R$ 549,99</strong> no plano anual (365 dias).
                  Edital verticalizado CHOA/2026 CBMTO com questões de 4 alternativas, conforme o certame.
                </p>
                <Link
                  to="/assinatura"
                  className="inline-flex w-full items-center justify-center gap-2 px-8 py-3.5 rounded-xl gradient-gold text-gold-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  Assinar CHOA CBMTO
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-2xl p-6 md:p-8"
          >
            <p className="text-sm font-bold text-foreground mb-4">Incluído em qualquer plano:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="text-sm text-foreground">{b}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-4">
              💳 <strong className="text-foreground">Cartão de crédito</strong> com renovação automática, ou{" "}
              <strong className="text-foreground">Pix / Boleto</strong> com pagamento único (sem renovação).
              O acesso é liberado apenas para o curso adquirido.
            </p>
          </motion.div>
        </section>


        {/* Formas de pagamento */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-2xl p-6 md:p-8"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
                <Lock className="w-3.5 h-3.5" />
                Pagamento 100% seguro
              </div>
              <h3 className="text-xl md:text-2xl font-black mb-2">
                Pague do <span className="text-gradient-primary">jeito que preferir</span>
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Pagamento processado pelo <strong className="text-foreground">Mercado Pago</strong>: cartão de crédito (renovação automática) ou
                <strong className="text-foreground"> Pix / Boleto</strong> (pagamento único, com 30 ou 365 dias de acesso conforme o plano).
              </p>

            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/30">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Pix</p>
                  <p className="text-[11px] text-muted-foreground">Aprovação imediata</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/30">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Cartão de Crédito</p>
                  <p className="text-[11px] text-muted-foreground">Visa, Master, Elo, Amex</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/30">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Boleto</p>
                  <p className="text-[11px] text-muted-foreground">Compensação em até 2 dias</p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  <strong>Pagamento 100% seguro</strong> processado pelo Mercado Pago.
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  <strong>Acesso liberado</strong> logo após a confirmação do pagamento (30 ou 365 dias).
                </p>
              </div>
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
                to="/assinatura"
                className="px-10 py-4 rounded-xl gradient-primary text-primary-foreground font-bold text-base flex items-center gap-2 hover:opacity-90 transition-opacity glow-primary"
              >
                Assinar agora
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#demonstracao"
                className="px-10 py-4 rounded-xl border border-primary/40 bg-primary/5 text-primary font-semibold text-base flex items-center gap-2 hover:bg-primary/10 transition-colors"
              >
                <PlayCircle className="w-5 h-5" />
                Ver demonstração
              </a>
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
              <span className="text-sm font-bold text-gradient-primary">Método CHOA</span>
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
