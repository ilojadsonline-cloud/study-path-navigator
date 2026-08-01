import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import {
  BookOpen, ChevronDown, ChevronUp, ChevronRight, ExternalLink, PlayCircle, FileText,
  Shield, Gavel, BookMarked, Landmark, BadgeCheck, Layers, ChevronsDownUp, ChevronsUpDown,
  ClipboardList, FileCheck, Brain, Target, Clock, Lock, Download, Scroll
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  type EditalMaterialEntry,
  createEditalMaterialSignedUrl,
  loadEditalMaterialsConfig,
} from "@/lib/edital-materials";
import { ANALISE_EDITAL_DISC } from "@/lib/edital-structure";
import { useCurso } from "@/contexts/CursoContext";
import { disciplinasCbmto, type IconKey } from "@/lib/edital-verticalizado-cbmto";
import { Flame, GraduationCap, Network, HeartPulse, Mountain, Waves, LifeBuoy } from "lucide-react";

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

const disciplinasPmto: Disciplina[] = [
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
    subtitle: "Procedimento Operacional Padrão • Documento sigiloso",
    color: "from-cyan-500/20 to-cyan-600/20",
    disciplinaFilter: "POP",
    restricted: true,
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

const CBMTO_ICONS: Record<IconKey, React.ReactNode> = {
  gavel: <Gavel className="w-5 h-5" />,
  fileCheck: <FileCheck className="w-5 h-5" />,
  flame: <Flame className="w-5 h-5" />,
  graduation: <GraduationCap className="w-5 h-5" />,
  network: <Network className="w-5 h-5" />,
  heartPulse: <HeartPulse className="w-5 h-5" />,
  mountain: <Mountain className="w-5 h-5" />,
  waves: <Waves className="w-5 h-5" />,
  lifeBuoy: <LifeBuoy className="w-5 h-5" />,
  landmark: <Landmark className="w-5 h-5" />,
};

const disciplinasCbmtoView: Disciplina[] = disciplinasCbmto.map((d) => ({
  ...d,
  icon: CBMTO_ICONS[d.iconKey] ?? <BookOpen className="w-5 h-5" />,
}));

function getDisciplinasEdital(cursoSlug?: string | null): Disciplina[] {
  return (cursoSlug || "pmto").toLowerCase() === "cbmto" ? disciplinasCbmtoView : disciplinasPmto;
}


// Rótulos curtos para a navegação rápida
const navLabels: Record<string, string> = {
  estatuto: "Estatuto",
  promocoes: "Promoções",
  organizacao: "Organização",
  cppm: "CPPM",
  rdmeto: "RDMETO",
  pop: "POP",
  portugues: "Português",
  redacao: "Redação Oficial",
};

// Extrai o "Peso N" do subtítulo, devolvendo um subtítulo limpo
function parseSubtitle(subtitle: string): { peso: number | null; clean: string } {
  const match = subtitle.match(/Peso\s+(\d+)/i);
  const peso = match ? parseInt(match[1], 10) : null;
  const clean = subtitle.replace(/\s*•\s*Peso\s+\d+/i, "").trim();
  return { peso, clean };
}

function TopicItem({ item }: { item: EditalItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl bg-secondary/40 border border-border/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-secondary/60 transition-colors"
      >
        <BookMarked className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 font-semibold text-sm text-foreground leading-snug">{item.topic}</span>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-background/40 text-[10px] font-medium text-muted-foreground shrink-0">
          {item.details.length} itens
        </span>
        <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-90 text-primary" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <ul className="px-4 pb-4 pt-1 space-y-2 border-t border-border/30">
              {item.details.map((detail, j) => (
                <li key={j} className="text-xs text-muted-foreground flex items-start gap-2.5 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                  {detail}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

async function openMaterialEntry(entry: EditalMaterialEntry) {
  if (entry.storagePath) {
    try {
      const url = await createEditalMaterialSignedUrl(entry.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* falha silenciosa: o material não pôde ser aberto agora */
    }
    return;
  }
  if (entry.externalUrl) {
    window.open(entry.externalUrl, "_blank", "noopener,noreferrer");
  }
}

function materialIcon(entry: EditalMaterialEntry) {
  if (entry.mode === "pdf") return Download;
  if (entry.mode === "lei_seca") return entry.storagePath ? Download : Scroll;
  return ExternalLink;
}

// Lista numerada de materiais (um abaixo do outro, com título).
function MaterialList({ entries }: { entries: EditalMaterialEntry[] }) {
  if (entries.length === 0) {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-dashed border-amber-500/30 text-amber-500 text-xs font-semibold cursor-default">
        <Clock className="w-4 h-4" />
        Material em breve
      </span>
    );
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry, idx) => {
        const Icon = materialIcon(entry);
        return (
          <li key={entry.id}>
            <button
              onClick={() => openMaterialEntry(entry)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors text-left"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold">
                {idx + 1}
              </span>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                {entry.buttonLabel || (entry.mode === "lei_seca" ? "Lei Seca atualizada" : "Material de estudo")}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function DisciplinaBlock({
  d,
  index,
  open,
  onToggle,
  materials,
  restrictedUnlocked = false,
}: {
  d: Disciplina;
  index: number;
  open: boolean;
  onToggle: () => void;
  materials: EditalMaterialEntry[];
  restrictedUnlocked?: boolean;
}) {
  const navigate = useNavigate();
  const { peso, clean } = parseSubtitle(d.subtitle);

  // Lei Seca enviada pelo admin substitui o link fixo (ex.: "Lei nº 2.578").
  const leiSecaEntry = materials.find((m) => m.mode === "lei_seca") ?? null;
  // Demais materiais entram na lista numerada (links, vídeos, PDFs).
  const otherMaterials = materials.filter((m) => m.mode !== "lei_seca");


  return (
    <motion.div
      id={`disc-${d.id}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="glass-card rounded-2xl overflow-hidden border border-border/50 scroll-mt-20"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center shrink-0`}>
          {d.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-sm md:text-base text-foreground leading-tight">{d.title}</h2>
            {d.restricted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-[10px] font-bold uppercase tracking-wide shrink-0">
                <Lock className="w-3 h-3" />
                Sigiloso
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{clean}</p>
        </div>
        {peso != null && (
          <span className="hidden sm:inline-flex flex-col items-center justify-center px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <span className="text-sm font-black text-primary leading-none">{peso}</span>
            <span className="text-[9px] uppercase tracking-wide text-primary/70 mt-0.5">peso</span>
          </span>
        )}
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 space-y-4">
              {d.restricted ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                    <Lock className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed space-y-2">
                      <p>
                        <strong>Conteúdo sigiloso — acesso restrito.</strong> Em respeito ao caráter
                        sigiloso do documento, o material do POP só é disponibilizado a militares
                        autorizados, em conformidade com a normativa interna da PMTO.
                      </p>
                      <p className="text-muted-foreground">
                        Fundamento: <strong>Portaria nº 021/2015-Gab.</strong> (PMTO — Quartel do Comando
                        Geral), que atribui grau sigiloso <strong>RESERVADO</strong> ao Manual do
                        Procedimento Operacional Padrão (POP) e regula sua divulgação, com base no art. 10
                        da Lei Complementar nº 79/2012 e nos arts. 24 e 27, III c/c art. 45 da Lei nº
                        12.527/2011. Toda publicação ou reprodução, total ou parcial, depende de
                        autorização do Comandante-Geral, restringindo-se o acesso à comunidade policial
                        militar e setores afins.
                      </p>
                    </div>
                  </div>
                  {restrictedUnlocked && (
                    <button
                      onClick={() => navigate("/pop-questoes")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-gold text-gold-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      <BookOpen className="w-4 h-4" />
                      Questões POP (acesso autorizado)
                    </button>
                  )}
                </div>
              ) : d.comingSoon ? (
                <div className="space-y-3">
                  <MaterialList entries={otherMaterials} />
                </div>

              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {leiSecaEntry ? (
                      <button
                        onClick={() => openMaterialEntry(leiSecaEntry)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                      >
                        {leiSecaEntry.storagePath ? <Download className="w-4 h-4" /> : <Scroll className="w-4 h-4" />}
                        {leiSecaEntry.buttonLabel || d.leiSecaLabel || "Lei Seca atualizada"}
                      </button>
                    ) : (
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
                    )}

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

                  {otherMaterials.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        Materiais de estudo
                      </div>
                      <MaterialList entries={otherMaterials} />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Conteúdo programático
                <span className="text-muted-foreground/50 normal-case font-normal">• toque para expandir cada tópico</span>
              </div>

              <div className="space-y-2.5">
                {d.items.map((item, i) => (
                  <TopicItem key={i} item={item} />
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
  const { cursoSlug } = useCurso();
  const disciplinas = useMemo(() => getDisciplinasEdital(cursoSlug), [cursoSlug]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set([disciplinas[0].id]));

  useEffect(() => {
    setOpenIds(new Set(disciplinas[0] ? [disciplinas[0].id] : []));
  }, [disciplinas]);
  const [materials, setMaterials] = useState<Record<string, EditalMaterialEntry[]>>({});

  useEffect(() => {
    let alive = true;
    loadEditalMaterialsConfig().then((config) => {
      if (alive) setMaterials(config.materials);
    });
    return () => {
      alive = false;
    };
  }, []);

  const allOpen = openIds.size === disciplinas.length;

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const expandAll = () => setOpenIds(new Set(disciplinas.map((d) => d.id)));
  const collapseAll = () => setOpenIds(new Set());

  const jumpTo = (id: string) => {
    setOpenIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      document.getElementById(`disc-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);
  };

  const totalDisponiveis = useMemo(
    () => disciplinas.filter((d) => !d.comingSoon && !d.restricted).length,
    [],
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <BackButton />

        {/* Cabeçalho */}
        <header className="glass-card rounded-2xl border border-border/50 p-5 sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary mb-3">
            <Shield className="w-3.5 h-3.5" />
            CHOA 2026 • Novo edital
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gradient-primary tracking-tight">
            Edital Verticalizado
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Conteúdo programático oficial por disciplina, organizado para leitura clara e acesso rápido
            aos materiais de estudo.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className="rounded-full border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground">
              {disciplinas.length} disciplinas
            </span>
            <span className="rounded-full border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground">
              {totalDisponiveis} disponíveis agora
            </span>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              Lei seca + questões + mapas
            </span>
          </div>
        </header>

        {/* Análise do Edital — material em destaque, fora dos blocos de disciplinas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl border border-gold/30 bg-gold/5 p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-gold/15 text-gold shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-foreground">Análise do Edital</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-xl">
                  Visão geral e estratégia de estudo do CHOA/2026 PMTO. Material consolidado para você
                  entender pesos, recortes e como priorizar cada disciplina.
                </p>
              </div>
            </div>
            <div className="shrink-0 w-full sm:w-auto sm:min-w-[240px]">
              <MaterialList entries={materials[ANALISE_EDITAL_DISC.id] ?? []} />
            </div>
          </div>
        </motion.div>



        {/* Navegação rápida */}
        <div className="glass-card rounded-2xl border border-border/50 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Navegação rápida
            </p>
            <button
              onClick={allOpen ? collapseAll : expandAll}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {allOpen ? <ChevronsDownUp className="w-3.5 h-3.5" /> : <ChevronsUpDown className="w-3.5 h-3.5" />}
              {allOpen ? "Recolher todas" : "Expandir todas"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {disciplinas.map((d) => (
              <button
                key={d.id}
                onClick={() => jumpTo(d.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
              >
                <span className="text-primary">{d.icon}</span>
                {navLabels[d.id] ?? d.title}
              </button>
            ))}
          </div>
        </div>

        {/* Disciplinas */}
        <div className="space-y-3">
          {disciplinas.map((d, i) => (
            <DisciplinaBlock
              key={d.id}
              d={d}
              index={i}
              open={openIds.has(d.id)}
              onToggle={() => toggle(d.id)}
              materials={materials[d.id] ?? []}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
