// Edital Verticalizado — CHOA BM 2026 (CBMTO)
// Fonte: Edital nº 1/2026/GABCOM, de 2 de julho de 2026 (Anexo III — Conteúdo
// Programático), com a retificação do Edital nº 7/2026/DEP, de 15/07/2026
// (novos recortes do Manual de APH do CBMTO).

export type EditalItemData = {
  topic: string;
  details: string[];
};

export type IconKey =
  | "gavel"
  | "fileCheck"
  | "flame"
  | "graduation"
  | "network"
  | "heartPulse"
  | "mountain"
  | "waves"
  | "lifeBuoy"
  | "landmark";

export type DisciplinaEditalData = {
  id: string;
  iconKey: IconKey;
  title: string;
  subtitle: string;
  color: string;
  disciplinaFilter: string;
  leiSecaUrl: string;
  leiSecaLabel: string;
  videoAulaUrl: string;
  videoAulaLabel: string;
  comingSoon?: boolean;
  restricted?: boolean;
  items: EditalItemData[];
};

export const navLabelsCbmto: Record<string, string> = {
  cpm: "CPM",
  cppm: "CPPM",
  redacao: "Redação Oficial",
  incendio: "Incêndio Urbano",
  npce: "NPCE",
  sci: "SCI",
  aph: "APH",
  "salvamento-altura": "Salv. Altura",
  "salvamento-aquatico": "Salv. Aquático",
  "salvamento-terrestre": "Salv. Terrestre",
  estatuto: "Lei 2.578/2012",
  "organizacao-cbmto": "LC 131/2021",
  promocoes: "Lei 2.665/2012",
  coscie: "Lei 3.798/2021",
};

