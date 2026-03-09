import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARTICLE_REGEX = /(?:art(?:igos?)?\.?\s*\d+|anexo\s+[ivxlcdm\d]+)/i;
const SINGLE_TOKEN_INVALID_ALT_REGEX = /^(?:a|b|c|d|e|um|dois|tr[eê]s|quatro|cinco|i|ii|iii|iv|v|1|2|3|4|5)$/i;
const ALT_KEYS = ["alt_a", "alt_b", "alt_c", "alt_d", "alt_e"] as const;

function normalizeWhitespace(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function stripAlternativePrefix(text: string): string {
  let cleaned = normalizeWhitespace(text);
  cleaned = cleaned.replace(/^(?:alternativa|opção|opcao|letra)\s*[a-e]\s*[:)\-.–]?\s*/i, "");
  cleaned = cleaned.replace(/^[a-e]\s*[:)\-.–]\s*/i, "");
  cleaned = cleaned.replace(/^(?:\d+|i{1,3}|iv|v|um|dois|tr[eê]s|quatro|cinco)\s*[:)\-.–]\s*/i, "");
  return normalizeWhitespace(cleaned);
}

function hasDuplicateAlternatives(alternatives: string[]): boolean {
  const normalized = alternatives.map((alt) => normalizeWhitespace(alt).toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

function sanitizeAndValidateQuestion(raw: any) {
  const sanitized: Record<string, any> = {
    disciplina: normalizeWhitespace(raw.disciplina),
    assunto: normalizeWhitespace(raw.assunto),
    dificuldade: normalizeWhitespace(raw.dificuldade),
    enunciado: normalizeWhitespace(raw.enunciado),
    comentario: normalizeWhitespace(raw.comentario),
    gabarito:
      typeof raw.gabarito === "number"
        ? Math.min(Math.max(raw.gabarito, 0), 4)
        : Math.min(Math.max(Number(raw.gabarito || 0), 0), 4),
  };

  for (const key of ALT_KEYS) {
    sanitized[key] = stripAlternativePrefix(raw[key]);
  }

  const alternatives = ALT_KEYS.map((k) => sanitized[k]);

  const issues: string[] = [];
  if (!sanitized.enunciado || sanitized.enunciado.length < 30) issues.push("Enunciado curto");
  if (!sanitized.comentario || !ARTICLE_REGEX.test(sanitized.comentario)) issues.push("Comentário sem artigo");

  alternatives.forEach((alt, index) => {
    if (!alt) issues.push(`Alt ${String.fromCharCode(65 + index)} vazia`);
    if (SINGLE_TOKEN_INVALID_ALT_REGEX.test(alt)) {
      issues.push(`Alt ${String.fromCharCode(65 + index)} inválida (${alt})`);
    }
  });

  if (hasDuplicateAlternatives(alternatives)) issues.push("Alternativas duplicadas");

  return { sanitized, issues };
}

// ── DISCIPLINE DEFINITIONS WITH LAW CONTENT REFERENCES ──
// Each discipline includes the exact legal source and key articles to ground the AI

const DISCIPLINES = [
  {
    disciplina: "Lei nº 2.578/2012",
    leiNome: "Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins",
    fonteUrl: "https://www.al.to.leg.br/arquivos/lei_2578-2012_66938.PDF",
    assuntos: [
      "Disposições Preliminares: conceito de policial militar, cargo, posto, graduação, situações de atividade e inatividade",
      "Ingresso, Hierarquia e Disciplina: condições de ingresso, círculos hierárquicos, ordem de precedência, graus hierárquicos",
      "Deveres, Obrigações e Direitos: compromisso militar, deveres militares, valor militar, ética e decoro, remuneração, estabilidade, férias, licenças",
      "Regime Disciplinar: transgressões e classificação, sanções, PAD, Conselho de Disciplina e Justificação, comportamento militar",
      "Movimentação e Lotação: classificação, reclassificação, transferências, permutas",
      "Afastamento e Licenciamento: agregação, licenciamento a pedido e ex officio, exclusão, demissão, reforma, reserva remunerada",
    ],
    leiSeca: `LEI Nº 2.578, DE 20 DE ABRIL DE 2012 - Estado do Tocantins.
CAPÍTULO I - DISPOSIÇÕES PRELIMINARES
Art. 1º A presente Lei regula o ingresso na Corporação, a relação jurídica funcional, os direitos, a ética, as obrigações, os deveres, as garantias e as prerrogativas dos Policiais Militares e dos Bombeiros Militares do Estado do Tocantins.
Art. 2º Os Policiais Militares e os Bombeiros Militares são membros das Forças Públicas Estaduais, que se encontrem em uma das seguintes situações: I – na ativa; II – na inatividade.
Art. 3º Os membros das Forças Públicas Estaduais, em razão de suas atividades funcionais, são denominados militares estaduais.

CAPÍTULO II - DO INGRESSO
Art. 7º O ingresso nos Quadros de Oficiais da PMTO e do CBMTO é feito por meio de concurso público de provas ou de provas e títulos.
Art. 8º O ingresso nos Quadros de Praças da PMTO e do CBMTO é feito por meio de concurso público.

CAPÍTULO III - DA HIERARQUIA E DA DISCIPLINA
Art. 12. A hierarquia militar é a ordenação da autoridade em níveis diferentes, por postos e graduações.
Art. 13. Disciplina militar é a rigorosa observância e o acatamento integral das leis, regulamentos, normas e disposições.
Art. 14. Os círculos hierárquicos são âmbitos de convivência entre os militares da mesma categoria.

CAPÍTULO IV - DOS DEVERES, OBRIGAÇÕES E DIREITOS
Art. 24. Os deveres militares emanam de um conjunto de vínculos racionais, bem como morais, que ligam o militar à Pátria e ao serviço.
Art. 25. São manifestações essenciais do valor militar: I – o patriotismo; II – o civismo; III – o culto às tradições históricas; IV – a fé na missão; V – o espírito de corpo; VI – o amor à profissão; VII – o aprimoramento técnico-profissional.
Art. 27. São direitos dos militares: I – estabilidade; II – remuneração; III – férias; IV – licenças.

CAPÍTULO V - REGIME DISCIPLINAR
Art. 43. Transgressão disciplinar é toda ação ou omissão contrária ao dever militar.
Art. 47. São sanções disciplinares aplicáveis aos militares estaduais: I – advertência; II – repreensão; III – detenção; IV – prisão disciplinar; V – licenciamento e exclusão a bem da disciplina.

CAPÍTULO VI - DA RESERVA REMUNERADA E DA REFORMA
Art. 85. A passagem do militar à situação de reserva remunerada será efetuada: I – a pedido; II – ex officio.
Art. 91. A reforma será aplicada ao militar que: I – atingir a idade limite de permanência na reserva; II – for julgado incapaz definitivamente para o serviço.`,
  },
  {
    disciplina: "LC nº 128/2021",
    leiNome: "Organização Básica da Polícia Militar do Estado do Tocantins",
    fonteUrl: "https://www.al.to.leg.br/arquivos/lei_128-2021_66731.PDF",
    assuntos: [
      "Destinação, Competências e Subordinação: missão constitucional, competências (Art. 2º), subordinação ao Governador (Art. 3º)",
      "Organização Básica - Estrutura Geral: unidades de direção, apoio, execução e especiais (Arts. 4º a 7º)",
      "Unidades de Direção: Comando-Geral, CHEM, SCHEM, Corregedoria, Estado Maior Geral, Estado Maior Especial, Comandos de Policiamento (Arts. 8º a 17)",
      "Unidades de Apoio: Gabinete CG, APMT, Ajudância-Geral, Assessorias (Arts. 18 a 21)",
      "Unidades de Execução: Batalhões, Companhias Independentes, unidades especializadas (Arts. 22 a 30)",
      "Disposições Gerais e Transitórias: efetivo, adequação da estrutura (Arts. 31 a 40)",
    ],
    leiSeca: `LEI COMPLEMENTAR Nº 128, DE 14 DE ABRIL DE 2021 - Estado do Tocantins.
Art. 1º A Polícia Militar do Estado do Tocantins-PMTO, Secretaria de Estado, instituição permanente, força auxiliar e reserva do Exército, organizada com base na hierarquia e na disciplina militares, destina-se à preservação da ordem pública e à realização do policiamento ostensivo no território do Estado do Tocantins.
Art. 2º Compete à PMTO: I - planejar, organizar, dirigir, supervisionar, coordenar, controlar e executar as ações de polícia ostensiva e de preservação da ordem pública; II - executar, com exclusividade, ressalvadas as missões peculiares às Forças Armadas, o policiamento ostensivo fardado; III - atuar de maneira preventiva, repressiva ou dissuasiva; IV - exercer o policiamento ostensivo e a fiscalização de trânsito nas rodovias estaduais; V - desempenhar a polícia administrativa do meio ambiente; VI - proceder à apuração das infrações penais de competência da polícia judiciária militar; VII - planejar e realizar ações de inteligência.
Art. 3º A PMTO é subordinada diretamente ao Chefe do Poder Executivo.
Art. 4º A PMTO é estruturada em unidades administrativas de direção, de apoio, de execução e especiais.
Art. 9º As unidades administrativas de direção compõem o Comando-Geral: I - Comandante-Geral; II - Chefe do Estado Maior; III - Subchefe do Estado Maior; IV - Corregedor-Geral; V - Estado Maior Geral; VI - Estado Maior Especial; VII - Comandos de Policiamento.
Art. 10. O Comandante-Geral é nomeado pelo Chefe do Poder Executivo, dentre os Coronéis da ativa, diplomados em Curso Superior de Polícia ou equivalente.
Art. 15. O Estado Maior Geral é composto pelas seções: PM/1 (legislação), PM/2 (inteligência), PM/3 (operações), PM/4 (logística), PM/5 (comunicação social), PM/6 (orçamento e finanças), PM/7 (informática e telecomunicações).
Art. 16. O Estado Maior Especial é composto pelas Diretorias: DAL, DEIP, DGP, DOF, DSPS.
Art. 17. Os Comandos de Policiamento: CPC (Capital), CPE (Especializado), CRP-1, CRP-2, CRP-3.
Art. 18. São unidades de apoio: Gabinete CG, APMT, Ajudância-Geral, AJUR, assessorias diversas, CPO, CPP, CPM.
Art. 22. São unidades de execução operacional: Batalhões de Polícia Militar e Companhias Independentes.
Art. 30. As unidades especiais: Centro Integrado de Operações Aéreas-CIOPAER e demais criadas por lei.`,
  },
  {
    disciplina: "Lei nº 2.575/2012",
    leiNome: "Promoções dos Militares Estaduais do Tocantins",
    fonteUrl: "https://central3.to.gov.br/arquivo/269665/",
    assuntos: [
      "Disposições Preliminares: conceito de promoção, planejamento de carreira (Arts. 1º a 6º)",
      "Abertura de Vagas: hipóteses, cômputo, data de abertura (Arts. 8º a 10)",
      "Comissões de Promoção: CPO e CPP, constituição, competências (Arts. 11 a 20)",
      "Critérios de Promoção: antiguidade, merecimento, escolha, bravura, post-mortem, tempo de contribuição, invalidez (Arts. 21 a 28)",
      "Quadros de Acesso: QAA e QAM, requisitos, organização (Arts. 29 a 38)",
      "Impedimentos e Ressalvas: impossibilidade de promoção, preterição, ressarcimento (Arts. 39 a 55)",
    ],
    leiSeca: `LEI Nº 2.575, DE 20 DE ABRIL DE 2012 - Estado do Tocantins.
Art. 1º Promoção é ato administrativo cuja finalidade principal é o reconhecimento do mérito e da habilitação do Policial Militar para o exercício de Posto ou Graduação imediatamente superior, mediante preenchimento das vagas existentes, de forma seletiva, gradual e sucessiva.
Art. 2º Os Oficiais e as Praças da PMTO são promovidos na forma estabelecida nesta Lei.
Art. 3º As promoções na PMTO são realizadas, anualmente, nos dias 21 de abril e 15 de novembro.
§1º As promoções pelos critérios de bravura, post-mortem, ressarcimento de preterição, invalidez permanente e tempo de contribuição independem de data.
Art. 5º O Policial Militar cujo comportamento for inferior a "bom" não pode constar de qualquer QA.
Art. 7º Guarda-se a proporção de uma promoção pelo critério de antiguidade e uma pelo de merecimento.
Art. 8º É computada, para efeito de promoção, a vaga decorrente de: I - promoção; II - agregação; III - passagem para a inatividade; IV - demissão; V - exoneração; VI - falecimento; VII - aumento de efetivo; VIII - modificação no QOD.
Art. 11. A CPO é presidida pelo Comandante Geral, composta por natos (CHEM e SCHEM) e efetivos (quatro Oficiais Superiores).
Art. 12. A CPP é presidida pelo Chefe do Estado Maior.
Art. 21. São critérios de promoção: I - antiguidade; II - merecimento; III - escolha; IV - bravura; V - post-mortem; VI - tempo de contribuição; VII - invalidez permanente.
Art. 22. A promoção por antiguidade decorre da precedência hierárquica.
Art. 23. A promoção por merecimento pressupõe o conjunto de qualidades e atributos que distinguem o Policial Militar.
Art. 24. A promoção por escolha efetua-se por ato do Chefe do Poder Executivo para o Posto de Coronel.
Art. 25. A promoção por bravura resulta de ato não comum de coragem e abnegação.
Art. 26. A promoção post-mortem expressa reconhecimento ao PM falecido no cumprimento do dever.
Art. 27. A promoção por tempo de contribuição é concedida ao PM que complete o tempo necessário à reserva remunerada.
Art. 28. A promoção por invalidez é deferida ao PM julgado definitivamente incapaz para o serviço militar.
Art. 31. O ingresso nos QA pressupõe: I - interstício; II - condições de saúde; III - requisitos peculiares; IV - pontuação positiva na avaliação.`,
  },
  {
    disciplina: "CPPM",
    leiNome: "Código de Processo Penal Militar — Arts. 8º a 28º e 243º a 253º",
    fonteUrl: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm",
    assuntos: [
      "Polícia Judiciária Militar (Art. 8º): competências - apurar crimes militares, prestar informações à Justiça Militar, cumprir mandados de prisão",
      "Inquérito Policial Militar (Arts. 9º a 22): conceito, finalidade (instrução provisória), modos de início (portaria, requisição MP, decisão STM), diligências, encarregado, escrivão, sigilo, prazo (20 dias preso / 40 dias solto), prorrogação, relatório",
      "Remessa e Arquivamento do IPM (Arts. 23 a 28): remessa à Auditoria, proibição de arquivamento pela autoridade militar, instauração de novo inquérito, dispensa de inquérito",
      "Prisão em Flagrante e Prisão Provisória (Arts. 243 a 253): conceito de flagrante delito, hipóteses legais, formalidades do auto de prisão, comunicação ao juiz",
    ],
    leiSeca: `DECRETO-LEI Nº 1.002/1969 - CÓDIGO DE PROCESSO PENAL MILITAR
APENAS Arts. 8º a 28º e Arts. 243º a 253º.

Art. 8º Compete à Polícia judiciária militar: a) apurar os crimes militares, bem como os que, por lei especial, estão sujeitos à jurisdição militar, e sua autoria; b) prestar aos órgãos e juízes da Justiça Militar e aos membros do Ministério Público as informações necessárias à instrução e julgamento dos processos; c) cumprir os mandados de prisão expedidos pela Justiça Militar; d) representar a autoridades judiciárias militares acerca da prisão preventiva e da insanidade mental do indiciado; e) cumprir as determinações da Justiça Militar relativas aos presos; f) solicitar das autoridades civis as informações e medidas úteis à elucidação das infrações; g) requisitar da polícia civil e das repartições técnicas civis as pesquisas e exames necessários; h) atender, com observância dos regulamentos militares, a pedido de apresentação de militar à autoridade civil competente.

Art. 9º O inquérito policial militar é a apuração sumária de fato que configure crime militar, e de sua autoria. Tem caráter de instrução provisória, cuja finalidade precípua é ministrar elementos necessários à propositura da ação penal.

Art. 10. O inquérito é iniciado mediante portaria: a) de ofício; b) por determinação ou delegação da autoridade militar superior; c) em virtude de requisição do Ministério Público; d) por decisão do Superior Tribunal Militar; e) a requerimento da parte ofendida; f) quando de sindicância resulte indício de infração penal militar.

Art. 12. Logo que tiver conhecimento da prática de infração penal militar, a autoridade deverá: a) dirigir-se ao local; b) apreender os instrumentos; c) efetuar a prisão do infrator; d) colher todas as provas.

Art. 16. O inquérito é sigiloso.

Art. 17. O encarregado do inquérito poderá manter incomunicável o indiciado, que estiver legalmente preso, por três dias no máximo.

Art. 18. Independentemente de flagrante delito, o indiciado poderá ficar detido durante as investigações até trinta dias (prorrogável por mais vinte dias).

Art. 20. O inquérito deverá terminar dentro em vinte dias, se o indiciado estiver preso, ou no prazo de quarenta dias, quando solto.

Art. 22. O inquérito será encerrado com minucioso relatório.

Art. 24. A autoridade militar não poderá mandar arquivar autos de inquérito.

Art. 25. O arquivamento de inquérito não obsta a instauração de outro, se novas provas aparecerem.

Art. 27. Se por si só for suficiente o auto de flagrante delito, constituirá o inquérito, dispensando outras diligências.

Art. 28. O inquérito poderá ser dispensado: a) quando o fato e sua autoria já estiverem esclarecidos; b) nos crimes contra a honra, quando decorrerem de escrito ou publicação cujo autor esteja identificado.

Art. 243. Qualquer pessoa poderá e os militares deverão prender quem for insubmisso ou desertor, ou seja encontrado em flagrante delito.

Art. 244. Considera-se em flagrante delito aquele que: a) está cometendo o crime; b) acaba de cometê-lo; c) é perseguido logo após o fato; d) é encontrado logo depois com instrumentos, objetos, material ou papéis que façam presumir a sua participação no fato delituoso.

Art. 245. Nas infrações permanentes, considera-se o agente em flagrante delito enquanto não cessar a permanência.

Art. 246. O auto de prisão em flagrante será lavrado pela autoridade competente, ouvidas as testemunhas que o presenciaram.

Art. 247. A prisão em flagrante será comunicada imediatamente ao juiz competente, com cópia do auto.

Art. 248. Quando a infração for inafiançável, a falta de testemunhas não impedirá o auto de prisão em flagrante.

Art. 249. A falta do auto de prisão em flagrante não obstará à instauração do inquérito.

Art. 250. O indiciado será, dentro de 24 horas após a prisão, conduzido à presença da autoridade competente.

Art. 253. Ao preso em flagrante delito é permitido defender-se.`,
  },
  {
    disciplina: "RDMETO",
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins — Decreto nº 4.994/2014",
    fonteUrl: "https://central3.to.gov.br/arquivo/179903/",
    assuntos: [
      "Disposições Gerais (Arts. 1º a 7º): finalidade, princípios de hierarquia e disciplina, conceito de transgressão disciplinar",
      "Transgressões Disciplinares (Arts. 8º a 15): classificação (leve, média, grave), relação de transgressões, atenuantes e agravantes, causas de justificação",
      "Sanções Disciplinares (Arts. 16 a 25): advertência, repreensão, detenção, prisão disciplinar, licenciamento e exclusão a bem da disciplina, aplicação e cumulação",
      "Comportamento Militar (Arts. 26 a 35): classificação (excepcional, ótimo, bom, regular, insuficiente), critérios de mudança, ficha de alterações, reabilitação, elogios",
      "Processo Disciplinar (Arts. 36 a 55): sindicância, PAD, contraditório, ampla defesa, recursos, prazos, decisão",
    ],
    leiSeca: `DECRETO Nº 4.994, DE 2 DE OUTUBRO DE 2014 - Estado do Tocantins.
Aprova o Regulamento Disciplinar dos Militares Estaduais do Tocantins - RDMETO.

Art. 1º O Regulamento Disciplinar dos Militares Estaduais do Tocantins tem por finalidade especificar os deveres, obrigações e proibições dos militares estaduais, definir e classificar as transgressões disciplinares e estabelecer normas relativas à aplicação de sanções disciplinares.

Art. 2º Os princípios fundamentais da vida militar estadual são a hierarquia e a disciplina.

Art. 3º Hierarquia militar é a ordenação da autoridade, em níveis diferentes, por postos e graduações.

Art. 4º Disciplina militar é a rigorosa observância e o acatamento integral das leis, regulamentos, normas e disposições.

Art. 7º Transgressão disciplinar é toda ação ou omissão contrária ao dever militar, tipificada neste Regulamento.

Art. 8º As transgressões disciplinares classificam-se em: I - leves; II - médias; III - graves.

Art. 9º São circunstâncias atenuantes: I - bom comportamento; II - relevância de serviços prestados; III - ter sido cometida para evitar mal maior; IV - ter confessado a autoria espontaneamente.

Art. 10. São circunstâncias agravantes: I - mau comportamento; II - prática durante o serviço; III - reincidência; IV - coautoria.

Art. 11. São causas de justificação: I - ter sido cometida em obediência a ordem superior; II - ter sido cometida para evitar perigo iminente; III - ter sido cometida em legítima defesa.

Art. 16. São sanções disciplinares: I - advertência; II - repreensão; III - detenção (até 10 dias); IV - prisão disciplinar (até 30 dias); V - licenciamento e exclusão a bem da disciplina.

Art. 26. O comportamento militar é a avaliação da conduta do militar estadual, classificado em: I - excepcional; II - ótimo; III - bom; IV - regular; V - insuficiente.

Art. 36. A apuração de transgressão disciplinar será realizada mediante sindicância ou processo administrativo disciplinar.

Art. 38. O processo administrativo disciplinar será instaurado quando: I - a transgressão for de natureza grave; II - o fato puder resultar em licenciamento ou exclusão.

Art. 42. É assegurado ao militar estadual o contraditório e a ampla defesa.`,
  },
  {
    disciplina: "Direito Penal Militar",
    leiNome: "Código Penal Militar — Decreto-Lei nº 1.001/1969 — Parte Geral",
    fonteUrl: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm",
    assuntos: [
      "Aplicação da Lei Penal Militar (Arts. 1º a 28): princípio de legalidade, retroatividade, tempo e lugar do crime, crimes militares em tempo de paz (Art. 9º), equiparação, conceito de superior e inferior",
      "Do Crime (Arts. 29 a 41): relação de causalidade, crime consumado e tentado, desistência voluntária, crime impossível, dolo e culpa, erro, coação irresistível, obediência hierárquica",
      "Exclusão de Crime (Arts. 42 a 47): estado de necessidade, legítima defesa, estrito cumprimento do dever legal, exercício regular de direito, excesso punível",
      "Imputabilidade (Arts. 48 a 52): inimputáveis, embriaguez, menoridade, doença mental",
      "Concurso de Agentes (Arts. 53 a 54): coautoria e participação, circunstâncias incomunicáveis",
      "Penas (Arts. 55 a 97): penas principais (morte, reclusão, detenção, prisão, impedimento, suspensão, reforma), penas acessórias, efeitos da condenação, medidas de segurança",
    ],
    leiSeca: `DECRETO-LEI Nº 1.001/1969 - CÓDIGO PENAL MILITAR - PARTE GERAL

Art. 1º Não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal.
Art. 2º Ninguém pode ser punido por fato que lei posterior deixa de considerar crime, cessando em virtude dela a execução e os efeitos penais da sentença condenatória.
§1º A lei posterior que, de qualquer outro modo, favorece o agente, aplica-se retroativamente.
Art. 5º Considera-se praticado o crime no momento da ação ou omissão, ainda que outro seja o do resultado.
Art. 6º Considera-se praticado o fato, no lugar em que se desenvolveu a atividade criminosa, no todo ou em parte.
Art. 7º Aplica-se a lei penal militar ao crime cometido, no todo ou em parte no território nacional, ou fora dele.

Art. 9º Consideram-se crimes militares, em tempo de paz:
I - os crimes de que trata este Código, quando definidos de modo diverso na lei penal comum, ou nela não previstos;
II - os crimes previstos neste Código e os previstos na legislação penal, quando praticados: a) por militar da ativa contra militar na mesma situação; b) por militar da ativa, em lugar sujeito à administração militar, contra militar da reserva ou reformado ou contra civil; c) por militar em serviço ou atuando em razão da função; d) por militar durante o período de manobras ou exercício; e) por militar da ativa contra o patrimônio sob a administração militar.
III - os crimes praticados por militar da reserva, ou reformado, ou por civil, contra as instituições militares.

Art. 12. O militar da reserva ou reformado, quando empregado na administração militar, equipara-se ao militar da ativa.
Art. 22. É militar, para o efeito deste Código, qualquer pessoa que, em tempo de paz ou de guerra, seja incorporada a instituições militares ou nelas matriculada.
Art. 24. Considera-se superior para fins de aplicação da lei penal militar: I – o militar que ocupa nível hierárquico, posto ou graduação superiores; II – o militar que, em virtude da função, exerce autoridade sobre outro de igual posto ou graduação.

Art. 29. O resultado de que depende a existência do crime somente é imputável a quem lhe deu causa.
Art. 30. Diz-se o crime: I - consumado, quando nele se reúnem todos os elementos de sua definição legal; II - tentado, quando, iniciada a execução, não se consuma por circunstâncias alheias à vontade do agente.
Art. 33. Diz-se o crime: I - doloso, quando o agente quis o resultado ou assumiu o risco de produzi-lo; II - culposo, quando o agente, deixando de empregar a cautela ordinária, não prevê o resultado que podia prever.
Art. 38. Não é culpado quem comete o crime: a) sob coação irresistível; b) em estrita obediência a ordem direta de superior hierárquico, em matéria de serviços.

Art. 42. Não há crime quando o agente pratica o fato: I - em estado de necessidade; II - em legítima defesa; III - em estrito cumprimento do dever legal; IV - em exercício regular de direito.
Art. 43. Considera-se em estado de necessidade quem pratica o fato para preservar direito seu ou alheio, de perigo certo e atual.
Art. 44. Entende-se em legítima defesa quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem.
Art. 45. O agente que, em qualquer das hipóteses dos arts. 42 a 44, excede culposamente os limites da necessidade ou moderação, é punível, se o fato é previsto como crime culposo.

Art. 55. As penas principais são: I - morte; II - reclusão; III - detenção; IV - prisão; V - impedimento; VI - suspensão do exercício do posto, graduação, cargo ou função; VII - reforma.
Art. 57. A pena de reclusão e a de detenção podem ser de até 30 anos.`,
  },
  {
    disciplina: "Lei Orgânica PM",
    leiNome: "Lei Orgânica Nacional das Polícias Militares — Lei nº 14.751/2023",
    fonteUrl: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14751.htm",
    assuntos: [
      "Disposições Gerais (Arts. 1º a 4º): natureza das PMs e CBMs, princípios básicos (hierarquia, disciplina, legalidade, eficiência), diretrizes",
      "Competências das PMs (Art. 5º): polícia ostensiva, preservação da ordem pública, polícia judiciária militar, policiamento rodoviário e de trânsito, proteção ambiental, inteligência",
      "Competências dos CBMs (Art. 6º): prevenção e combate a incêndios, busca, salvamento e resgate, defesa civil",
      "Organização e Carreira (Arts. 7º a 18): comandantes, estrutura, quadro de pessoal, nomeação, ingresso por concurso",
      "Direitos e Garantias (Arts. 19 a 32): remuneração, promoções, saúde, assistência jurídica, previdência",
      "Disposições Finais e Transitórias (Arts. 33 a 40): adaptação das legislações estaduais",
    ],
    leiSeca: `LEI Nº 14.751, DE 12 DE DEZEMBRO DE 2023.
Institui a Lei Orgânica Nacional das Polícias Militares e dos Corpos de Bombeiros Militares.

Art. 1º Esta Lei institui a Lei Orgânica Nacional das Polícias Militares e dos Corpos de Bombeiros Militares.

Art. 2º As polícias militares e os corpos de bombeiros militares são instituições militares permanentes, exclusivas e típicas de Estado, essenciais à Justiça Militar, na condição de forças auxiliares e reserva do Exército, organizadas com base na hierarquia e na disciplina militares e comandadas por oficial da ativa do último posto.

Art. 3º São princípios básicos: I - hierarquia; II - disciplina; III - proteção, promoção e respeito aos direitos humanos; IV - legalidade; V - impessoalidade; VI - publicidade; VII - moralidade; VIII - eficiência; IX - efetividade; X - razoabilidade e proporcionalidade; XI - universalidade na prestação do serviço; XII - participação e interação comunitária.

Art. 4º São diretrizes: I - atendimento permanente ao cidadão; II - planejamento estratégico; III - integração com a comunidade; IV - racionalidade e imparcialidade; V - caráter técnico e científico; XIV - uso racional da força e uso progressivo dos meios.

Art. 5º Compete às polícias militares: I - planejar, coordenar e dirigir a polícia ostensiva; II - executar a polícia ostensiva e, privativamente, a polícia judiciária militar; III - realizar a prevenção e repressão dos ilícitos penais militares; V - exercer a polícia ostensiva rodoviária e de trânsito; X - realizar coleta, busca e análise de dados sobre criminalidade; XI - produzir e difundir ações de inteligência; XIV - recrutar, selecionar e formar seus membros.

Art. 6º Compete aos corpos de bombeiros militares: I - planejar e dirigir ações de prevenção, extinção e perícia de incêndios; II - executar ações de busca, salvamento e resgate; III - editar atos normativos de segurança contra incêndio.

Art. 7º As polícias militares e os corpos de bombeiros militares serão comandados por oficial da ativa do último posto, do Quadro de Oficiais de Estado-Maior.

Art. 10. Os membros das polícias militares e dos corpos de bombeiros militares são servidores militares dos Estados, do Distrito Federal e dos Territórios.

Art. 11. São garantias dos membros: I - estabilidade; II - irredutibilidade de subsídios.

Art. 15. O ingresso nas instituições militares estaduais é efetivado por concurso público de provas ou de provas e títulos.

Art. 20. As promoções são realizadas conforme legislação de cada ente federativo, observados os critérios de antiguidade, merecimento e demais previstos em lei.`,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { disciplina_index, batch_size } = await req.json();
    const batchSize = batch_size || 10;
    const discIndex = disciplina_index ?? 0;

    if (discIndex < 0 || discIndex >= DISCIPLINES.length) {
      return new Response(JSON.stringify({ error: "Invalid discipline index" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const disc = DISCIPLINES[discIndex];
    const dificuldades = ["Fácil", "Médio", "Difícil"];

    const prompt = `Você é um especialista em concursos militares do CHOA/CHOM PMTO.

Gere exatamente ${batchSize} questões para "${disc.disciplina}" (${disc.leiNome}).

FONTE LEGAL OBRIGATÓRIA (use SOMENTE este conteúdo como base):
${disc.leiSeca}

Tópicos do edital:
${disc.assuntos.map((a, i) => `${i + 1}. ${a}`).join("\n")}

REGRAS OBRIGATÓRIAS:
1) Exatamente 5 alternativas por questão (A-E), cada uma com texto completo e coerente.
2) Apenas UMA alternativa correta.
3) Gabarito em índice 0..4 (0=A, 1=B, 2=C, 3=D, 4=E).
4) Varie a letra correta (não repita sempre a mesma).
5) O comentário DEVE citar o artigo/parágrafo/inciso REAL da lei (ex: "Art. 9º, inciso II, alínea 'a'").
6) SOMENTE conteúdo da lei seca fornecida acima. NÃO invente artigos ou dispositivos.
7) NÃO use placeholders como "UM", "DOIS", "TRÊS", "A", "B", "I", "II" como alternativa isolada.
8) Alternativas devem ser frases completas, específicas e plausíveis.
9) Estilo "De acordo com..." ou "Conforme..." típico de provas militares.
10) Distribua as dificuldades: Fácil (conceitos básicos), Médio (interpretação), Difícil (detalhes específicos).

Formato de saída (JSON array, sem markdown):
[
  {
    "disciplina": "${disc.disciplina}",
    "assunto": "Nome do assunto",
    "dificuldade": "Fácil|Médio|Difícil",
    "enunciado": "Texto da questão",
    "alt_a": "Texto completo da alternativa A",
    "alt_b": "Texto completo da alternativa B",
    "alt_c": "Texto completo da alternativa C",
    "alt_d": "Texto completo da alternativa D",
    "alt_e": "Texto completo da alternativa E",
    "gabarito": 0,
    "comentario": "Explicação com citação do artigo legal específico"
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return new Response(JSON.stringify({ error: "AI generation failed", details: errText }), {
        status: aiResponse.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let questoes;
    try {
      questoes = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(questoes) || questoes.length === 0) {
      return new Response(JSON.stringify({ error: "No questions generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discarded: { index: number; issues: string[] }[] = [];
    const validQuestoes = questoes
      .map((q: any, index: number) => {
        const { sanitized, issues } = sanitizeAndValidateQuestion({
          disciplina: q.disciplina || disc.disciplina,
          assunto: q.assunto || disc.assuntos[0],
          dificuldade: dificuldades.includes(q.dificuldade) ? q.dificuldade : "Médio",
          enunciado: q.enunciado,
          alt_a: q.alt_a,
          alt_b: q.alt_b,
          alt_c: q.alt_c,
          alt_d: q.alt_d,
          alt_e: q.alt_e,
          gabarito: q.gabarito,
          comentario: q.comentario || "",
        });

        if (issues.length > 0) {
          discarded.push({ index, issues });
          return null;
        }

        return sanitized;
      })
      .filter(Boolean);

    if (validQuestoes.length === 0) {
      return new Response(JSON.stringify({ error: "All generated questions were discarded by quality checks", discarded }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.from("questoes").insert(validQuestoes as any[]).select("id");

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to insert questions", details: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        disciplina: disc.disciplina,
        generated: questoes.length,
        inserted: data?.length || 0,
        discarded: discarded.length,
        discarded_details: discarded.length > 0 ? discarded.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
