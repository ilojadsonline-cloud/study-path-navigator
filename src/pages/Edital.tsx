import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import {
  BookOpen, ChevronDown, ChevronUp, ExternalLink, PlayCircle, FileText,
  Shield, Gavel, BookMarked, Landmark, BadgeCheck,
  ClipboardList, FileCheck, Brain, Target, Clock, Lock
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
  comingSoon?: boolean;
  restricted?: boolean;
};

const disciplinas: Disciplina[] = [
  {
    id: "estatuto",
    icon: <Shield className="w-5 h-5" />,
    title: "Estatuto dos Militares Estaduais do TO",
    subtitle: "Lei nº 2.578/2012 • Peso 18",
    color: "from-blue-500/20 to-blue-600/20",
    disciplinaFilter: "Lei nº 2.578/2012",
    comingSoon: false,
    leiSecaUrl: "https://drive.google.com/file/d/1xoxeNbtnlYTLoNzTaFsmQ8O0nfFBuYY8/view?usp=sharing",
    leiSecaLabel: "Lei nº 2.578/2012 — AL-TO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Parte geral e ingresso",
        details: [
          "Abrangência da lei: ingresso, relação jurídica funcional, direitos, obrigações, ética e prerrogativas.",
          "Natureza da PM e CBM como instituições permanentes, reserva do Exército e subordinação ao Governador.",
          "Competências institucionais: polícia ostensiva, preservação da ordem pública, defesa civil e atribuições correlatas.",
          "Situações do militar estadual: ativa, reserva remunerada, reforma, agregação e hipóteses correlatas.",
          "Conceitos legais do art. 10: Comandante, Organização Militar, sede, cargo, função e expressões equivalentes.",
          "Ingresso na Corporação e requisitos gerais exigidos em concurso público.",
        ],
      },
      {
        topic: "Hierarquia e disciplina",
        details: [
          "Hierarquia e disciplina como bases institucionais; autoridade e responsabilidade por grau hierárquico.",
          "Círculos hierárquicos e escala hierárquica de oficiais, praças especiais e praças.",
          "Antiguidade, precedência e critérios de ordenação dentro do mesmo posto ou graduação.",
          "Precedência entre praças especiais, subtenentes, sargentos, cabos e soldados.",
          "Comando, subordinação, responsabilidade por ordens, decisões e atos praticados.",
        ],
      },
      {
        topic: "Obrigações dos militares",
        details: [
          "Cargo militar, cargo vago e função militar: diferenças conceituais e consequências jurídicas.",
          "Encargo, incumbência, comissão, serviço e atividade militar ou de natureza militar.",
          "Valor militar: sentimento de servir, civismo, fé na missão, espírito de corpo, amor à profissão e aprimoramento técnico-profissional.",
          "Ética militar: verdade, responsabilidade, autoridade, eficiência, probidade, respeito à dignidade humana e zelo institucional.",
          "Vedações: sindicalização, greve, filiação partidária na atividade e comércio/gerência empresarial pelo militar da ativa.",
          "Compromisso de honra e efeitos da violação das obrigações e deveres militares.",
        ],
      },
      {
        topic: "Disciplina e transgressões",
        details: [
          "Competências para instaurar sindicância e aplicar sanções disciplinares.",
          "Competências para Conselho de Justificação, Conselho de Disciplina e afastamento imediato.",
          "Conceito de transgressão disciplinar e prazos prescricionais por natureza.",
          "Critérios de julgamento: antecedentes, causas determinantes, natureza dos fatos e consequências.",
          "Transgressões leves: identificação e comparação com médias e graves.",
          "Transgressões médias: identificação e comparação com leves e graves.",
          "Transgressões graves: condutas centrais, efeitos e relação com honra, pundonor e decoro.",
          "Possibilidade de alteração motivada da classificação da transgressão.",
        ],
      },
      {
        topic: "Processos administrativos disciplinares",
        details: [
          "Espécies de processos administrativos disciplinares: sindicância, Conselho de Justificação e Conselho de Disciplina.",
          "Sindicância: conceito, finalidade, contraditório e ampla defesa.",
          "Ordem cronológica da sindicância: instauração, autuação, citação, interrogatório, defesa preliminar, instrução, alegações finais, relatório, solução e enquadramento.",
          "Prazos da sindicância: 30 dias, prorrogação por 20 dias e prazos de defesa.",
          "Conselhos: finalidade, aplicação a oficiais e praças, composição, rito, prazo de 50 dias e prorrogação.",
          "Medidas propostas no relatório dos Conselhos e decisão da autoridade nomeante.",
          "Comportamento da praça: excepcional, ótimo, bom, insuficiente e mau; efeitos práticos para carreira e promoção.",
        ],
      },
      {
        topic: "Direitos e remuneração",
        details: [
          "Reposições, indenizações ao erário e limite mínimo mensal de subsídio.",
          "Direitos dos militares: garantias do posto/patente ou graduação, promoção, férias, licenças e demais direitos estatutários.",
          "Sistema de Proteção Social dos militares estaduais.",
          "Auxílio-natalidade, pecúlio militar, auxílio-funeral e transporte de corpo.",
          "Remuneração por subsídio, suspensão, cessação, desaparecimento e extravio.",
          "Inatividade: reserva remunerada, reforma, proventos e incapacidades.",
          "Vantagens pecuniárias: diárias, ajuda de custo, bolsa de estudo e pró-labore.",
        ],
      },
      {
        topic: "Situações funcionais e prerrogativas",
        details: [
          "Promoção no Estatuto: acesso seletivo, gradual e sucessivo; relação com legislação específica.",
          "Férias, afastamentos temporários e licenças: hipóteses, efeitos e limitações.",
          "Agregação: conceito, hipóteses e efeitos no serviço ativo.",
          "Reversão, excedente, ausência, desaparecimento, extravio e deserção.",
          "Exclusão do serviço ativo: transferência para reserva, reforma, demissão, perda de posto/patente, licenciamento e anulação de inclusão.",
          "Reforma e incapacidade: causas, inspeção de saúde e efeitos funcionais.",
          "Prerrogativas, uso de uniformes, porte de arma, honras e assistência jurídica quando cabível.",
          "Disposições finais e transitórias com impacto funcional.",
        ],
      },
    ],
  },
  {
    id: "promocoes",
    icon: <BadgeCheck className="w-5 h-5" />,
    title: "Lei de Promoções da PMTO",
    subtitle: "Lei nº 2.575/2012 • Peso 16",
    color: "from-amber-500/20 to-amber-600/20",
    disciplinaFilter: "Lei nº 2.575/2012",
    comingSoon: false,
    leiSecaUrl: "https://drive.google.com/file/d/1Muwaef2e-iAsZwh0uIZAne8RqfF0P6F1/view?usp=sharing",
    leiSecaLabel: "Lei nº 2.575/2012 — Compilada",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Disposições iniciais",
        details: [
          "Finalidade da promoção: reconhecimento de mérito e habilitação para posto ou graduação superior.",
          "Datas de promoção e alterações legislativas; promoções que independem de data.",
          "Responsabilidade do militar pela não inclusão em quadro de acesso quando não satisfaz requisitos por escolhas pessoais.",
          "Impedimento por comportamento inferior a bom.",
          "Comunicação de fato grave que possa influir na avaliação do colega.",
          "Vagas: critérios, abertura, cômputo e situação de excedente.",
        ],
      },
      {
        topic: "Comissões de promoção",
        details: [
          "CPO: composição, presidência, membros natos e efetivos.",
          "CPP: composição, presidência e membros.",
          "Reuniões, quórum, decisão por maioria simples e voto de qualidade.",
          "Competências da CPO e aplicação à CPP: organizar quadros de acesso, publicar, conhecer recursos e propor exclusões.",
          "Trabalhos de secretaria e regimentos internos.",
        ],
      },
      {
        topic: "Critérios de promoção",
        details: [
          "Critérios de promoção: antiguidade, merecimento, escolha, bravura, post mortem, tempo de contribuição/serviço e invalidez permanente.",
          "Antiguidade: precedência hierárquica.",
          "Merecimento: conjunto de qualidades, atributos, desempenho e avaliação da carreira.",
          "Escolha: promoção de Tenente-Coronel a Coronel.",
          "Bravura: ato incomum de coragem, audácia e abnegação; sindicância e decadência.",
          "Post mortem: hipóteses, comprovação e finalidade.",
          "Tempo de contribuição/serviço: requisitos e regras transitórias.",
          "Invalidez permanente: requisitos, Junta Militar Central de Saúde e independência de vaga/interstício/curso quando aplicável.",
        ],
      },
      {
        topic: "Quadros de acesso",
        details: [
          "Quadro de Acesso: conceito, organização por critério, grau hierárquico e quadro da carreira.",
          "Requisitos essenciais para ingresso em QA: interstício, saúde, requisitos peculiares e avaliação profissional/moral.",
          "Ordem nominal nos quadros por antiguidade, merecimento e escolha.",
          "Hipóteses de não inclusão e exclusão de QA.",
          "Publicação dos quadros e precedência de recursos.",
          "Inclusão sob condição e preenchimento de requisitos até a data da promoção.",
          "Interstícios por posto/graduação e possibilidade de redução.",
          "Higidez e inspeção médica oficial.",
          "Atividades peculiares: cursos, serviço arregimentado e função específica.",
        ],
      },
      {
        topic: "Avaliação profissional e moral",
        details: [
          "Pontuação final do QAM: diferença entre pontos positivos e negativos.",
          "Valores numéricos positivos: tempo de serviço, tempo na graduação/posto, cursos e demais títulos.",
          "Valores numéricos negativos: punições, sentenças e demais fatores depreciativos.",
          "Conceito profissional e moral: escala, avaliador e requisitos morais/profissionais.",
          "Mínimo de 65 pontos para figurar no QAM, conforme redação vigente.",
          "Justificativa de conceitos inferiores a 65 ou superiores a 120.",
        ],
      },
      {
        topic: "Recursos, cursos e CHOA",
        details: [
          "Recursos contra composição de QA e preterição à promoção.",
          "Endereçamento de recursos em promoção de Praças e Oficiais.",
          "Prazo de 10 dias para recorrer da composição do QA e solução em 90 dias.",
          "Ressarcimento de preterição: hipóteses e efeitos.",
          "Matrícula em cursos de habilitação e aperfeiçoamento: comportamento, condenações e aptidão médica.",
          "Vagas para CHOA/CHOM/CHOAS e regras de preenchimento.",
          "Concorrência às vagas por quadro e disposições gerais sobre excedentes.",
        ],
      },
    ],
  },
  {
    id: "organizacao",
    icon: <Landmark className="w-5 h-5" />,
    title: "Organização Básica da PMTO",
    subtitle: "Lei Complementar nº 128/2021 • Peso 12",
    color: "from-emerald-500/20 to-emerald-600/20",
    disciplinaFilter: "LC nº 128/2021",
    comingSoon: false,
    leiSecaUrl: "https://drive.google.com/file/d/1LBi7Vba51gSZLR-kWmbcMw3KTfsntfq4/view?usp=sharing",
    leiSecaLabel: "LC nº 128/2021 — AL-TO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Disposições gerais",
        details: [
          "Natureza da PMTO: instituição permanente, força auxiliar e reserva do Exército.",
          "Finalidade: preservação da ordem pública e policiamento ostensivo no território tocantinense.",
          "Competências: planejamento, coordenação, execução da polícia ostensiva e ações correlatas.",
          "Subordinação direta ao Chefe do Poder Executivo.",
        ],
      },
      {
        topic: "Estrutura geral",
        details: [
          "Estrutura geral: unidades administrativas de direção, apoio, execução e especiais.",
          "Unidades de direção: comando, planejamento e administração.",
          "Unidades de apoio: atividade-meio e assessoramento.",
          "Unidades de execução: atividade-fim e cumprimento de diretrizes.",
          "Unidades especiais: Colégios Militares e vinculações.",
        ],
      },
      {
        topic: "Unidades de direção",
        details: [
          "Comando-Geral: CG, CHEM, SCHEM, CORREG, EMG, EME e Comandos de Policiamento.",
          "Comandante-Geral: nomeação, requisitos e responsabilidade superior pelo comando/administração/emprego.",
          "Chefe do Estado Maior: direção, orientação, coordenação e substituição do Comandante-Geral.",
          "Subchefe do Estado Maior: nomeação, precedência e substituições.",
          "Corregedoria-Geral: natureza técnica, subordinação e atuação estadual.",
          "Estado Maior Geral: planejamento, estudo, orientação, coordenação, fiscalização e controle.",
          "Estado Maior Especial e Diretorias: logística, ensino, pessoal, saúde, finanças, tecnologia e áreas correlatas.",
          "Comandos de Policiamento: capital, especializado, interior e demais estruturas definidas.",
        ],
      },
      {
        topic: "Unidades de apoio",
        details: [
          "Gabinete do Comandante-Geral: assistência direta, triagem e assuntos institucionais.",
          "Academia Policial Militar Tiradentes: formação, aperfeiçoamento e especialização.",
          "Ajudância-Geral e QCG: administração, bandas de música e coordenação.",
          "Assessoria Jurídica e assessorias institucionais.",
          "Assessoria Técnica de Engenharia e Finanças/Patrimônio conforme competências legais.",
        ],
      },
      {
        topic: "Execução, efetivo e disposições finais",
        details: [
          "Unidades Policiais Militares e Especializadas: execução da atividade-fim.",
          "Plano de Articulação: desdobramento, atribuições e aprovação.",
          "Profissionais da PMTO: pessoal ativo, oficiais, praças, quadros e formação superior.",
          "Efetivo fixado em lei e QOD aprovado pelo Chefe do Poder Executivo.",
          "Meios de comunicação oficiais: Boletim Geral, Boletim Reservado, Boletim Interno e Boletim Interno Reservado.",
          "Competência regulamentar do Comandante-Geral e exclusividade de funções de comando/chefia.",
        ],
      },
    ],
  },
  {
    id: "cppm",
    icon: <Gavel className="w-5 h-5" />,
    title: "CPPM — Polícia Judiciária Militar, IPM e APF",
    subtitle: "Decreto-Lei nº 1.002/1969 (arts. 8º-28 e 243-253) • Peso 10",
    color: "from-red-500/20 to-red-600/20",
    disciplinaFilter: "CPPM",
    comingSoon: false,
    leiSecaUrl: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm",
    leiSecaLabel: "Decreto-Lei nº 1.002/69 — Planalto",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "IPM — arts. 8º a 28",
        details: [
          "Competência da Polícia Judiciária Militar: apuração de crimes militares e apoio à Justiça Militar e ao Ministério Público.",
          "Inquérito Policial Militar: conceito, finalidade, natureza de instrução provisória e peças instrutórias.",
          "Início do IPM por portaria: de ofício, determinação/delegação, requisição do MP, decisão judicial e requerimento do ofendido.",
          "Designação e compromisso do escrivão.",
          "Providências imediatas ao tomar conhecimento da infração: preservação do local, apreensões, prisão do infrator e colheita de provas.",
          "Atribuições do encarregado: ouvir ofendido, indiciado e testemunhas; reconhecimento; acareações; perícias; busca e apreensão.",
          "Assistência do procurador em fato de excepcional importância ou difícil elucidação.",
          "Requisitos do encarregado do inquérito e atenção à hierarquia do indiciado.",
          "Sigilo do inquérito e acesso do advogado.",
          "Incomunicabilidade do indiciado preso e detenção durante investigações.",
          "Horário das inquirições e lavratura das assentadas.",
          "Prazos do IPM: 20 dias com indiciado preso, 40 dias com indiciado solto e prorrogação.",
          "Organização das peças, numeração, rubrica, juntada documental e relatório minucioso.",
          "Remessa dos autos, vedação de arquivamento pela autoridade militar e hipóteses de novo inquérito.",
          "Devolução dos autos para diligências e dispensa do IPM.",
        ],
      },
      {
        topic: "APF — arts. 243 a 253",
        details: [
          "Dever de prender: qualquer pessoa poderá e militares deverão prender insubmisso, desertor ou quem esteja em flagrante.",
          "Hipóteses de flagrante: está cometendo, acaba de cometer, perseguição logo após e encontrado com instrumentos/objetos.",
          "Infração permanente e flagrância enquanto não cessar permanência.",
          "Apresentação do preso à autoridade competente e oitivas iniciais.",
          "Lavratura do auto de prisão em flagrante e assinatura por autoridade, condutor, testemunhas e preso.",
          "Fundadas suspeitas, recolhimento à prisão, corpo de delito, busca e apreensão e diligências necessárias.",
          "Nota de culpa em 24 horas, recibo e consequência do descumprimento.",
          "Fato praticado em presença da autoridade ou contra ela.",
          "Prisão em local não sujeito à administração militar e autoridade competente para lavrar auto.",
          "Remessa do APF ao juiz, prazo máximo em caso de diligência e passagem à disposição judicial.",
          "Devolução do auto para diligências e liberdade provisória nas hipóteses legais.",
        ],
      },
    ],
  },
  {
    id: "rdmeto",
    icon: <ClipboardList className="w-5 h-5" />,
    title: "Regulamento Disciplinar (RDMETO)",
    subtitle: "Decreto nº 4.994/2014 e Anexo Único • Peso 10",
    color: "from-purple-500/20 to-purple-600/20",
    disciplinaFilter: "RDMETO",
    comingSoon: false,
    leiSecaUrl: "https://drive.google.com/file/d/1y1HuU8iuIaRgRbYju8NLUErmxolgf8W6/view?usp=sharing",
    leiSecaLabel: "Decreto nº 4.994/2014 — Governo TO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Parte geral e deontologia",
        details: [
          "Finalidade do RDMETO e processos administrativos disciplinares regulados.",
          "Âmbito subjetivo: militares da ativa, reserva, agregados, reformados e alunos de cursos.",
          "Conceitos de honra pessoal, pundonor militar e decoro da classe.",
          "Deontologia militar e valores/deveres éticos.",
          "Código de Conduta para Funcionários Responsáveis pela Aplicação da Lei.",
          "Dignidade humana, direitos fundamentais, legalidade, necessidade e proporcionalidade no uso da força.",
          "Vedação à tortura e tratamento cruel, desumano ou degradante.",
          "Não discriminação e respeito às limitações individuais.",
          "Manifestações essenciais da disciplina militar.",
          "Ordens, camaradagem, comunicação de fato contrário à disciplina e parte.",
        ],
      },
      {
        topic: "Sindicância",
        details: [
          "Instauração, competência e autuação: Sindicância: finalidade, direitos de defesa e uso para promoções post mortem, invalidez e bravura.",
          "Instauração, competência e autuação: Sindicâncias especiais de promoção e representação de interessado.",
          "Instauração, competência e autuação: Autoridades competentes para instauração e aplicação de punições.",
          "Instauração, competência e autuação: Impedimentos do comandante, chefe, diretor ou sindicante.",
          "Instauração, competência e autuação: Arguição de impedimento, incidente e decisão.",
          "Instauração, competência e autuação: Portaria de instauração, publicação e aditamento.",
          "Instauração, competência e autuação: Autuação e elementos formais dos autos.",
          "Instauração, competência e autuação: Escrivão: nomeação, compromisso e atribuições.",
          "Defesa, instrução e provas: Citação do sindicado, mandado, citação pessoal e por edital.",
          "Defesa, instrução e provas: Interrogatório: ciência da acusação, direito ao silêncio e duas partes do ato.",
          "Defesa, instrução e provas: Defesa preliminar em 3 dias úteis, vista dos autos e arrolamento de até 3 testemunhas.",
          "Defesa, instrução e provas: Instrução: depoimentos, acareações, reconhecimentos, investigações, diligências e perícias.",
          "Defesa, instrução e provas: Juntada de documentos até alegações finais, com contraditório.",
          "Defesa, instrução e provas: Oitiva do ofendido e testemunhas; ordem e requisitos formais.",
          "Defesa, instrução e provas: Perguntas da defesa, indeferimento motivado e retirada do sindicado do recinto.",
          "Defesa, instrução e provas: Acareação e reconhecimento de pessoas/coisas.",
          "Defesa, instrução e provas: Incidente de insanidade mental, suspensão do processo e atuação da JMCS.",
          "Defesa, instrução e provas: Diligências, perícias, carta precatória, revelia e defensor dativo/ad hoc.",
        ],
      },
      {
        topic: "Sindicância e recursos",
        details: [
          "Alegações finais em 5 dias úteis.",
          "Relatório circunstanciado: parte expositiva, diligências, argumentos da defesa, análise e conclusão.",
          "Prazo de conclusão: 30 dias, prorrogação por 20 dias, interrupção e suspensão.",
          "Solução: decisão motivada, publicação e conteúdo mínimo.",
          "Despacho saneador e correção de vícios.",
          "Enquadramento: identificação, descrição, capitulação, circunstâncias e punição.",
          "Recursos disciplinares: pedido de reconsideração e recurso hierárquico.",
          "Efeito suspensivo do recurso tempestivo e preclusão administrativa.",
          "Demais processos: Conselho de Justificação, Conselho de Disciplina, rito, decisão e medidas.",
          "Sanções, comportamento, reabilitação, recompensas e disposições finais do regulamento.",
        ],
      },
    ],
  },
  {
    id: "pop",
    icon: <Target className="w-5 h-5" />,
    title: "POP — Uso Seletivo da Força e Abordagens Policiais",
    subtitle: "Procedimento Operacional Padrão • Peso 14",
    color: "from-cyan-500/20 to-cyan-600/20",
    disciplinaFilter: "POP",
    comingSoon: true,
    leiSecaUrl: "",
    leiSecaLabel: "",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Módulo I — Processo 108",
        details: [
          "Processo 108: conceito operacional de uso seletivo da força policial.",
          "Princípios do uso da força: legalidade, necessidade, proporcionalidade, moderação, conveniência e responsabilização.",
          "Níveis de resistência do abordado e correspondência com níveis de resposta policial.",
          "Presença policial, verbalização, controle de contato, técnicas de menor potencial ofensivo e força potencialmente letal.",
          "Avaliação de risco, progressão e regressão do uso da força.",
          "Preservação da vida, proteção de terceiros, segurança da equipe e comunicação operacional.",
          "Registro pós-ocorrência, cadeia de responsabilidade e relato técnico.",
        ],
      },
      {
        topic: "Módulo II — Processos 201 a 214",
        details: [
          "Processos 201 a 214: lógica geral das abordagens policiais.",
          "Preparação da abordagem: observação, planejamento, função dos integrantes e segurança perimetral.",
          "Abordagem a pessoa em atitude suspeita.",
          "Busca pessoal: fundamentos, verbalização, posicionamento, segurança e respeito à dignidade.",
          "Abordagem a veículo: parada, aproximação, desembarque, busca veicular e controle de ocupantes.",
          "Abordagem a motocicleta, bicicleta e pedestre, conforme processos aplicáveis.",
          "Abordagem em estabelecimentos, residências ou ambientes específicos quando prevista no manual.",
          "Conduta com grupos, multidões, pessoas vulneráveis e situações de risco elevado.",
          "Uso de algemas, condução, preservação de objetos e documentação da ocorrência.",
          "Erros operacionais comuns: perda de controle visual, verbalização insuficiente, negligência de cobertura e busca sem técnica.",
        ],
      },
    ],
  },
  {
    id: "portugues",
    icon: <BookOpen className="w-5 h-5" />,
    title: "Língua Portuguesa",
    subtitle: "Interpretação e compreensão de texto • Peso 10",
    color: "from-teal-500/20 to-teal-600/20",
    disciplinaFilter: "Língua Portuguesa",
    comingSoon: true,
    leiSecaUrl: "",
    leiSecaLabel: "",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Interpretação de texto",
        details: [
          "Diferença entre interpretação e compreensão: informações explícitas e inferências.",
          "Ideia central, tema, tese, argumentos e finalidade comunicativa.",
          "Coesão referencial: pronomes, sinônimos, hipônimos, hiperônimos e elipses.",
          "Coesão sequencial: conectivos, relações lógico-semânticas e progressão textual.",
          "Inferência, pressupostos, subentendidos e implícitos.",
          "Sentido denotativo e conotativo; ironia e efeitos de sentido.",
          "Tipologia textual: narrativo, descritivo, dissertativo, injuntivo e expositivo.",
          "Gêneros textuais institucionais e administrativos.",
          "Reescritura sem alteração de sentido e identificação de alternativa extrapolativa.",
          "Estratégia de prova: leitura do comando, marcação de palavras-chave e eliminação de distratores.",
        ],
      },
    ],
  },
  {
    id: "redacao",
    icon: <FileCheck className="w-5 h-5" />,
    title: "Manual de Redação Oficial da PMTO",
    subtitle: "Itens 6.1 a 6.8 • Peso 10",
    color: "from-slate-500/20 to-slate-600/20",
    disciplinaFilter: "Redação Oficial",
    comingSoon: true,
    leiSecaUrl: "",
    leiSecaLabel: "",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "6.1 — Atos de correspondência",
        details: [
          "Definição dos atos de correspondência.",
          "Finalidade institucional e hipóteses de utilização.",
          "Diferenciação conceitual entre expedientes de comunicação interna e externa.",
        ],
      },
      {
        topic: "6.2 — Atos normativos",
        details: [
          "Definição dos atos normativos.",
          "Finalidade de disciplinar situações gerais e abstratas.",
          "Hipóteses de uso no âmbito da PMTO.",
        ],
      },
      {
        topic: "6.3 — Atos ordinatórios",
        details: [
          "Definição dos atos ordinatórios.",
          "Finalidade de ordenar rotinas internas e execução administrativa.",
          "Hipóteses de utilização por autoridade competente.",
        ],
      },
      {
        topic: "6.4 — Atos enunciativos",
        details: [
          "Definição dos atos enunciativos.",
          "Finalidade de certificar, atestar, opinar ou declarar situação.",
          "Hipóteses de uso conforme natureza declaratória.",
        ],
      },
      {
        topic: "6.5 — Atos negociais",
        details: [
          "Definição dos atos negociais.",
          "Finalidade de autorização, permissão, licença ou anuência administrativa.",
          "Hipóteses de uso quando há manifestação administrativa específica.",
        ],
      },
      {
        topic: "6.6 — Atos comprobatórios",
        details: [
          "Definição dos atos comprobatórios.",
          "Finalidade de comprovar fato, situação, registro ou ato administrativo.",
          "Hipóteses de utilização documental.",
        ],
      },
      {
        topic: "6.7 — Atos de divulgação",
        details: [
          "Definição dos atos de divulgação.",
          "Finalidade de publicidade, comunicação ampla e conhecimento geral.",
          "Hipóteses de emprego institucional.",
        ],
      },
      {
        topic: "6.8 — Atos de serviço",
        details: [
          "Definição dos atos de serviço.",
          "Finalidade operacional/administrativa ligada à execução de serviço.",
          "Hipóteses de utilização no cotidiano da Corporação.",
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
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-sm md:text-base text-foreground leading-tight">{d.title}</h2>
            {d.comingSoon && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-bold uppercase tracking-wide shrink-0">
                <Clock className="w-3 h-3" />
                Em breve
              </span>
            )}
          </div>
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
              {d.comingSoon ? (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    <strong>Conteúdo em preparação.</strong> Esta disciplina já consta no novo edital
                    do CHOA 2026. Estamos produzindo o texto de referência, as questões e os materiais.
                    O conteúdo programático abaixo já está disponível para você se planejar.
                  </p>
                </div>
              ) : (
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

                  <button
                    onClick={() => navigate(`/mapas-mentais?disciplina=${encodeURIComponent(d.id)}`)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                  >
                    <Brain className="w-4 h-4" />
                    Mapas Mentais
                  </button>

                  <button
                    onClick={() => navigate(`/bizuaula?disciplina=${encodeURIComponent(d.id)}`)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" />
                    BizuAula
                  </button>
                </div>
              )}

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
            Conteúdo programático detalhado por disciplina — CHOA 2026 (novo edital)
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
