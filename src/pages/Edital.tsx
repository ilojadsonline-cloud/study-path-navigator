import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import {
  BookOpen, ChevronDown, ChevronUp, ExternalLink, PlayCircle, FileText,
  Scale, Shield, Users, Gavel, BookMarked, Landmark, Brain, Scroll,
  MessageSquare, ClipboardList, AlertTriangle, BadgeCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type EditalItem = {
  topic: string;
  details: string[];
};

type Disciplina = {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  items: EditalItem[];
  leiSecaUrl: string;
  leiSecaLabel: string;
  videoAulaUrl: string;
  videoAulaLabel: string;
  disciplinaFilter: string;
};

const disciplinas: Disciplina[] = [
  {
    id: "estatuto",
    icon: <Shield className="w-5 h-5" />,
    title: "Estatuto dos Policiais Militares e Bombeiros Militares do TO",
    subtitle: "Lei nº 2.578/2012",
    color: "from-blue-500/20 to-blue-600/20",
    disciplinaFilter: "Estatuto PMTO",
    leiSecaUrl: "https://www.al.to.leg.br/arquivos/lei_2578-2012_66938.PDF",
    leiSecaLabel: "Lei nº 2.578/2012 — AL-TO",
    videoAulaUrl: "https://www.youtube.com/watch?v=M6BBI1WBjlY",
    videoAulaLabel: "Estatuto PMTO — Aula Completa",
    items: [
      {
        topic: "Disposições Preliminares",
        details: [
          "Conceito de policial militar e bombeiro militar",
          "Definição de cargo, posto e graduação",
          "Situações de atividade e inatividade",
          "Princípios da hierarquia e disciplina",
        ],
      },
      {
        topic: "Ingresso, Hierarquia e Disciplina",
        details: [
          "Condições de ingresso na corporação",
          "Círculos hierárquicos e ordem de precedência",
          "Graus hierárquicos: postos e graduações",
          "Conceito de disciplina militar e manifestações essenciais",
          "Atos disciplinares e ordens militares",
        ],
      },
      {
        topic: "Deveres, Obrigações e Direitos",
        details: [
          "Compromisso e juramento militar",
          "Deveres militares e valor militar",
          "Ética e decoro da classe",
          "Direitos dos policiais e bombeiros militares",
          "Remuneração, alimentação, fardamento e assistência",
          "Estabilidade, férias, licenças e afastamentos",
        ],
      },
      {
        topic: "Regime Disciplinar",
        details: [
          "Transgressões disciplinares e classificação",
          "Sanções disciplinares e sua aplicação",
          "Processo administrativo disciplinar",
          "Conselho de Disciplina e Conselho de Justificação",
          "Comportamento militar e notas conceituais",
        ],
      },
      {
        topic: "Movimentação e Lotação",
        details: [
          "Classificação e reclassificação",
          "Transferências e permutas",
          "Movimentação por necessidade do serviço",
        ],
      },
      {
        topic: "Afastamento e Licenciamento",
        details: [
          "Agregação e suas hipóteses",
          "Licenciamento a pedido e ex officio",
          "Exclusão a bem da disciplina",
          "Demissão e exoneração",
          "Reforma administrativa e compulsória",
          "Reserva remunerada",
        ],
      },
    ],
  },
  {
    id: "organizacao",
    icon: <Landmark className="w-5 h-5" />,
    title: "Organização Básica da PMTO",
    subtitle: "Lei Complementar nº 128/2021",
    color: "from-emerald-500/20 to-emerald-600/20",
    disciplinaFilter: "Organização Básica",
    leiSecaUrl: "https://www.al.to.leg.br/arquivos/lei_128-2021_66731.PDF",
    leiSecaLabel: "LC nº 128/2021 — AL-TO",
    videoAulaUrl: "https://www.youtube.com/watch?v=3A9pGFTdMDw",
    videoAulaLabel: "LC 128/2021 — Organização Básica",
    items: [
      {
        topic: "Estrutura e Missão Institucional",
        details: [
          "Missão constitucional da PMTO",
          "Competências e atribuições gerais",
          "Subordinação ao Governador do Estado",
          "Relação com a Segurança Pública estadual",
        ],
      },
      {
        topic: "Órgãos de Direção Geral",
        details: [
          "Comando-Geral e suas atribuições",
          "Subcomando-Geral",
          "Estado-Maior da PMTO",
          "Gabinete do Comandante-Geral",
        ],
      },
      {
        topic: "Órgãos de Direção Setorial",
        details: [
          "Diretoria de Pessoal (DP)",
          "Diretoria de Ensino (DE)",
          "Diretoria de Apoio Logístico (DAL)",
          "Diretoria de Finanças (DF)",
          "Diretoria de Saúde (DS)",
        ],
      },
      {
        topic: "Órgãos de Execução",
        details: [
          "Comandos de Policiamento de Área (CPA)",
          "Batalhões de Polícia Militar (BPM)",
          "Companhias e Pelotões PM",
          "Unidades especializadas (BOPE, BPRv, BPAmb)",
        ],
      },
      {
        topic: "Disposições Gerais e Transitórias",
        details: [
          "Quadro de organização e efetivo",
          "Adequação da estrutura organizacional",
          "Revogações e vigência",
        ],
      },
    ],
  },
  {
    id: "promocoes",
    icon: <BadgeCheck className="w-5 h-5" />,
    title: "Promoções na PMTO",
    subtitle: "Lei nº 2.575/2012",
    color: "from-amber-500/20 to-amber-600/20",
    disciplinaFilter: "Promoções PMTO",
    leiSecaUrl: "https://central3.to.gov.br/arquivo/269665/",
    leiSecaLabel: "Lei nº 2.575/2012 — Governo TO",
    videoAulaUrl: "https://www.youtube.com/results?search_query=lei+2575+pmto",
    videoAulaLabel: "Lei 2.575 PMTO — Aulas",
    items: [
      {
        topic: "Disposições Gerais sobre Promoções",
        details: [
          "Finalidade e princípios da promoção",
          "Condições essenciais para promoção",
          "Tipos de promoção: antiguidade, merecimento, bravura e post mortem",
          "Interstício mínimo para cada posto/graduação",
        ],
      },
      {
        topic: "Promoção por Antiguidade",
        details: [
          "Critério de contagem de tempo de serviço",
          "Quadro de acesso por antiguidade (QAA)",
          "Preterição e seus efeitos",
          "Precedência hierárquica e desempate",
        ],
      },
      {
        topic: "Promoção por Merecimento",
        details: [
          "Conceito de merecimento e critérios de avaliação",
          "Quadro de acesso por merecimento (QAM)",
          "Comissão de Promoções e seus pareceres",
          "Cursos obrigatórios para promoção",
        ],
      },
      {
        topic: "Promoção por Bravura e Post Mortem",
        details: [
          "Requisitos e procedimento para promoção por bravura",
          "Ato de bravura: definição e comprovação",
          "Promoção post mortem: hipóteses e efeitos legais",
        ],
      },
      {
        topic: "Ressalvas, Impedimentos e Disposições Finais",
        details: [
          "Impedimentos para promoção (processo disciplinar, etc.)",
          "Ressalvas e cessação de impedimentos",
          "Vagas e preenchimento de claros",
          "Datas de promoção e efeitos retroativos",
        ],
      },
    ],
  },
  {
    id: "cppm",
    icon: <Gavel className="w-5 h-5" />,
    title: "Código de Processo Penal Militar (CPPM)",
    subtitle: "Decreto-Lei nº 1.002/1969 — Arts. 8º a 28º e 243º a 253º",
    color: "from-red-500/20 to-red-600/20",
    disciplinaFilter: "CPPM",
    leiSecaUrl: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm",
    leiSecaLabel: "Decreto-Lei nº 1.002/69 — Planalto",
    videoAulaUrl: "https://www.youtube.com/results?search_query=cppm+compet%C3%AAncia+e+jurisdi%C3%A7%C3%A3o",
    videoAulaLabel: "CPPM — Competência e Jurisdição",
    items: [
      {
        topic: "Da Polícia Judiciária Militar (Arts. 8º a 11)",
        details: [
          "Conceito e atribuições da Polícia Judiciária Militar",
          "Exercício da Polícia Judiciária Militar",
          "Competência para apuração de infrações penais militares",
          "Delegação de atribuições",
        ],
      },
      {
        topic: "Do Inquérito Policial Militar — IPM (Arts. 12 a 28)",
        details: [
          "Conceito e finalidade do IPM",
          "Instauração do IPM: de ofício, por delegação, por requisição",
          "Encarregado do IPM e suas atribuições",
          "Diligências investigatórias: oitivas, perícias, acareações",
          "Prazo para conclusão do IPM (20 dias preso / 40 dias solto)",
          "Prorrogação de prazo e justificativa",
          "Relatório final e encaminhamento ao Ministério Público Militar",
          "Arquivamento do IPM: hipóteses legais",
        ],
      },
      {
        topic: "Da Prisão Provisória (Arts. 243 a 253)",
        details: [
          "Espécies de prisão provisória no processo penal militar",
          "Prisão em flagrante delito: conceito e hipóteses",
          "Auto de prisão em flagrante: formalidades",
          "Prisão preventiva: requisitos e fundamentos",
          "Decretação e revogação da prisão preventiva",
          "Menagem: conceito e aplicação",
          "Liberdade provisória: possibilidades e restrições",
          "Relaxamento de prisão ilegal",
        ],
      },
    ],
  },
  {
    id: "rdmeto",
    icon: <ClipboardList className="w-5 h-5" />,
    title: "Regulamento Disciplinar Militar do TO (RDMETO)",
    subtitle: "Decreto nº 4.994/2014",
    color: "from-purple-500/20 to-purple-600/20",
    disciplinaFilter: "RDMETO",
    leiSecaUrl: "https://central3.to.gov.br/arquivo/179903/",
    leiSecaLabel: "Decreto nº 4.994/2014 — Governo TO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Disposições Gerais e Princípios",
        details: [
          "Finalidade do regulamento disciplinar",
          "Princípios da hierarquia e disciplina",
          "Conceito de transgressão disciplinar",
          "Classificação das transgressões: leves, médias e graves",
        ],
      },
      {
        topic: "Transgressões Disciplinares",
        details: [
          "Relação das transgressões disciplinares previstas",
          "Circunstâncias atenuantes e agravantes",
          "Causas de justificação",
          "Cumulatividade de transgressões",
          "Prescrição disciplinar",
        ],
      },
      {
        topic: "Sanções Disciplinares",
        details: [
          "Advertência",
          "Repreensão",
          "Detenção",
          "Prisão disciplinar",
          "Licenciamento e exclusão a bem da disciplina",
          "Aplicação e cumprimento das sanções",
          "Competência para aplicação das sanções",
        ],
      },
      {
        topic: "Comportamento Militar",
        details: [
          "Classificação do comportamento: excepcional, ótimo, bom, regular, insuficiente e mau",
          "Critérios para mudança de classificação",
          "Ficha de alterações e registros disciplinares",
          "Reabilitação disciplinar",
          "Elogios e dispensas de punição",
        ],
      },
      {
        topic: "Processo Disciplinar",
        details: [
          "Sindicância disciplinar: conceito e procedimento",
          "Processo Administrativo Disciplinar (PAD)",
          "Garantias do contraditório e da ampla defesa",
          "Recursos disciplinares",
          "Revisão e anulação de punições",
        ],
      },
    ],
  },
  {
    id: "const-federal",
    icon: <Scroll className="w-5 h-5" />,
    title: "Constituição Federal (Arts. selecionados)",
    subtitle: "Arts. 5º, 37, 42, 142, 144 e outros",
    color: "from-sky-500/20 to-sky-600/20",
    disciplinaFilter: "Constituição Federal",
    leiSecaUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    leiSecaLabel: "Constituição Federal — Planalto",
    videoAulaUrl: "https://www.youtube.com/results?search_query=direito+constitucional",
    videoAulaLabel: "Direito Constitucional — Aulas",
    items: [
      {
        topic: "Direitos e Garantias Fundamentais (Art. 5º)",
        details: [
          "Princípio da legalidade, igualdade e dignidade",
          "Inviolabilidade do direito à vida, liberdade e segurança",
          "Vedação à tortura e tratamento degradante",
          "Direito de petição e acesso ao Judiciário",
          "Habeas corpus, mandado de segurança e habeas data",
        ],
      },
      {
        topic: "Administração Pública (Art. 37)",
        details: [
          "Princípios da Administração: legalidade, impessoalidade, moralidade, publicidade, eficiência",
          "Acumulação de cargos públicos e suas vedações",
          "Responsabilidade civil do Estado",
        ],
      },
      {
        topic: "Militares dos Estados (Art. 42)",
        details: [
          "Definição de militares dos estados e do DF",
          "Patentes e prerrogativas",
          "Direitos sociais aplicáveis aos militares estaduais",
          "Vedações constitucionais (sindicalização, greve, filiação partidária)",
        ],
      },
      {
        topic: "Forças Armadas e Segurança Pública (Arts. 142 e 144)",
        details: [
          "Destinação das Forças Armadas",
          "Órgãos de segurança pública",
          "Atribuições da Polícia Militar: policiamento ostensivo e preservação da ordem pública",
          "Subordinação aos Governadores dos Estados",
        ],
      },
    ],
  },
  {
    id: "dir-administrativo",
    icon: <Scale className="w-5 h-5" />,
    title: "Noções de Direito Administrativo",
    subtitle: "Princípios, atos, poderes e responsabilidade",
    color: "from-orange-500/20 to-orange-600/20",
    disciplinaFilter: "Direito Administrativo",
    leiSecaUrl: "https://cdn.novaconcursos.com.br/arquivos-digitais/apostilas/21356/35658/nv-029ma-direito-administrativo-amostra.pdf",
    leiSecaLabel: "Apostila Direito Administrativo — PDF",
    videoAulaUrl: "https://www.youtube.com/results?search_query=direito+administrativo+concurso+militar",
    videoAulaLabel: "Direito Administrativo — Aulas",
    items: [
      {
        topic: "Princípios da Administração Pública",
        details: [
          "Legalidade, impessoalidade, moralidade, publicidade e eficiência (LIMPE)",
          "Supremacia do interesse público",
          "Princípio da autotutela",
          "Princípio da razoabilidade e proporcionalidade",
        ],
      },
      {
        topic: "Atos Administrativos",
        details: [
          "Conceito e requisitos: competência, finalidade, forma, motivo e objeto",
          "Atributos: presunção de legitimidade, imperatividade, autoexecutoriedade",
          "Classificação dos atos administrativos",
          "Anulação, revogação e convalidação",
        ],
      },
      {
        topic: "Poderes Administrativos",
        details: [
          "Poder vinculado e poder discricionário",
          "Poder hierárquico",
          "Poder disciplinar",
          "Poder regulamentar",
          "Poder de polícia: conceito, atributos e limites",
        ],
      },
      {
        topic: "Responsabilidade Civil do Estado",
        details: [
          "Teoria do risco administrativo",
          "Responsabilidade objetiva e subjetiva",
          "Ação regressiva contra o agente público",
          "Excludentes de responsabilidade",
        ],
      },
    ],
  },
  {
    id: "dir-penal-militar",
    icon: <AlertTriangle className="w-5 h-5" />,
    title: "Noções de Direito Penal Militar",
    subtitle: "Código Penal Militar — Parte Geral",
    color: "from-rose-500/20 to-rose-600/20",
    disciplinaFilter: "Direito Penal Militar",
    leiSecaUrl: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm",
    leiSecaLabel: "Decreto-Lei nº 1.001/69 — Planalto",
    videoAulaUrl: "https://www.youtube.com/results?search_query=direito+penal+militar+concurso",
    videoAulaLabel: "Direito Penal Militar — Aulas",
    items: [
      {
        topic: "Aplicação da Lei Penal Militar",
        details: [
          "Crime propriamente militar e impropriamente militar",
          "Crime militar em tempo de paz e em tempo de guerra",
          "Aplicação no espaço e no tempo",
          "Militares e civis sujeitos à jurisdição militar",
        ],
      },
      {
        topic: "Crime Militar: Conceito e Elementos",
        details: [
          "Tipicidade, ilicitude e culpabilidade",
          "Dolo e culpa no Código Penal Militar",
          "Tentativa e consumação",
          "Concurso de agentes",
        ],
      },
      {
        topic: "Excludentes e Circunstâncias",
        details: [
          "Causas de exclusão da ilicitude: legítima defesa, estado de necessidade, estrito cumprimento do dever legal",
          "Causas de exclusão da culpabilidade: obediência hierárquica, coação irresistível",
          "Circunstâncias agravantes e atenuantes",
        ],
      },
      {
        topic: "Penas e Medidas de Segurança",
        details: [
          "Espécies de pena: morte, reclusão, detenção, prisão, impedimento, suspensão, reforma",
          "Penas principais e acessórias",
          "Medidas de segurança: internação e tratamento ambulatorial",
          "Extinção da punibilidade",
        ],
      },
    ],
  },
  {
    id: "portugues",
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Língua Portuguesa",
    subtitle: "Interpretação, gramática e redação oficial",
    color: "from-teal-500/20 to-teal-600/20",
    disciplinaFilter: "Língua Portuguesa",
    leiSecaUrl: "https://www4.planalto.gov.br/centrodeestudos/assuntos/manual-de-redacao-da-presidencia-da-republica/manual-de-redacao.pdf",
    leiSecaLabel: "Manual de Redação — Planalto (PDF)",
    videoAulaUrl: "https://www.youtube.com/results?search_query=língua+portuguesa+concurso+militar+2024",
    videoAulaLabel: "Português para Concursos — Aulas",
    items: [
      {
        topic: "Interpretação e Compreensão de Textos",
        details: [
          "Tipologia textual: narração, descrição, dissertação",
          "Gêneros textuais e suas características",
          "Identificação de ideias principais e secundárias",
          "Inferências e pressupostos",
          "Coesão e coerência textual",
        ],
      },
      {
        topic: "Gramática e Norma Culta",
        details: [
          "Ortografia oficial e acentuação gráfica",
          "Classes de palavras: substantivo, adjetivo, verbo, advérbio, etc.",
          "Concordância verbal e nominal",
          "Regência verbal e nominal",
          "Uso da crase",
          "Pontuação",
        ],
      },
      {
        topic: "Sintaxe",
        details: [
          "Termos essenciais, integrantes e acessórios da oração",
          "Orações coordenadas e subordinadas",
          "Período composto: classificação e conectivos",
          "Colocação pronominal: próclise, mesóclise e ênclise",
        ],
      },
      {
        topic: "Redação Oficial",
        details: [
          "Características da redação oficial: impessoalidade, formalidade, concisão, clareza",
          "Tipos de documentos: ofício, memorando, requerimento, relatório",
          "Pronomes de tratamento e abreviações",
        ],
      },
    ],
  },
  {
    id: "raciocinio",
    icon: <Brain className="w-5 h-5" />,
    title: "Raciocínio Lógico",
    subtitle: "Lógica, conjuntos, probabilidade e matemática básica",
    color: "from-indigo-500/20 to-indigo-600/20",
    disciplinaFilter: "Raciocínio Lógico",
    leiSecaUrl: "https://apostilas.com.br/Racioc%C3%ADnio%20L%C3%B3gico.pdf",
    leiSecaLabel: "Apostila Raciocínio Lógico — PDF",
    videoAulaUrl: "https://www.youtube.com/results?search_query=raciocínio+lógico+concurso+militar",
    videoAulaLabel: "Raciocínio Lógico — Aulas",
    items: [
      {
        topic: "Lógica Proposicional",
        details: [
          "Proposições simples e compostas",
          "Conectivos lógicos: conjunção, disjunção, condicional, bicondicional, negação",
          "Tabelas-verdade",
          "Equivalências lógicas",
          "Negação de proposições compostas",
        ],
      },
      {
        topic: "Lógica de Argumentação",
        details: [
          "Argumentos válidos e inválidos",
          "Diagramas lógicos",
          "Lógica de primeira ordem (quantificadores)",
          "Silogismos categóricos",
        ],
      },
      {
        topic: "Conjuntos e Operações",
        details: [
          "Representação e operações com conjuntos",
          "Diagramas de Venn",
          "Problemas envolvendo conjuntos",
        ],
      },
      {
        topic: "Noções de Probabilidade e Estatística",
        details: [
          "Princípio fundamental da contagem",
          "Permutação, arranjo e combinação",
          "Probabilidade simples e condicional",
          "Médias, moda e mediana",
        ],
      },
    ],
  },
  {
    id: "lei-organica-pm",
    icon: <Shield className="w-5 h-5" />,
    title: "Lei Orgânica das Polícias Militares",
    subtitle: "Lei nº 14.751, de 12 de dezembro de 2023",
    color: "from-cyan-500/20 to-cyan-600/20",
    disciplinaFilter: "Lei Orgânica PM",
    leiSecaUrl: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14751.htm",
    leiSecaLabel: "Lei nº 14.751/2023 — Planalto",
    videoAulaUrl: "https://www.youtube.com/results?search_query=lei+14751+de+2023",
    videoAulaLabel: "Lei 14.751/2023 — Aulas",
    items: [
      {
        topic: "Disposições Gerais e Princípios",
        details: [
          "Objeto e âmbito de aplicação da lei",
          "Definição de polícia militar e suas competências constitucionais",
          "Princípios institucionais: hierarquia, disciplina, legalidade",
          "Natureza jurídica das polícias militares",
        ],
      },
      {
        topic: "Organização e Estrutura",
        details: [
          "Estrutura organizacional das polícias militares",
          "Competência dos estados para organização",
          "Quadros de oficiais e praças",
          "Cargos, postos e graduações",
          "Efetivo e fixação de vagas",
        ],
      },
      {
        topic: "Carreira e Direitos",
        details: [
          "Ingresso na carreira militar estadual",
          "Sistema de promoções e progressão",
          "Remuneração e vantagens",
          "Direitos e garantias dos militares estaduais",
          "Regime previdenciário dos militares",
        ],
      },
      {
        topic: "Regime Disciplinar e Deveres",
        details: [
          "Deveres militares e ética profissional",
          "Regime disciplinar e transgressões",
          "Processo administrativo disciplinar",
          "Garantias do contraditório e ampla defesa",
        ],
      },
      {
        topic: "Atividade de Policiamento Ostensivo",
        details: [
          "Definição de policiamento ostensivo e preservação da ordem pública",
          "Ciclo completo de policiamento",
          "Uso progressivo da força",
          "Atuação integrada com demais órgãos de segurança pública",
          "Controle externo da atividade policial",
        ],
      },
      {
        topic: "Disposições Finais e Transitórias",
        details: [
          "Adequação das legislações estaduais",
          "Prazos de adaptação",
          "Revogações e vigência",
        ],
      },
    ],
  },
];