export const disciplinasCbmto: DisciplinaEditalData[] = [
  {
    id: "cpm",
    iconKey: "gavel",
    title: "CPM — Código Penal Militar",
    subtitle: "Decreto-Lei nº 1.001/1969 • 2 questões",
    color: "from-red-500/20 to-red-600/20",
    disciplinaFilter: "CPM — Código Penal Militar",
    leiSecaUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm",
    leiSecaLabel: "CPM — Decreto-Lei nº 1.001/1969",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "CPM — Da aplicação da Lei Penal Militar (art. 1º a 28)",
        details: [
          "Princípio da legalidade, lei supressiva de incriminação e lei mais benigna.",
          "Tempo e lugar do crime; territorialidade e extraterritorialidade da lei penal militar.",
          "Crime militar em tempo de paz (art. 9º) e em tempo de guerra (art. 10).",
          "Contagem de prazos, frações não computáveis e legislação especial.",
          "Equiparação a militar da ativa, defeito de incorporação e conceito de superior.",
        ],
      },
      {
        topic: "CPM — Do crime (art. 29 a 47)",
        details: [
          "Relação de causalidade, crime consumado e tentativa; desistência voluntária e arrependimento eficaz.",
          "Crime impossível, dolo e culpa; erro de fato, erro de direito e coação irresistível.",
          "Exclusão de crime: legítima defesa, estado de necessidade, estrito cumprimento do dever legal.",
          "Excesso culposo e escusável; obediência hierárquica e cumprimento de ordem.",
          "Concurso de agentes, coautoria e circunstâncias agravantes e atenuantes.",
        ],
      },
      {
        topic: "CPM — Crimes contra a autoridade ou disciplina militar (art. 149 a 182)",
        details: [
          "Motim, revolta, conspiração e organização de grupo para a prática de violência.",
          "Violência contra superior e contra militar de serviço; desrespeito a superior.",
          "Recusa de obediência, oposição a ordem de sentinela e reunião ilícita.",
          "Publicação ou crítica indevida; resistência mediante ameaça ou violência.",
          "Fuga, evasão, arrebatamento de preso e amotinamento.",
        ],
      },
      {
        topic: "CPM — Crimes contra o serviço militar e o dever militar (art. 183 a 204)",
        details: [
          "Insubmissão, criação de incapacidade e substituição de convocado.",
          "Deserção: modalidades, casos assemelhados e concerto para deserção.",
          "Deserção especial, favorecimento a desertor e omissão de oficial.",
          "Abandono de posto, descumprimento de missão e retenção indevida.",
          "Dormir em serviço, embriaguez em serviço e exercício de comércio por oficial.",
        ],
      },
      {
        topic: "CPM — Crimes contra a administração militar (art. 298 a 339)",
        details: [
          "Desacato a superior, a militar e a assemelhado ou funcionário.",
          "Peculato, peculato-furto, peculato mediante erro de outrem e apropriação.",
          "Concussão, excesso de exação, corrupção passiva e corrupção ativa.",
          "Prevaricação, violação de sigilo funcional e extravio de documento.",
          "Falsificação de documento, certidão ou atestado e uso de documento falso.",
        ],
      },
    ],
  },
  {
    id: "cppm",
    iconKey: "gavel",
    title: "CPPM — Código de Processo Penal Militar",
    subtitle: "Decreto-Lei nº 1.002/1969 • 2 questões",
    color: "from-rose-500/20 to-rose-600/20",
    disciplinaFilter: "CPPM — Código de Processo Penal Militar",
    leiSecaUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm",
    leiSecaLabel: "CPPM — Decreto-Lei nº 1.002/1969",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "CPPM — Lei de Processo Penal Militar e sua aplicação (art. 1º a 6º)",
        details: [
          "Aplicação da lei processual penal militar no tempo e no espaço.",
          "Interpretação e suprimento de lacunas; aplicação subsidiária da legislação comum.",
          "Casos de aplicação a militares e assemelhados; foro militar.",
        ],
      },
      {
        topic: "CPPM — Polícia Judiciária Militar (art. 7º e 8º)",
        details: [
          "Autoridades com atribuições de polícia judiciária militar e delegação.",
          "Competência das autoridades por âmbito de comando e vinculação territorial.",
          "Atribuições da polícia judiciária militar: apuração, prisão, requisições e diligências.",
        ],
      },
      {
        topic: "CPPM — Inquérito Policial Militar (art. 9º a 28)",
        details: [
          "Conceito, finalidade e características do IPM: sigiloso, escrito e inquisitorial.",
          "Início do IPM: de ofício, por determinação superior, requisição e representação.",
          "Prazos de conclusão (20 e 40 dias) e prorrogação.",
          "Providências do encarregado, autos de prisão, perícias e oitivas.",
          "Relatório, solução, arquivamento e reabertura do inquérito.",
        ],
      },
      {
        topic: "CPPM — Prisão em flagrante e processos de deserção (art. 243 a 253 e 451 a 457)",
        details: [
          "Espécies de flagrante e sujeitos que podem efetuar a prisão.",
          "Auto de prisão em flagrante: lavratura, prazos, formalidades e nota de culpa.",
          "Relaxamento da prisão ilegal e comunicação à autoridade competente.",
          "Processo de deserção de oficial: termo, instrução e julgamento.",
          "Processo de deserção de praça com ou sem graduação e de praça especial.",
        ],
      },
    ],
  },
  {
    id: "redacao",
    iconKey: "fileCheck",
    title: "Redação Oficial",
    subtitle: "Manual de Redação Oficial da Presidência — Capítulos I e II • 3 questões",
    color: "from-slate-500/20 to-slate-600/20",
    disciplinaFilter: "Redação Oficial",
    leiSecaUrl:
      "https://www4.planalto.gov.br/centrodeestudos/assuntos/manual-de-redacao-da-presidencia-da-republica/manual-de-redacao.pdf",
    leiSecaLabel: "Manual de Redação Oficial da Presidência da República",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Capítulo I — Aspectos gerais da redação oficial",
        details: [
          "Conceito e finalidade da redação oficial; o que é comunicação oficial.",
          "Atributos: clareza, precisão, objetividade, concisão, coesão e coerência.",
          "Impessoalidade, formalidade, padronização e uso da norma culta.",
          "Emprego dos pronomes de tratamento, vocativos e endereçamento.",
          "Concordância com os pronomes de tratamento e fechos de comunicação.",
        ],
      },
      {
        topic: "Capítulo II — As comunicações oficiais",
        details: [
          "Padrão ofício: partes do documento, estrutura, formatação e diagramação.",
          "Identificação do expediente, local e data, assunto, texto e fecho.",
          "Identificação do signatário, numeração de parágrafos e siglas.",
          "Ofício, aviso e memorando: unificação no padrão ofício.",
          "Exposição de motivos, mensagem, correio eletrônico e sua validade.",
        ],
      },
    ],
  },
  {
    id: "incendio",
    iconKey: "flame",
    title: "Combate a Incêndio Urbano",
    subtitle: "Manual Básico de Combate a Incêndio — CBMDF, 2. ed. • 5 questões",
    color: "from-orange-500/20 to-orange-600/20",
    disciplinaFilter: "Combate a Incêndio Urbano",
    leiSecaUrl: "https://www.cbm.df.gov.br/manuais-operacionais/",
    leiSecaLabel: "Manual Básico de Combate a Incêndio — CBMDF",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Módulo 1 — Comportamento do fogo",
        details: [
          "Teoria do fogo: triângulo e tetraedro; combustível, comburente, calor e reação em cadeia.",
          "Transferência de calor: condução, convecção, irradiação e contato direto.",
          "Pontos de fulgor, combustão e ignição; limites de inflamabilidade.",
          "Classes de incêndio (A, B, C, D, K) e agentes extintores adequados.",
          "Fases do incêndio em ambiente confinado e propagação.",
        ],
      },
      {
        topic: "Módulo 2 — Efeitos nocivos do incêndio",
        details: [
          "Produtos da combustão: fumaça, gases tóxicos, chama e calor.",
          "Efeitos fisiológicos: intoxicação, asfixia, queimaduras e pânico.",
          "Fenômenos térmicos: flashover, backdraft, boilover e BLEVE.",
          "Sinais de alerta e medidas de segurança para a guarnição.",
          "Riscos estruturais e colapso de edificações.",
        ],
      },
      {
        topic: "Módulo 3 — Técnicas de combate a incêndio",
        details: [
          "Métodos de extinção: resfriamento, abafamento, isolamento e quebra da reação em cadeia.",
          "Linhas de ataque, jatos (sólido, neblinado, leque) e manejo de esguichos.",
          "Ataque direto, indireto e combinado; ventilação tática.",
          "Estabelecimento, mangueiras, conexões e cálculo básico de vazão.",
          "Rescaldo, resfriamento final e preservação do local para perícia.",
        ],
      },
    ],
  },
  {
    id: "npce",
    iconKey: "graduation",
    title: "Normas para o Planejamento e Conduta do Ensino (NPCE)",
    subtitle: "Anexo I à Portaria nº 13/2024/DEP • 5 questões",
    color: "from-blue-500/20 to-blue-600/20",
    disciplinaFilter: "NPCE",
    leiSecaUrl: "https://www.to.gov.br/bombeiros/portarias-e-instrucoes-normativas/3l5oq8pmf3dx",
    leiSecaLabel: "Portaria nº 13/2024/DEP — NPCE",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Título I, Capítulo IV",
        details: [
          "Organização do sistema de ensino do CBMTO e finalidades.",
          "Competências dos órgãos de direção, apoio e execução do ensino.",
          "Princípios que regem o planejamento educacional da Corporação.",
        ],
      },
      {
        topic: "Título II, Capítulos I, II e V",
        details: [
          "Planejamento e execução das atividades de ensino.",
          "Cursos, estágios e atividades de capacitação: classificação e requisitos.",
          "Matrícula, trancamento, desligamento e aproveitamento de estudos.",
        ],
      },
      {
        topic: "Título II, Capítulos IX, XI, XII e XIII",
        details: [
          "Avaliação da aprendizagem: instrumentos, verificações e notas.",
          "Grau final, média mínima, recuperação e segunda chamada.",
          "Frequência, faltas, dispensas e limites regulamentares.",
          "Recursos e pedidos de revisão de avaliação.",
        ],
      },
      {
        topic: "Título II, Capítulos XIV, XV (exceto a seção única) e XVI",
        details: [
          "Conselho de ensino e comissões avaliadoras.",
          "Conduta discente, disciplina escolar e desligamento do curso.",
          "Certificação, diplomas, histórico escolar e classificação final.",
        ],
      },
      {
        topic: "Título III, Capítulo III",
        details: [
          "Corpo docente e instrutores: requisitos, seleção e atribuições.",
          "Planejamento didático, plano de disciplina e plano de aula.",
          "Documentação escolar e escrituração das atividades de ensino.",
        ],
      },
    ],
  },
  {
    id: "sci",
    iconKey: "network",
    title: "Sistema de Comando de Incidentes (SCI)",
    subtitle: "MOB SCI — CBMGO • 5 questões",
    color: "from-cyan-500/20 to-cyan-600/20",
    disciplinaFilter: "Sistema de Comando de Incidentes",
    leiSecaUrl: "https://www.bombeiros.go.gov.br/legislacao/manuais-de-bombeiros/manuais-de-bombeiros.html",
    leiSecaLabel: "MOB SCI — CBMGO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Capítulo 1 — Conceito e histórico do SCI",
        details: [
          "Origem do SCI e evolução histórica do sistema.",
          "Conceito, finalidade e aplicabilidade em incidentes de qualquer porte.",
          "Problemas comuns na gestão de incidentes que o SCI busca resolver.",
        ],
      },
      {
        topic: "Capítulo 2 — Princípios do SCI",
        details: [
          "Terminologia comum, organização modular e cadeia de comando.",
          "Amplitude de controle, comando unificado e transferência de comando.",
          "Plano de ação do incidente, comunicação integrada e cadeia logística.",
        ],
      },
      {
        topic: "Capítulo 3 — Instalações do SCI",
        details: [
          "Posto de comando, área de espera, base, acampamento e helibase.",
          "Área de concentração de vítimas e demais instalações padronizadas.",
          "Simbologia, sinalização e critérios de escolha das instalações.",
        ],
      },
      {
        topic: "Capítulo 4 — Estrutura organizacional do SCI",
        details: [
          "Comando e staff de comando: segurança, informação e ligação.",
          "Seções de operações, planejamento, logística e administração/finanças.",
          "Ramos, divisões, grupos, forças-tarefa, equipes de intervenção e recursos únicos.",
        ],
      },
      {
        topic: "Capítulo 5 — Ciclo de planejamento operacional",
        details: [
          "Etapas do planejamento e reunião de planejamento (planning P).",
          "Definição de objetivos, estratégias e táticas do incidente.",
          "Períodos operacionais, avaliação e revisão do plano.",
        ],
      },
      {
        topic: "Capítulo 6 — Instrumentos de consulta e registros",
        details: [
          "Formulários do SCI e sua finalidade.",
          "Registro de recursos, controle de pessoal e documentação do incidente.",
          "Relatórios e desmobilização.",
        ],
      },
    ],
  },
  {
    id: "aph",
    iconKey: "heartPulse",
    title: "Atendimento Pré-Hospitalar (APH)",
    subtitle: "Manual de APH do CBMTO, 2021 — recorte do Edital nº 7/2026/DEP • 5 questões",
    color: "from-rose-500/20 to-rose-600/20",
    disciplinaFilter: "Atendimento Pré-Hospitalar",
    leiSecaUrl: "https://intranet.bombeiros.to.gov.br/",
    leiSecaLabel: "Manual de APH — CBMTO (BG nº 1377/2021)",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Capítulo 2 — A ocorrência",
        details: [
          "Fases da ocorrência de APH e acionamento da guarnição.",
          "Segurança da cena, dimensionamento e avaliação do local.",
          "Biossegurança, EPI e controle de riscos.",
        ],
      },
      {
        topic: "Capítulo 4 — Biomecânica do trauma",
        details: [
          "Cinemática do trauma e transferência de energia.",
          "Colisões: frontal, traseira, lateral, capotamento e ejeção.",
          "Trauma por queda, arma branca, arma de fogo e explosões.",
        ],
      },
      {
        topic: "Capítulo 5 — Avaliação geral do paciente",
        details: [
          "Avaliação primária (XABCDE) e identificação de ameaças à vida.",
          "Avaliação secundária, exame físico e sinais vitais.",
          "Escala de coma de Glasgow, histórico SAMPLE e reavaliação.",
        ],
      },
      {
        topic: "Capítulo 6 — Ressuscitação cardiopulmonar",
        details: [
          "Cadeia de sobrevivência e reconhecimento da PCR.",
          "Compressões torácicas, ventilações e uso do DEA.",
          "RCP em adulto, criança e lactente; OVACE.",
        ],
      },
      {
        topic: "Capítulo 9 — Ferimentos em tecidos moles",
        details: [
          "Tipos de ferimentos: abrasão, laceração, avulsão, perfuração e amputação.",
          "Hemorragias e técnicas de controle: pressão direta, curativo compressivo e torniquete.",
          "Curativos, bandagens e cuidados com evisceração e objetos empalados.",
        ],
      },
      {
        topic: "Capítulo 10 — Esqueleto humano",
        details: [
          "Anatomia óssea, articulações e regiões corporais.",
          "Fraturas, luxações e entorses: sinais, sintomas e imobilização.",
          "Materiais de imobilização e cuidados no manuseio.",
        ],
      },
      {
        topic: "Capítulo 11 — Esqueleto axial",
        details: [
          "Coluna vertebral, crânio e caixa torácica.",
          "Trauma raquimedular: suspeita, restrição de movimento e rolamento.",
          "Uso de prancha longa, colar cervical e imobilizadores de cabeça.",
        ],
      },
      {
        topic: "Capítulo 13 — Queimaduras e emergências ambientais",
        details: [
          "Classificação das queimaduras por grau, extensão (regra dos nove) e gravidade.",
          "Queimaduras térmicas, químicas, elétricas e por radiação; atendimento inicial.",
          "Emergências por calor e frio: intermação, exaustão, hipotermia e congelamento.",
        ],
      },
      {
        topic: "Capítulo 17 — Parto emergencial",
        details: [
          "Anatomia da gestação e sinais do trabalho de parto.",
          "Materiais, preparação e assistência ao parto normal emergencial.",
          "Cuidados com o recém-nascido, dequitação e complicações obstétricas.",
        ],
      },
      {
        topic: "Capítulo 23 — Afogamento e acidentes de mergulho",
        details: [
          "Graus de afogamento e conduta em cada grau.",
          "Atendimento inicial, ventilação e RCP na vítima de afogamento.",
          "Acidentes de mergulho: barotraumas e doença descompressiva.",
        ],
      },
    ],
  },
  {
    id: "salvamento-altura",
    iconKey: "mountain",
    title: "Salvamento em Altura",
    subtitle: "Manual de Salvamento em Altura, vol. I — CBPMSP • 5 questões",
    color: "from-violet-500/20 to-violet-600/20",
    disciplinaFilter: "Salvamento em Altura",
    leiSecaUrl: "https://intranet.bombeiros.to.gov.br/",
    leiSecaLabel: "Manual de Salvamento em Altura, vol. I — CBPMSP",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Capítulo 11 — Sistema de vantagem mecânica",
        details: [
          "Conceito de vantagem mecânica teórica e real; perdas por atrito.",
          "Sistemas simples, compostos e complexos (2:1, 3:1, 4:1, 5:1, 9:1).",
          "Montagem, contagem de vantagem e emprego de polias e bloqueadores.",
        ],
      },
      {
        topic: "Capítulo 14 — Introdução ao salvamento em torres metálicas",
        details: [
          "Tipos de torres, riscos específicos e avaliação preliminar.",
          "Progressão, ancoragens e proteção contra quedas na estrutura.",
          "Técnicas de resgate do acidentado em altura.",
        ],
      },
      {
        topic: "Capítulo 15 — Introdução à gestão tática",
        details: [
          "Análise da ocorrência, planejamento e definição de estratégias.",
          "Funções da equipe de salvamento em altura e segurança operacional.",
          "Comunicação, comandos padronizados e checagem de sistemas.",
        ],
      },
      {
        topic: "Capítulo 16 — Amarração de maca cesto e maca envelope",
        details: [
          "Características das macas cesto e envelope e seus acessórios.",
          "Fixação da vítima, ponto de içamento e balanceamento da maca.",
          "Transporte horizontal e vertical; acompanhamento por socorrista.",
        ],
      },
      {
        topic: "Capítulo 18 — Introdução ao salvamento técnico em espaço confinado",
        details: [
          "Conceito de espaço confinado e classificação de riscos.",
          "Monitoramento atmosférico, ventilação e permissão de entrada.",
          "Sistemas de acesso, resgate e proteção respiratória.",
        ],
      },
    ],
  },
  {
    id: "salvamento-aquatico",
    iconKey: "waves",
    title: "Salvamento Aquático",
    subtitle: "MOB Guarda-Vidas — CBMGO • 5 questões",
    color: "from-sky-500/20 to-sky-600/20",
    disciplinaFilter: "Salvamento Aquático",
    leiSecaUrl: "https://www.bombeiros.go.gov.br/legislacao/manuais-de-bombeiros/manuais-de-bombeiros.html",
    leiSecaLabel: "MOB Guarda-Vidas — CBMGO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Capítulo 4 — Equipamentos e materiais de salvamento aquático",
        details: [
          "Flutuadores, boias, cordas, nadadeiras e pranchas de salvamento.",
          "Embarcações, motos aquáticas e equipamentos de proteção individual.",
          "Conservação, inspeção e emprego correto de cada material.",
        ],
      },
      {
        topic: "Capítulo 6 — Tipos de acidentes na água",
        details: [
          "Afogamento primário e secundário; classificação por grau.",
          "Correntes de retorno, bancos de areia, hidráulicas e riscos em rios e represas.",
          "Acidentes com embarcações, mergulho livre e traumas na água.",
        ],
      },
      {
        topic: "Capítulo 9 — Fases do salvamento aquático",
        details: [
          "Reconhecimento, entrada na água, aproximação e abordagem da vítima.",
          "Domínio da vítima, formas de reboque e retirada da água.",
          "Atendimento pós-resgate e encaminhamento ao APH.",
        ],
      },
    ],
  },
  {
    id: "salvamento-terrestre",
    iconKey: "lifeBuoy",
    title: "Salvamento Terrestre",
    subtitle: "MOB Salvamento Terrestre — CBMGO • 5 questões",
    color: "from-emerald-500/20 to-emerald-600/20",
    disciplinaFilter: "Salvamento Terrestre",
    leiSecaUrl: "https://www.bombeiros.go.gov.br/legislacao/manuais-de-bombeiros/manuais-de-bombeiros.html",
    leiSecaLabel: "MOB Salvamento Terrestre — CBMGO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Capítulo 1 — Materiais e equipamentos",
        details: [
          "Cordas, fitas, mosquetões, polias, freios e bloqueadores.",
          "Cadeirinhas, capacetes e EPI de salvamento.",
          "Resistência, carga de trabalho, inspeção e vida útil dos materiais.",
        ],
      },
      {
        topic: "Capítulo 2 — Nós e amarrações",
        details: [
          "Classificação dos nós e requisitos de segurança.",
          "Nós de união, de fixação, de arremate e de meio de corda.",
          "Ancoragens simples, compostas e equalizadas.",
        ],
      },
      {
        topic: "Capítulo 3 — Contenção de animais",
        details: [
          "Riscos e princípios de segurança no manejo de animais.",
          "Equipamentos de contenção física e técnicas empregadas.",
          "Captura de animais sinantrópicos, silvestres e domésticos.",
        ],
      },
      {
        topic: "Capítulo 4 — Operações envolvendo árvores",
        details: [
          "Avaliação da árvore, riscos e isolamento da área.",
          "Técnicas de corte, direcionamento de queda e uso de motosserra.",
          "Resgate de pessoas e animais em árvores.",
        ],
      },
      {
        topic: "Capítulo 5 — Atendimento a pessoas retidas ou presas em elevador",
        details: [
          "Tipos de elevadores, componentes e dispositivos de segurança.",
          "Procedimentos de desligamento, travamento e comunicação com as vítimas.",
          "Técnicas de abertura de portas e retirada segura das pessoas.",
        ],
      },
      {
        topic: "Capítulo 6 — Sistemas multiplicadores de força",
        details: [
          "Vantagem mecânica: sistemas 2:1, 3:1 e compostos.",
          "Montagem, ancoragem e controle de tensão.",
          "Segurança do sistema, redundância e fator de queda.",
        ],
      },
      {
        topic: "Capítulo 7 — Operações em espaço confinado",
        details: [
          "Identificação e classificação de espaços confinados.",
          "Atmosfera IPVS, monitoramento de gases e ventilação.",
          "Equipe mínima, permissão de entrada e técnicas de resgate.",
        ],
      },
      {
        topic: "Capítulo 9 — Salvamento com escadas",
        details: [
          "Tipos de escadas: prolongável, de ganchos, portátil e mecânica.",
          "Transporte, levantamento, posicionamento e ângulo de segurança.",
          "Técnicas de salvamento e evacuação com escadas.",
        ],
      },
    ],
  },
  {
    id: "legislacao",
    iconKey: "landmark",
    title: "Legislação Específica",
    subtitle: "Lei nº 2.578/2012, LC nº 131/2021, Lei nº 2.665/2012 e Lei nº 3.798/2021 • 8 questões",
    color: "from-amber-500/20 to-amber-600/20",
    disciplinaFilter: "Legislação Específica",
    leiSecaUrl: "https://www.to.gov.br/bombeiros/leis-estaduais/5scoko7cf3s4",
    leiSecaLabel: "Leis estaduais — CBMTO",
    videoAulaUrl: "",
    videoAulaLabel: "",
    items: [
      {
        topic: "Lei nº 2.578/2012 — Estatuto dos Militares Estaduais do TO",
        details: [
          "Ingresso, situações do militar e conceitos legais.",
          "Hierarquia, disciplina, círculos hierárquicos e precedência.",
          "Obrigações, ética, valor militar e vedações.",
          "Transgressões disciplinares, sindicância e conselhos.",
          "Direitos, remuneração, inatividade e prerrogativas.",
        ],
      },
      {
        topic: "LC nº 131/2021 — Organização Básica do CBMTO",
        details: [
          "Competências institucionais e missão do CBMTO.",
          "Estrutura organizacional: órgãos de direção, apoio e execução.",
          "Comando-Geral, Estado-Maior, diretorias e unidades operacionais.",
          "Quadros de militares, efetivo e disposições finais.",
        ],
      },
      {
        topic: "Lei nº 2.665/2012 — Promoções no CBMTO",
        details: [
          "Princípios, critérios e requisitos gerais de promoção.",
          "Quadros de acesso, comissões de promoção e interstícios.",
          "Promoção por antiguidade, merecimento, bravura e post mortem.",
          "Art. 61 — ingresso no QOA e requisitos do CHOA.",
        ],
      },
      {
        topic: "Lei nº 3.798/2021 — Código de Segurança Contra Incêndio e Emergência",
        details: [
          "Capítulo I — disposições iniciais e abrangência.",
          "Capítulo II — definições técnicas.",
          "Capítulo III, seção 2 — competência do CBMTO.",
          "Capítulo VI — dos projetos técnicos.",
          "Capítulo VII — vistoria e emissão de alvarás.",
          "Capítulo VIII — irregularidades e fiscalização.",
          "Capítulo IV — sanções administrativas.",
          "Capítulo XII — disposições finais.",
        ],
      },
    ],
  },
];
