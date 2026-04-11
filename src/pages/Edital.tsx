import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import {
  BookOpen, ChevronDown, ChevronUp, ExternalLink, PlayCircle, FileText,
  Shield, Gavel, BookMarked, Landmark, BadgeCheck,
  ClipboardList, AlertTriangle, FileCheck
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
    disciplinaFilter: "Lei nº 2.578/2012",
    leiSecaUrl: "https://drive.google.com/file/d/1xoxeNbtnlYTLoNzTaFsmQ8O0nfFBuYY8/view?usp=sharing",
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
    disciplinaFilter: "LC nº 128/2021",
    leiSecaUrl: "https://drive.google.com/file/d/1LBi7Vba51gSZLR-kWmbcMw3KTfsntfq4/view?usp=sharing",
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
    subtitle: "Lei nº 2.575/2012 (com alterações até a Lei nº 4.434/2024)",
    color: "from-amber-500/20 to-amber-600/20",
    disciplinaFilter: "Lei nº 2.575/2012",
    leiSecaUrl: "https://drive.google.com/file/d/1Muwaef2e-iAsZwh0uIZAne8RqfF0P6F1/view?usp=sharing",
    leiSecaLabel: "Lei nº 2.575/2012 — Compilada",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Disposições Preliminares (Arts. 1º a 10)",
        details: [
          "Conceito de promoção e sua finalidade (Art. 1º)",
          "Datas de promoção: 21 de abril e 15 de novembro (Art. 3º)",
          "Promoções independentes de data: bravura, post mortem, ressarcimento, invalidez e tempo de serviço (Art. 3º-A, Lei 3.829/2021)",
          "Proporção antiguidade/merecimento para Oficiais; antiguidade para Praças (Art. 7º, Lei 3.829/2021)",
          "Abertura de vagas: promoção, agregação, inatividade, demissão, falecimento, aumento de efetivo (Art. 8º)",
          "Conceito de excedente e suas hipóteses (Art. 10, Lei 3.829/2021)",
        ],
      },
      {
        topic: "Comissões de Promoção (Arts. 11 a 20)",
        details: [
          "CPO: composição, presidência pelo Comandante-Geral, membros natos e efetivos (Art. 11)",
          "CPP: presidida pelo Chefe do Estado-Maior, composição e membros (Art. 12)",
          "Homologação das decisões da CPP pelo Comandante-Geral (Art. 13)",
          "Quórum: totalidade dos membros; decisão por maioria simples (Arts. 14 e 15)",
          "Competências da CPO: organizar QA, apreciar recursos, promoções por bravura/invalidez/post mortem (Art. 19)",
          "Competências da CPP: aplicação subsidiária do Art. 19 (Art. 20)",
        ],
      },
      {
        topic: "Critérios de Promoção (Arts. 21 a 28)",
        details: [
          "Sete critérios: antiguidade, merecimento, escolha, bravura, post mortem, tempo de serviço e invalidez (Art. 21)",
          "Promoção por antiguidade: precedência hierárquica (Art. 22)",
          "Promoção por merecimento: qualidades e atributos que distinguem o PM entre pares (Art. 23)",
          "Promoção por escolha: Tenente-Coronel a Coronel, por ato do Governador (Art. 24)",
          "Promoção por bravura: atos não comuns de coragem e abnegação (Art. 25)",
          "Promoção post mortem: falecimento no cumprimento do dever (Art. 26)",
          "Promoção por tempo de serviço: mínimo 25 anos de atividade militar (Art. 27, Lei 3.805/2021)",
          "Promoção por invalidez: incapacidade definitiva por laudo da JMCS (Art. 28, Lei 3.885/2022)",
        ],
      },
      {
        topic: "Quadros de Acesso e Interstício (Arts. 29 a 40)",
        details: [
          "Requisitos para ingresso no QA: interstício, saúde, condições peculiares, avaliação (Art. 31)",
          "QAA (antiguidade), QAM (merecimento) e QAE (escolha) — ordem e organização (Art. 32)",
          "Exclusão do QA: sub judice, desertor, condenado, licenciado, incapaz definitivo (Art. 33)",
          "Interstício de Praças: Soldado 96 meses, Cabo 48, 3ºSgt 36, 2ºSgt 36, 1ºSgt 12 meses (Art. 36, Lei 4.167/2023)",
          "Interstício de Oficiais: Asp 6, 2ºTen 24, 1ºTen 36, Cap 48, Maj 48, TC 48 meses (Art. 36)",
          "Cursos exigidos para cada posto/graduação: CFP, CAP, CAS, CAO, CSP, CHOA (Art. 39, §1º)",
          "Serviço arregimentado: mínimo 1/3 do interstício em função militar (Art. 39, §6º)",
        ],
      },
      {
        topic: "Avaliação Profissional e Moral (Arts. 41 a 46)",
        details: [
          "Pontuação positiva: tempo de serviço, curso, titulação civil, elogios, comportamento (Art. 42)",
          "Pontuação por lotação em municípios do interior — bonificação por porte e distância (Art. 42, XIV, Lei 3.829/2021)",
          "Pontuação negativa: punições disciplinares, condenação penal, desligamento de curso (Art. 43)",
          "Conceito Profissional e Moral: 13 quesitos, escala de 0 a 130 pontos (Art. 44)",
          "Mínimo de 65 pontos no Conceito para figurar no QAA e QAM (Art. 45, Lei 3.829/2021)",
          "Promoção de TC a Coronel: critério de escolha pelo Chefe do Executivo (Arts. 47-48)",
        ],
      },
      {
        topic: "Promoção por Bravura, Post Mortem, Tempo de Serviço e Invalidez (Arts. 49 a 57)",
        details: [
          "Comprovação do ato de bravura por sindicância; decadência em 1 ano (Art. 49)",
          "Promovido por bravura sem vaga: ocupa a primeira que surgir (Art. 50)",
          "Obrigatoriedade de realizar cursos após promoção por bravura/preterição (Art. 3º-A, §3º, Lei 4.060/2022)",
          "Post mortem: óbito em ação, a serviço ou com condições de acesso cumpridas (Art. 52)",
          "Tempo de serviço: ingresso até 17/12/2019, mínimo 25 anos de atividade militar (Art. 54, Lei 3.805/2021)",
          "Invalidez: incapacidade definitiva conforme Arts. 82 e 127 da Lei 2.578/2012 (Art. 55, Lei 3.885/2022)",
        ],
      },
      {
        topic: "Recursos e Cursos de Habilitação (Arts. 58 a 66)",
        details: [
          "Recurso contra composição de QA: prazo de 10 dias da publicação (Art. 60)",
          "Ressarcimento de preterição: erro administrativo, absolvição, cessação de impedimento (Art. 61)",
          "CHOA: Subtenente QPPM com CAS e graduação superior (Art. 62, III, Lei 3.829/2021)",
          "Vagas CHOA a partir de 2026: somente por seleção interna (Art. 63, II, Lei 3.829/2021)",
          "CAP: vagas preenchidas por antiguidade, após convocação por edital (Art. 64, Lei 3.829/2021)",
          "CAS: 1º Sargento QPPM, designação por antiguidade (Art. 62, VI, Lei 3.829/2021)",
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
    leiSecaUrl: "https://drive.google.com/file/d/1y1HuU8iuIaRgRbYju8NLUErmxolgf8W6/view?usp=sharing",
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
    id: "lei-organica-pm",
    icon: <Shield className="w-5 h-5" />,
    title: "Lei Orgânica das Polícias Militares",
    subtitle: "Lei nº 14.751, de 12 de dezembro de 2023",
    color: "from-cyan-500/20 to-cyan-600/20",
    disciplinaFilter: "Lei Orgânica PM",
    leiSecaUrl: "https://drive.google.com/file/d/1Sdgbsa1eI7yedrxjYgA8XIMFo9-ZIYcK/view?usp=sharing",
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
        <BackButton />
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