function DisciplinaBlock({ d, index }: { d: Disciplina; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card rounded-2xl overflow-hidden border border-border/50"
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center shrink-0`}>
          {d.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm md:text-base text-foreground leading-tight">{d.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{d.subtitle}</p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={d.leiSecaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  {d.leiSecaLabel}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>

                <button
                  onClick={() => navigate(`/questoes?disciplina=${encodeURIComponent(d.disciplinaFilter)}`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-gold text-gold-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <BookOpen className="w-4 h-4" />
                  Banco de Questões
                </button>

                {d.videoAulaUrl && (
                  <a
                    href={d.videoAulaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {d.videoAulaLabel}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}
              </div>

              {/* Edital Items */}
              <div className="space-y-3">
                {d.items.map((item, i) => (
                  <div key={i} className="rounded-xl bg-secondary/40 border border-border/30 p-4">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-2">
                      <BookMarked className="w-4 h-4 text-primary shrink-0" />
                      {item.topic}
                    </h3>
                    <ul className="space-y-1 ml-6">
                      {item.details.map((detail, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/50 mt-1.5 shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Edital() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-black text-gradient-primary">📋 Edital Verticalizado</h1>
          <p className="text-sm text-muted-foreground">
            Conteúdo programático detalhado por disciplina — CHOA PMTO 2026
          </p>
        </header>

        <div className="space-y-3">
          {disciplinas.map((d, i) => (
            <DisciplinaBlock key={d.id} d={d} index={i} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
