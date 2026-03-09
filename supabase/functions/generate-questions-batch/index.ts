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
    leiSeca: `LEI Nº 2.578, DE 20 DE ABRIL DE 2012 - Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins.

CAPÍTULO I - DISPOSIÇÕES PRELIMINARES
Art. 1º Regula o ingresso na Corporação, a relação jurídica funcional, os direitos, a ética, as obrigações, os deveres, as garantias e as prerrogativas dos Policiais Militares e dos Bombeiros Militares do Estado do Tocantins.
Art. 2º A Polícia Militar e o Corpo de Bombeiros Militar são instituições permanentes, reserva do Exército Brasileiro, diretamente subordinadas ao Governador do Estado.
Art. 3º Compete: I - à PM o exercício da polícia ostensiva e a preservação da ordem pública; II - ao CBM as atribuições previstas em leis específicas e as ações de defesa civil.
Art. 4º Os militares constituem categoria de agente público estadual denominado militar (art. 42 CF). Situações: I - na ativa (carreira ou reserva convocada); II - na inatividade (reserva remunerada ou reformados).
Art. 10. Conceituações: I - Comandante; II - Missão/Tarefa; III - Corporação (PMTO e CBMTO); IV - OM; V - Sede; VI - Serviço Ativo; VII - Efetivo Serviço; VIII - Comissão/Encargo; IX - Função Militar; X - Adição; XI - Inclusão/Nomeação; XII - Declaração; XIII - Movimentação (classificação, transferência, nomeação, designação); XIV - Almanaque; XV - Excedente; XVI - Licenciamento; XVII - Trânsito.

CAPÍTULO II - DO INGRESSO NA CORPORAÇÃO
Art. 11. Ingresso depende de concurso público, exigindo: I - nacionalidade brasileira; II - idade mínima 18 anos; III - idade máxima 32 anos (inscrição); IV - altura mínima 1,63m (M) e 1,60m (F); V - ensino médio (Praças) ou superior (Oficiais); VI - idoneidade moral; VII - negativa de condenação; VIII - obrigações eleitorais e militares em dia; IX - CNH mínimo "B".
§4º Avaliação psicológica identifica traços incompatíveis: descontrole emocional, agressividade, impulsividade, oposicionismo a normas.
§7º Após ingresso, o militar é submetido a curso de formação. §8º Reprovado no curso: exoneração ou recondução.
§14 Acesso inicial QOPM/QOBM: graduação de Cadete, após conclusão declarado Aspirante a Oficial. §16 Acesso inicial Praças: Aluno-Praça.

CAPÍTULO III - DA HIERARQUIA E DA DISCIPLINA
Art. 12. Exercício das funções militares é privativo do militar de carreira.
Art. 13. Hierarquia e disciplina são a base institucional. §1º Hierarquia: ordenação da autoridade em níveis por postos e graduações. §4º Disciplina: rigorosa observância das leis e regulamentos. §6º Regulamento disciplinar: pena de prisão/detenção máximo 30 dias; nenhuma punição sem devido processo legal, ampla defesa e contraditório.
Punições em ordem de gravidade: 1-advertência; 2-repreensão; 3-detenção; 4-prisão; 5-reforma disciplinar; 6-demissão.
Art. 14. Círculos hierárquicos: âmbitos de convivência entre militares da mesma categoria.
Art. 15. Escala hierárquica: I - Oficiais Superiores (Coronel, Tenente-Coronel, Major); II - Oficial Intermediário (Capitão); III - Oficiais Subalternos (1º e 2º Tenente); IV - Praças Especiais (Aspirante, Cadetes); V - Subtenentes e Sargentos; VI - Cabos e Soldados. §1º Posto: grau hierárquico do oficial (ato do Governador). §2º Graduação: grau hierárquico da praça (ato do CG).
Art. 16. Antiguidade contada da data do ato de inclusão/promoção/nomeação/declaração.
Art. 17. Precedência: Aspirante superior às demais praças; Aluno CFO superior ao Subtenente.

CAPÍTULO IV - DO CARGO E DA FUNÇÃO MILITAR
Art. 20. Subordinação não afeta a dignidade do militar, decorre da estrutura hierarquizada.
Art. 21. Oficial é preparado para o Comando, Chefia e Direção.
Art. 22. Subtenentes e Sargentos auxiliam Oficiais.
Art. 23. Cabos e soldados: atividades de execução.
Art. 25. Militar responsável integral por decisões, ordens e atos praticados.
Art. 26. Cargo militar: só pode ser exercido por militar em serviço ativo.

CAPÍTULO V - DAS OBRIGAÇÕES DOS MILITARES
Art. 32. Manifestações do valor militar: I - servir à comunidade; II - civismo e tradições; III - fé na missão; IV - espírito de corpo; V - amor à profissão; VI - aprimoramento técnico-profissional.
Art. 33. Preceitos da ética militar: amar a verdade, exercer com eficiência, respeitar dignidade humana, cumprir leis, ser justo e imparcial, zelar pelo preparo, praticar camaradagem, ser discreto, abster-se de uso do posto para facilidades pessoais.
Art. 34. Proibidos: sindicalização, greve, filiação partidária enquanto na ativa.
Art. 35. Vedado ao militar da ativa: comerciar ou administrar sociedade (exceto acionista).
Art. 36-37. Compromisso militar: prestado com caráter solene na presença de tropa.

CAPÍTULO VII - DAS TRANSGRESSÕES DISCIPLINARES
Art. 42. Transgressão disciplinar: infração administrativa que viola preceitos da ética militar. Prescrição: leve 1 ano; média 2 anos; grave 5 anos.
Art. 44. Transgressões LEVES (12 incisos): não prestar informação, chegar atrasado, descuidar do asseio, faltar a preceitos de civilidade, etc.
Art. 45. Transgressões MÉDIAS (33 incisos): concorrer para discórdia, deixar de punir transgressor, desconsiderar autoridade, permutar serviço sem permissão, demonstrar desídia, etc.
Art. 46. Transgressões GRAVES (38 incisos): abandonar serviço, fazer afirmação falsa, exercer função fraudulenta, usar violência, não cumprir ordem, valer-se do cargo para proveito pessoal, extraviar material da Fazenda Pública, envolver-se em negócios ilegais, quebrar cadeia de comando, etc.
Art. 49. Classificação pode ser alterada motivadamente pelas circunstâncias do art. 43.

CAPÍTULO VIII - DOS PROCESSOS ADMINISTRATIVOS DISCIPLINARES
Art. 50. Processos: I - sindicância; II - Conselhos de Justificação ou Disciplina.
Art. 51. Sindicância: processo que apura transgressões, assegurados ampla defesa e contraditório.
Art. 53. Conclusão em 30 dias, prorrogável por 20.
Art. 55. Conselhos: avaliam capacidade do militar estável de permanecer no serviço ativo. §1º Oficial: Conselho de Justificação; Praça: Conselho de Disciplina.
Art. 57. Submetido a Conselho quem: perder nacionalidade, procedimento incorreto, ato contra honra, crime hediondo, condenação penal >2 anos, falta grave estando em comportamento insuficiente/mau.
Art. 58. Prazo dos Conselhos: 50 dias, prorrogável por 30.
Art. 59. Conselhos: 3 Oficiais (Presidente, Relator, Secretário).

COMPORTAMENTO MILITAR
Art. 64-65. Comportamento da praça: excepcional (8 anos sem punição), ótimo (4 anos até 1 detenção), bom (2 anos até 2 prisões), insuficiente (1 ano até 2 prisões), mau (1 ano mais de 2 prisões). Equivalências: 2 repreensões = 1 detenção; 2 detenções = 1 prisão. Praça incluída no comportamento "bom".

CAPÍTULO X - DOS DIREITOS
Art. 68. Direitos: I - garantia do posto/patente (oficiais); II - garantia da graduação (praças estáveis); III - exoneração/licenciamento voluntário, porte de arma, tratamento de saúde, cursos, licença maternidade (120 dias), paternidade (8 dias), adoção, auxílio-funeral, 13º salário, salário-família, férias 30 dias com 1/3 adicional, devido processo legal.
Art. 69. Auxílio-natalidade: equivalente ao subsídio do Soldado referência. Parto múltiplo: acrescido 50%.
Art. 73. Militares remunerados exclusivamente por subsídios.
Art. 75. Direito ao subsídio: a partir da inclusão ou reversão.
Art. 76. Suspensão do subsídio: licença interesse particular, deserção, agregação para cargo civil.

CAPÍTULO X - FÉRIAS E LICENÇAS
Art. 86. Férias: 30 dias, acumuláveis até 2 períodos. Primeiro período: 12 meses de serviço.
Art. 88. Afastamentos: I - núpcias (8 dias); II - luto (8 dias); III - instalação (10 dias); IV - trânsito (30 dias); V - trabalho acadêmico (10 dias); VI - aniversário (1 dia).
Art. 90. Licenças: I - interesse particular; II - saúde de familiar; III - saúde própria; IV - maternidade; V - adoção; VI - paternidade; VII - curso de formação (concurso público).
Art. 91. Licença interesse particular: 10+ anos de serviço, até 2 anos, sem remuneração.
Art. 92. Licença maternidade: 120 dias; adoção: 120 dias (criança até 1 ano); paternidade: 8 dias.
Art. 93. Prorrogação maternidade: 60 dias mediante requerimento.
Art. 99. Recursos disciplinares: pedido de reconsideração (5 dias úteis), recurso hierárquico (5 dias úteis), apelação (15 dias úteis).

CAPÍTULO XI - DAS PRERROGATIVAS
Art. 101. Prerrogativas: uso de títulos/uniformes/distintivos, honras, cumprimento de pena em OM com precedência hierárquica, foro especial (crimes militares).
Art. 102. Prisão do militar: somente em flagrante delito, entregue imediatamente à autoridade militar.
Art. 104-106. Uniformes privativos dos militares; proibido civil usar uniforme similar.

CAPÍTULO XII - DAS SITUAÇÕES ESPECIAIS
Art. 107. Agregação: militar deixa de ocupar vaga na escala hierárquica. Hipóteses: cargo não militar, aguardar reserva, condenação CPM, incapacidade definitiva, >6 meses em licença saúde, desertor, candidato eletivo (10+ anos), entre outros.
Art. 108. Reversão: retorno ao quadro quando cessa a agregação.
Art. 112. Ausente: militar que por mais de 24h consecutivas deixar de comparecer sem comunicar.
Art. 113-117. Desaparecido (8+ dias), extraviado (30+ dias), falecimento.

CAPÍTULO XIII - DA EXCLUSÃO DO SERVIÇO ATIVO
Art. 118. Exclusão por: I - reserva remunerada; II - reforma; III - deserção; IV - falecimento; V - extravio.
Art. 121-122. Reserva remunerada a pedido: 30 anos efetivo serviço + 35 anos contribuição.
Art. 123. Reserva ex officio: idades limites (Coronel 65 anos, Ten-Cel 63, Major 61, Capitão 59, Oficiais subalternos 58; Subtenente 63, 1ºSgt 60, 2ºSgt 59, 3ºSgt 58, Cabo 57, Soldado 56).
Art. 125. Reforma: superar 3 anos da idade limite, incapacidade definitiva, >1 ano agregado por incapacidade, condenação CPM, Conselho de Justificação/Disciplina.
Art. 127. Incapacidade definitiva por: acidente em serviço, doença do serviço, doença grave/incurável, acidente/doença sem relação com serviço. Doenças graves: tuberculose, alienação mental, neoplasia, cegueira, cardiopatia grave, Parkinson, AIDS, etc.

CAPÍTULO XIV - DA DEMISSÃO E EXCLUSÃO
Art. 132. Exclusão da Corporação por: demissão, exoneração, perda do posto/patente, perda da graduação, licenciamento.
Art. 133. Exoneração a pedido: sem indenização (tempo >= formação) ou com indenização.
Art. 139. Demissão a bem da disciplina: incompatibilidade para atividade militar.
Art. 140. Demissão acarreta perda do grau hierárquico.

CAPÍTULO XV - DO TEMPO DE CONTRIBUIÇÃO
Art. 141. Tempo de efetivo serviço: contínuo ou não, dia a dia, entre inclusão e exclusão. §2º Divisor: 365 dias = 1 ano.
Art. 142. Acréscimos: tempo público federal/estadual/municipal anterior, tempo privado, tempo autônomo.`,
  },
  {
    disciplina: "LC nº 128/2021",
    leiNome: "Organização Básica da Polícia Militar do Estado do Tocantins",
    fonteUrl: "https://www.al.to.leg.br/arquivos/lei_128-2021_66731.PDF",
    assuntos: [
      "Destinação, Competências e Subordinação da PMTO (Arts. 1º a 3º)",
      "Estrutura Geral: unidades de direção, apoio, execução e especiais (Arts. 4º a 7º)",
      "Unidades de Direção: CG, CHEM, SCHEM, Corregedoria, EMG, EME, Comandos de Policiamento (Arts. 8º a 17)",
      "Unidades de Apoio: GCG, APMT, AG/QCG, AJUR, Assessorias, CPO, CPP, CPM, ASTEF (Arts. 18 a 24)",
      "Unidades de Execução: UPM, UPME, Batalhões, Companhias, Pelotões (Arts. 25 e 26)",
      "Unidades Especiais: Colégios Militares - CMTO (Art. 27)",
      "Gestão Profissional: Quadros QOPM, QOS, QOE, QOA, QOM, QOAS, QPPM, QPE, QPS, efetivo e QOD (Arts. 28 a 30)",
      "Disposições Gerais, Transitórias e Finais (Arts. 31 a 39)",
    ],
    leiSeca: `LEI COMPLEMENTAR Nº 128, DE 14 DE ABRIL DE 2021. Dispõe sobre a Organização Básica da Polícia Militar do Estado do Tocantins - PMTO, e adota outras providências.

CAPÍTULO I - DA DESTINAÇÃO DA POLÍCIA MILITAR DO ESTADO DO TOCANTINS – PMTO, DAS COMPETÊNCIAS E DA SUBORDINAÇÃO
Art. 1º A Polícia Militar do Estado do Tocantins - PMTO, Secretaria de Estado, instituição permanente, força auxiliar e reserva do Exército, organizada com base na hierarquia e na disciplina militares, destina-se à preservação da ordem pública e à realização do policiamento ostensivo no território do Estado do Tocantins.
Art. 2º Compete à Polícia Militar do Estado do Tocantins - PMTO: I - planejar, organizar, dirigir, supervisionar, coordenar, controlar e executar as ações de polícia ostensiva e de preservação da ordem pública; II - executar, com exclusividade, ressalvadas as missões peculiares às Forças Armadas, o policiamento ostensivo fardado para prevenção e repressão dos ilícitos penais e infrações definidas em lei, bem como as ações necessárias ao pronto restabelecimento da ordem pública; III - atuar de maneira preventiva, repressiva ou dissuasiva em locais ou áreas específicas em que ocorra ou se presuma possível a perturbação da ordem pública; IV - exercer o policiamento ostensivo e a fiscalização de trânsito nas rodovias estaduais e, no limite de sua competência, nas vias urbanas e rurais, além de outras ações destinadas ao cumprimento da legislação de trânsito; V - desempenhar, nos limites de sua competência, a polícia administrativa do meio ambiente, na fiscalização, constatação e autuação de infrações ambientais e outras ações pertinentes, e colaborar com os demais órgãos ambientais na proteção do meio ambiente; VI - proceder, nos termos da lei, à apuração das infrações penais de competência da polícia judiciária militar; VII - planejar e realizar ações de inteligência destinadas à prevenção criminal e ao exercício da polícia ostensiva e da preservação da ordem pública na esfera de sua competência; VIII - realizar a guarda externa de estabelecimentos penais e as missões de segurança de dignitários em conformidade com a lei; IX - garantir o exercício do poder de polícia pelos Poderes e órgãos públicos do Estado, especialmente os das áreas fazendária, sanitária, de uso e ocupação do solo, do patrimônio cultural e do meio ambiente; X - efetuar o patrulhamento aéreo, portuário, fluvial e lacustre no âmbito de sua competência; XI - planejar e executar o serviço de saúde, no âmbito interno da PMTO, dos policiais militares, conforme regulamentação do Chefe do Poder Executivo, por profissionais com especialidades e registro junto aos Conselhos respectivos; XII - atuar, observados os limites estabelecidos pelo Sistema Nacional de Políticas Públicas sobre Drogas, na formulação de políticas estaduais de prevenção do tráfico ilícito e do uso indevido de drogas; XIII - firmar e celebrar convênios, acordos, ajustes e contratos com entes da administração direta e indireta da União, estados, Distrito Federal e municípios, bem como com pessoas físicas e pessoas jurídicas de direito público e privado.
Art. 3º A Polícia Militar do Estado do Tocantins - PMTO é subordinada diretamente ao Chefe do Poder Executivo.

CAPÍTULO II - DA ORGANIZAÇÃO BÁSICA DA POLÍCIA MILITAR
Seção I - Da Estrutura Geral
Art. 4º A PMTO é estruturada em unidades administrativas de direção, de apoio, de execução e especiais.
Art. 5º As unidades administrativas de direção realizam o comando, o planejamento e a administração da Corporação.
Art. 6º As unidades administrativas de apoio realizam e assessoram a atividade-meio da Corporação, atuando em cumprimento às diretrizes e ordens das unidades administrativas de direção.
Art. 7º As unidades administrativas de execução realizam as atividades-fim da PMTO, executando as diretrizes e ordens emanadas das unidades de direção amparadas pelas unidades de apoio.

Seção II - Das Unidades Administrativas de Direção
Art. 8º As unidades de direção são responsáveis, perante o Comandante-Geral da Corporação, pelo planejamento estratégico da Corporação, cabendo-lhes a elaboração de diretrizes e ordens do Comando-Geral quanto ao acionamento das unidades administrativas de apoio e de execução no cumprimento de suas missões.
Art. 9º As unidades administrativas de direção compõem o Comando-Geral da Corporação que se constitui do: I - Comandante-Geral - CG; II - Chefe do Estado Maior - CHEM; III - Subchefe do Estado Maior - SCHEM; IV - Corregedor-Geral - CORREG; V - Estado Maior Geral - EMG; VI - Estado Maior Especial - EME; VII - Comandos de Policiamento - CP.
Art. 10. O Comandante-Geral, na condição de Secretário de Estado, assessorado pelas demais unidades administrativas, responsável superior pelo comando, pela administração e pelo emprego da Corporação é nomeado por ato do Chefe do Poder Executivo, dentre os Coronéis da ativa, diplomados em Curso Superior de Polícia ou equivalente, pertencentes ao Quadro de Oficiais Policiais Militares - QOPM do Estado do Tocantins. Parágrafo único. O Comandante-Geral contará com um Assessor-Especial, Tenente-Coronel ou Coronel pertencente ao QOPM, o qual lhe assistirá diretamente em assuntos estratégicos e políticas públicas de segurança. (Acrescentado pela LC nº 149/2023).
Art. 11. O Chefe do Estado Maior - CHEM é nomeado por ato do Chefe do Poder Executivo mediante indicação do Comandante-Geral, dentre os Coronéis da ativa pertencentes ao QOPM e tem precedência funcional sobre os demais Policiais Militares, exceto sobre o Comandante-Geral.
Art. 12. Compete ao Chefe do Estado Maior - CHEM a direção, orientação, coordenação e fiscalização dos trabalhos, das unidades administrativas de direção, de apoio, de execução e especiais da PMTO, cumulativamente com a função de Subcomandante-Geral da PMTO. Parágrafo único. O CHEM substitui o Comandante-Geral em seus impedimentos legais e eventuais.
Art. 13. O Subchefe do Estado Maior - SCHEM é nomeado por ato do Chefe do Poder Executivo mediante indicação do Comandante-Geral, dentre os Coronéis do QOPM da Corporação e tem precedência funcional sobre os demais Policiais Militares, exceto sobre o Comandante-Geral e o Chefe do Estado Maior. Parágrafo único. Compete ao SCHEM substituir o Chefe do Estado Maior, nos afastamentos eventuais e impedimentos legais, e coordenar as Seções do Estado Maior Geral - EMG, bem como o Estado Maior Especial - EME. (Redação pela LC nº 149/2023).
Art. 14. O Corregedor-Geral é escolhido pelo Comandante-Geral dentre os Coronéis do QOPM e tem precedência funcional sobre os demais Policiais Militares, exceto sobre o Comandante-Geral, o Chefe do Estado Maior e o Subchefe do Estado Maior. §1º A Corregedoria-Geral - CORREG, unidade administrativa técnica subordinada ao Comandante-Geral, com atuação em todo Estado, tem por finalidade: I - assegurar a correta aplicação da lei; II - padronizar os procedimentos de Polícia Judiciária Militar e de processos e procedimentos administrativos disciplinares; III - realizar correições e fiscalizações; e IV - garantir a preservação dos princípios da hierarquia e disciplina da Corporação. §2º Os Comandos de Policiamento, a Academia de Polícia Militar Tiradentes - APMT e todos os Batalhões e Companhias Independentes da PMTO contam com corregedorias locais, subordinadas aos respectivos comandantes e vinculadas tecnicamente à CORREG.
Art. 15. O Estado Maior Geral é responsável perante o Comandante-Geral por ações de planejamento, estudo, orientação, coordenação, fiscalização e controle das atividades da PMTO, cabendo-lhe a formulação de diretrizes, ordens e normas gerais de ação do Comandante-Geral no acionamento das unidades administrativas de apoio, de execução e especiais, no cumprimento de suas missões, sendo composto pelas seguintes seções: I - 1ª Seção (PM/1): responsável pelo planejamento e encarregada dos assuntos relativos à legislação e concurso público, bem como por secretariar a CPO, a CPP e a CPM; II - 2ª Seção (PM/2): denominada Agência Central de Inteligência - ACI, responsável pelo planejamento e encarregada dos assuntos relativos a atividades de inteligência, contrainteligência, controle de armamento e munição dos integrantes da PMTO, guarda e manutenção de documentos e arquivos sigilosos; III - 3ª Seção (PM/3): responsável pelo planejamento e encarregada dos assuntos relativos à articulação operacional, à administração e ao controle das operações policiais militares e pelos estudos, doutrina e pesquisas relativas à preservação da ordem pública, ao policiamento ostensivo, à padronização de procedimentos operacionais; IV - 4ª Seção (PM/4): responsável pelo planejamento das matérias relativas à logística e à infraestrutura da Corporação; V - 5ª Seção (PM/5): denominada Assessoria de Comunicação - ASCOM, responsável pelo planejamento e execução das matérias relativas a atividades de comunicação; VI - 6ª Seção (PM/6): responsável pelo planejamento das matérias relativas a convênios, ao orçamento e às finanças da Corporação; VII - 7ª Seção (PM/7): denominada Assessoria Técnica de Informática e Telecomunicações - ATIT, responsável pelo planejamento e execução das matérias relativas a informática, telecomunicações e tecnologia da informação.
Art. 16. O Estado Maior Especial - EME é composto pelas seguintes Diretorias: I - Diretoria de Apoio Logístico - DAL: responsável pela execução, coordenação, fiscalização, acompanhamento e controle das matérias relativas às atividades de suprimento e manutenção de material, de obras e de patrimônio; II - Diretoria de Ensino, Instrução e Pesquisa - DEIP: responsável pelo planejamento, coordenação, fiscalização, acompanhamento e controle das matérias relativas ao ensino, instrução e pesquisa desenvolvidos na Corporação, bem como da Academia Policial Militar Tiradentes - APMT e dos Colégios Militares do Estado Tocantins - CMTO; III - Diretoria de Gestão Profissional - DGP: responsável pela gestão profissional e a execução, coordenação, fiscalização, acompanhamento e controle das matérias relacionadas aos militares e demais servidores civis da Instituição, bem como o assessoramento de Comissões e a identificação e expedição da identidade funcional dos Policiais Militares; IV - Diretoria de Orçamento e Finanças - DOF: responsável pela execução, coordenação, fiscalização, acompanhamento e controle das matérias relativas às atividades de administração financeira, orçamentária e contábil da Corporação; V - Diretoria de Saúde e Promoção Social - DSPS: responsável pelo planejamento, execução, coordenação, fiscalização, acompanhamento, controle das matérias relativas aos serviços de saúde e à promoção social dos Policiais Militares Estaduais ativos, inativos, seus dependentes e pensionistas, pela Junta Militar Central de Saúde - JMCS e Capelania Militar - CAPMIL; VI - Diretoria de Programas Sociais da PMTO - DPS: responsável pela gestão, coordenação, fiscalização, pelo acompanhamento e controle das matérias relacionadas aos CMTO, ao PROERD, ao Corpo Musical, às políticas de CPCDH, à CPMP, da gestão dos Programas Sociais da PMTO, bem como pela gestão das parcerias da PMTO referentes aos Colégios Militares. (Acrescentado pela LC nº 149/2023).
§1º O Comandante Geral poderá propor ao Chefe do Poder Executivo a criação de programas sociais.
§2º A Junta Militar Central de Saúde - JMCS, composta por Oficiais e Praças do Quadro de Saúde e por profissionais civis, é responsável pela execução das inspeções de saúde de interesse da PMTO, destinadas ao acompanhamento da saúde física e/ou mental dos militares da corporação, quando determinado por autoridade competente.
Art. 17. Os Comandos de Policiamento da PMTO, unidades de direção, exclusivo de Coronel da ativa do quadro QOPM, responsáveis pelo comando, planejamento, supervisão, coordenação e controle do emprego das Unidades de Execução Operacional e Especializado, são: I - Comando de Policiamento da Capital - CPC; II - Comando de Policiamento Especializado - CPE; III - Comandos Regionais de Policiamento - CRP: a) CRP-1; b) CRP-2; c) CRP-3. (Redação pela LC nº 149/2023). Parágrafo único. O Plano de Articulação da PMTO definirá a área de atuação dos comandos de policiamento.

Seção III - Das Unidades Administrativas de Apoio
Art. 18. São unidades administrativas de apoio da PMTO: I - Gabinete do Comandante-Geral - GCG; II - Academia Policial Militar Tiradentes - APMT; III - Ajudância-Geral - AG/Quartel do Comando-Geral - QCG; IV - Assessoria Jurídica - AJUR; V - Assessoria Parlamentar junto à Assembleia Legislativa - AAL; VI - Assessoria junto ao Ministério Público Estadual - AMP; VII - Assessoria junto ao Tribunal de Contas do Estado - ATCE; VIII - Assessoria junto ao Tribunal de Justiça do Estado - ATJ; IX - Assessoria junto ao município de Palmas - APMP; X - Assessoria junto à Secretaria da Segurança Pública - ASESP; XI - Assessoria junto à Secretaria do Trabalho e da Assistência Social - ASETAS; XII - Assessoria junto ao Departamento Estadual de Trânsito - ADET; XIII - Comissão de Promoção de Oficiais - CPO, presidida pelo Comandante-Geral, responsável pelas matérias relativas à promoção de Oficiais; XIV - Comissão de Promoção de Praças - CPP, presidida pelo Chefe do Estado Maior, responsável pelas matérias relativas à promoção de Praças; XV - Comissão Permanente de Medalhas - CPM, presidida pelo Comandante-Geral, responsável pelas matérias relativas à concessão de medalhas no âmbito da Corporação; XVI - Assessoria Técnica de Análises de Processos e Procedimentos Financeiros - ASTEF.
Art. 19. O Gabinete do Comandante-Geral será chefiado por um Tenente-Coronel ou Coronel da ativa, pertencente ao QOPM, indicado pelo Comandante-Geral e nomeado pelo Chefe do Poder Executivo, competindo-lhe: I - assistência direta ao Comandante-Geral, ao CHEM e ao SCHEM, no trato e apreciação de assuntos institucionais; II - a recepção, o estudo e a triagem dos expedientes encaminhados ao Comandante-Geral; III - a transmissão e o controle da execução das ordens emanadas do Comandante-Geral. (Redação pela LC nº 149/2023).
Art. 20. A APMT, vinculada tecnicamente à DEIP, é responsável por formar, aperfeiçoar e especializar Oficiais e Praças da Corporação e de coirmãs. Parágrafo único. Observadas as regras de execução orçamentária, por ato do Comandante-Geral podem ser realizadas a formação, aperfeiçoamento, especialização e capacitação em outras unidades da Corporação ou em coirmã.
Art. 21. A Ajudância-Geral é responsável pela administração do Quartel do Comando Geral - QCG. (Redação pela LC nº 149/2023). §1º O Ajudante-Geral é o Comandante do Quartel do Comando-Geral - QCG. §2º O QCG é considerado unidade administrativa da Corporação.
Art. 22. A AJUR é unidade administrativa de assessoramento direto e imediato ao Comandante-Geral da Corporação.
Art. 23. As unidades administrativas especificadas nos incisos V ao XII do art. 18 desta Lei Complementar são responsáveis pela representação da PMTO nos assuntos pertinentes à sua atribuição, conforme Regimento Interno aprovado pelo Comandante-Geral. §1º A AG/QCG será chefiada por um Coronel da ativa do Quadro QOPM. §2º As Assessorias que constam do caput deste artigo serão chefiadas por Coronéis ou Tenentes-Coronéis do quadro QOPM, indicados pelo Comandante-Geral. (Acrescentados pela LC nº 149/2023).
Art. 24. A ASTEF, unidade de assessoramento direto ao Comandante-Geral, é responsável pelas providências referentes à defesa do patrimônio público no âmbito da Corporação.

Seção IV - Das Unidades Administrativas de Execução
Art. 25. As unidades administrativas de execução da PMTO, subordinadas aos Comandos de Policiamento, são constituídas pelas Unidades Policiais Militares - UPM e Unidades Policiais Militares Especializadas - UPME, encarregadas de executar as atividades-fim da Corporação em determinada área, conforme Plano de Articulação da PMTO, podendo ser divididas em subunidades. Parágrafo único. As Unidades Policiais Militares - UPM são organizadas em Batalhões, Companhias e Pelotões.
Art. 26. O desdobramento e as atribuições das unidades administrativas de Execução, em todos os níveis, no território do Estado do Tocantins, consta do Plano de Articulação, elaborado pelo Estado Maior e aprovado por ato do Comandante-Geral da Polícia Militar.

Seção V - Das Unidades Administrativas Especiais
Art. 27. São unidades administrativas Especiais da PMTO os Colégios Militares do Estado do Tocantins - CMTO. Parágrafo único. Os Colégios Militares do Estado do Tocantins - CMTO subordinam-se à Diretoria de Programas Sociais da PMTO - DPS e podem ser criados mediante convênios, acordos, ajustes ou contratos com o Ministério da Educação, a Secretaria da Educação do Estado e dos Municípios. (Redação pela LC nº 149/2023).

Seção VI - Da Gestão Profissional
Art. 28. Os profissionais da PMTO compreendem: I - o pessoal ativo: a) os Oficiais do: 1. Quadro de Oficiais Policiais Militares - QOPM: constituído de Oficiais da carreira de combatentes, diplomados em Curso de Formação de Oficiais na PMTO ou em coirmã, quando designado pelo Comando da Corporação, iniciando a carreira no Posto de 2º Tenente, após o aspirantado, podendo alcançar o Posto de Coronel PM; 2. Quadro de Oficiais de Saúde - QOS: constituído de Oficiais de formação superior, admitidos mediante concurso público específico, nas áreas de Medicina, Odontologia, Serviço Social, Bioquímica ou Biomedicina, Enfermagem, Farmácia, Fisioterapia, Fonoaudiologia, Medicina Veterinária, Psicologia, Nutrição e Educação Física, iniciando a carreira no Posto de 2º Tenente, após o aspirantado; 3. Quadro de Oficiais Especialistas - QOE: constituído de Oficiais de formação superior, admitidos mediante concurso público específico, nas áreas de Administração, Direito, Economia, Ciências Contábeis, Pedagogia, Engenharia, Tecnologia da Informação e Teologia, iniciando a carreira no Posto de 2º Tenente, após o aspirantado, podendo alcançar o Posto de Tenente-Coronel PM; 4. Quadro de Oficiais de Administração - QOA: constituído de Oficiais habilitados em Curso de Habilitação de Oficiais de Administração, possuidores de formação superior, admitidos mediante seleção específica, dentre os Subtenentes com Curso de Aperfeiçoamento de Sargentos, podendo alcançar o Posto de Tenente-Coronel PM; 5. Quadro de Oficiais Músicos - QOM: constituído de Oficiais habilitados em Curso de Habilitação de Oficiais Músicos, possuidores de formação superior na área de Música, admitidos mediante seleção específica, dentre os Subtenentes do QPE, podendo alcançar o Posto de Tenente-Coronel PM; 6. Quadro de Oficiais da Administração da Saúde - QOAS: constituído de Oficiais habilitados em CHOAS, possuidores de formação superior na área da saúde, admitidos mediante seleção específica, dentre os Subtenentes do QPS, podendo alcançar o Posto de Tenente-Coronel PM; b) as Praças do: 1. Quadro de Praças Especiais - QPES: constituído pelos Aspirantes a Oficiais e Cadetes do Curso de Formação de Oficiais; 2. Quadro de Praças Policiais Militares - QPPM: constituído de Praças da carreira de combatentes, admitidos mediante concurso público para ingresso na Graduação de Aluno-Praça, podendo alcançar a Graduação de Subtenente PM; 3. Quadro de Praças Especialistas - QPE: constituído de Praças, admitidos mediante concurso público específico, na área técnica de música, para ingresso na Graduação de Aluno-Praça, podendo alcançar a Graduação de Subtenente PM; 4. Quadro de Praças de Saúde - QPS: constituído de Praças, admitidas mediante concurso público específico, na área técnica de enfermagem e de radiologia, e outras especialidades técnicas de saúde, para ingresso na Graduação de Aluno-Praça, podendo alcançar a Graduação de Subtenente PM; II - o pessoal inativo: a) da reserva remunerada: constituído de Oficiais e Praças transferidos para a reserva remunerada; b) reformados: constituído de Oficiais e Praças reformados.
§1º Os policiais militares integrantes dos diversos quadros da PMTO podem, por necessidade do serviço, ser convocados, designados, instruídos, mobilizados ou colocados de prontidão para trabalhos específicos, desde que possuam capacitação para a atividade.
§2º A carreira dos Oficiais pertencentes ao QOS pode alcançar o Posto de: I - Coronel, para os Oficiais admitidos mediante concurso na formação superior nas áreas de Medicina e Odontologia; II - Tenente-Coronel, para os Oficiais com formação superior nas demais áreas.
§3º Compete aos Oficiais do: I - QOPM: realizar o comando, a chefia, a assessoria e a direção das unidades que compõem a estrutura organizacional da PMTO; II - QOS: realizar os serviços respectivos de cada habilitação na área da saúde além de outros encargos próprios da carreira militar; III - QOE: exercer as atividades técnico-administrativas inerentes à habilitação específica e assistência religiosa dos Oficiais Capelães, além de outros encargos próprios da carreira militar; IV - QOAS: sem prejuízo da atividade operacional, exercer as atividades administrativas, além de outros encargos próprios da carreira militar; V - QOM: sem prejuízo da execução da habilidade instrumental, exercer atividades administrativas e a regência nas bandas de música, além de outros encargos próprios da carreira militar; VI - OAS: sem prejuízo das atividades específicas da área da saúde, exercer atividades administrativas, além de outros encargos próprios da carreira militar.
§4º Compete às Praças do: I - QPPM: executar atividades operacionais, além de outros encargos próprios da carreira militar; II - QPE: executar atividades na área de música, além de outros encargos próprios da carreira militar; III - QPS: executar atividades na área de saúde, além de outros encargos próprios da carreira militar.
Art. 29. O efetivo da PMTO é fixado em lei.
Art. 30. Respeitado o efetivo fixado em lei, cabe ao Chefe do Poder Executivo aprovar o Quadro de Organização e Distribuição do Efetivo (QOD). Parágrafo único. As graduações de Cadetes e Aluno-Praça não ocupam vagas no QOD.

CAPÍTULO III - DAS DISPOSIÇÕES GERAIS, TRANSITÓRIAS E FINAIS
Art. 31. A Polícia Militar pode se valer, na forma da lei, do profissional civil necessário aos serviços gerais e de natureza técnica ou especializada.
Art. 32. Compete ao Chefe do Poder Executivo, mediante Decreto, quando não implicar aumento de despesa, a criação, transformação, extinção, denominação, localização e a estruturação das unidades de direção, de apoio, de execução e especiais da PMTO, de acordo com a organização básica prevista nesta Lei e dentro dos limites fixados na lei de fixação de efetivos, mediante proposta do Comandante-Geral, observada a legislação específica.
Art. 33. Compete ao Comandante-Geral regulamentar os serviços das unidades administrativas que compõem a Corporação.
Art. 34. As funções de Comando e Chefia das unidades administrativas de Direção e de Apoio são exclusivas do posto de Coronel ou Tenente-Coronel do QOPM. Parágrafo único. A função de comando das unidades administrativas de Execução é exclusiva dos Oficiais do QOPM.
Art. 35. A Casa Militar - CAMIL é regida por legislação especial. Parágrafo único. Para todos os efeitos, os Policiais Militares lotados ou em efetivo exercício na Casa Militar - CAMIL desempenham função de natureza militar.
Art. 36. Os meios de comunicação oficiais da PMTO são o Boletim Geral e o Boletim Reservado. Parágrafo único. No âmbito das Unidades da PMTO, são meios de comunicação oficial o Boletim Interno e o Boletim Interno Reservado.
Art. 37. O requisito de formação superior para ingresso nos quadros constantes no art. 28, inciso I, alínea "a", itens 4, 5 e 6, será exigido a partir do ano de 2026.
Art. 38. Esta Lei Complementar entra em vigor na data de sua publicação.
Art. 39. Revoga-se a Lei Complementar 79, de 27 de abril de 2012.`,
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
    leiSeca: `LEI Nº 2.575, DE 20 DE ABRIL DE 2012 - Dispõe sobre as promoções na Polícia Militar do Estado do Tocantins.

CAPÍTULO I - DISPOSIÇÕES PRELIMINARES
Art. 1º Promoção é ato administrativo cuja finalidade principal é o reconhecimento do mérito e da habilitação do Policial Militar para o exercício de Posto ou Graduação imediatamente superior, mediante preenchimento das vagas existentes, de forma seletiva, gradual e sucessiva, nos QOD da PMTO, com base no efetivo fixado em lei.
§1º As formas seletivas, gradual e sucessiva resultam de planejamento para a carreira dos Policiais Militares, em cada quadro, de acordo com as respectivas especialidades.
§2º O planejamento da carreira policial militar é atribuição da PMTO, resultando em fluxo regular, contínuo e equilibrado.
Art. 2º Os Oficiais e as Praças da PMTO são promovidos na forma estabelecida nesta Lei.
Art. 3º As promoções na PMTO são realizadas, anualmente, nos dias 21 de abril e 15 de novembro.
§1º As promoções pelos critérios de bravura, post-mortem, ressarcimento de preterição, invalidez permanente e tempo de contribuição independem de data.
§2º Excepcionalmente, o Chefe do Poder Executivo pode fixar data diferente para promoção dos concluintes de cursos de formação ou habilitação.
Art. 4º O PM que, por ter sido transferido mediante requerimento, fruído licença a pedido, ou desempenhado função civil ou cargo público temporário não eletivo, não satisfazer os requisitos, é responsável único pela sua não inclusão em QA.
Art. 5º O PM cujo comportamento for inferior a "bom" não pode constar de qualquer QA. Parágrafo único: comportamento do Oficial classificado conforme previsto para Praça no Estatuto.
Art. 6º O PM deve levar ao conhecimento do CG ato ou fato grave que possa influir na avaliação do colega. Investigação a cargo de integrante da Comissão de Promoção.
Art. 7º Guarda-se a proporção de uma promoção pelo critério de antiguidade e uma pelo de merecimento. Parágrafo único: preenchimento contínuo em relação às promoções da data anterior.

CAPÍTULO II - DA ABERTURA DE VAGAS
Art. 8º Vaga computada para promoção decorrente de: I - promoção; II - agregação; III - passagem para inatividade; IV - demissão; V - exoneração; VI - falecimento; VII - aumento de efetivo; VIII - modificação no QOD. Parágrafo único: quantitativo definido por ato do Chefe do Poder Executivo (Oficiais) ou CG (Praças).
Art. 9º Vaga aberta na data da publicação dos atos do art. 8º. §1º Promoção a um Posto/Graduação acarreta abertura de vaga no grau imediatamente inferior. §2º Não preenche vaga o PM promovido que permaneça agregado.
Art. 10. Na promoção por ressarcimento de preterição, inexistindo vaga, é considerado excedente o PM mais moderno.

CAPÍTULO III - DAS COMISSÕES DE PROMOÇÃO
Art. 11. CPO presidida pelo CG, membros: natos (CHEM e SCHEM) e efetivos (4 Oficiais Superiores, Coronéis e Ten-Cel). Substituição: CG pelo CHEM; demais por indicação do CG.
Art. 12. CPP presidida pelo CHEM, membros: natos (SCHEM e DGP) e efetivos (4 Oficiais, preferencialmente superiores).
Art. 13. Decisões da CPP submetidas ao CG para homologação e publicação em BG.
Art. 14. CPO e CPP reúnem-se com totalidade dos membros.
Art. 15. Decisões por maioria simples; Presidente com voto de qualidade.
Art. 16. Ausência justificada apenas por doença ou necessidade do serviço.
Art. 17. CG baixa regimentos internos da CPO e CPP.
Art. 18. Secretaria executada pelo Chefe da 2ª Seção do EM.
Art. 19. Competências da CPO: I - organizar QA (art. 32); II - publicar QA em Boletim Reservado; III - conhecer recursos sobre QA; IV - propor exclusão de Oficial do QA; V - fixar datas limites para documentos; VI - apreciar promoções por bravura, invalidez e post-mortem; VII - apreciar conceito (art. 44); VIII - selecionar elogios e punições; IX - organizar relação de impedidos; X - deliberar sobre concluintes de CHO; XI - deliberar sobre agregados a reverter; XII - deliberar sobre exclusão de impedidos; XIII - deliberar sobre impedimento temporário por IPM; XIV - organizar relação de avaliados com pontuações; XV - proceder diligências necessárias.
Art. 20. CPP: mesmas competências da CPO no que couber.

CAPÍTULO IV - DOS CRITÉRIOS
Art. 21. Critérios de promoção: I - antiguidade; II - merecimento; III - escolha; IV - bravura; V - post-mortem; VI - tempo de contribuição; VII - invalidez permanente. Parágrafo único: pode ser promovido em ressarcimento de preterição o PM preterido.
Art. 22. Promoção por antiguidade decorre da precedência hierárquica de um PM sobre os demais de igual Posto/Graduação do mesmo quadro.
Art. 23. Promoção por merecimento pressupõe o conjunto de qualidades e atributos que distinguem e realçam o valor do PM entre os pares, avaliados no decurso da carreira.
Art. 24. Promoção por escolha: ato do Chefe do Poder Executivo, ascensão ao Posto de Coronel do Ten-Cel qualificado para altos cargos de comando, chefia ou direção.
Art. 25. Promoção por bravura resulta de ato não comum de coragem, audácia e abnegação, ultrapassando limites do cumprimento do dever.
Art. 26. Promoção post-mortem expressa reconhecimento ao PM falecido no cumprimento do dever ou em consequência dele, ou reconhecer direito à promoção não conferido em razão do óbito.
Art. 27. Promoção por tempo de contribuição concedida ao PM que complete o tempo necessário à transferência a pedido para a reserva remunerada.
Art. 28. Promoção por invalidez deferida ao PM ativo ou inativo julgado definitivamente incapaz para o serviço militar pela JMCS, em razão de ferimento ou enfermidade decorrente do cumprimento do dever, comprovado por sindicância ou IPM.
Art. 29. Promoções por antiguidade, merecimento e escolha dependem de prévia inclusão do PM no QA respectivo.

CAPÍTULO V - DAS PROMOÇÕES POR MERECIMENTO, ANTIGUIDADE E ESCOLHA
Seção I - Quadros de Acesso
Art. 30. QA: quantitativo nominal dos PMs habilitados à promoção, organizados por critério, grau hierárquico e quadro da carreira.
Art. 31. Ingresso nos QA pressupõe: I - interstício; II - condições de saúde (inspeção médica oficial); III - requisitos peculiares a cada Posto/Graduação; IV - pontuação positiva na avaliação profissional e moral. Parágrafo único: inciso IV não se aplica a antiguidade e escolha.
Art. 32. Relação nominal nos QA: I - QAA: precedência hierárquica no almanaque; II - QAM: pontuação decrescente na avaliação; III - QAE: antiguidade dos Ten-Cel no almanaque. §1º QA não excede o quantitativo de vagas. §2º Desempate no merecimento: pela antiguidade.
Art. 33. Não se inclui/exclui do QA o PM: I - que não satisfizer condições do art. 31; II - que estiver: a) sub judice ou em IPM por fato infamante; b) submetido a procedimento de indignidade; c) em cumprimento de pena restritiva de liberdade; d) agregado (exceto art. 142, §3º, III CF, para antiguidade); e) em licença interesse particular ou saúde familiar >6 meses; III - ausente ou desertor; IV - incapacitado definitivamente; V - desaparecido ou extraviado; VI - falecido; VII - condenado definitivamente por crime doloso; VIII - licenciado ou transferido para inatividade; IX - revertido a menos de 60 dias da data da promoção.
Art. 34. QA organizados separadamente por quadros e publicados até 15 dias antes da promoção. §1º QA em Boletim Reservado (Oficiais) e BG (Praças).
Art. 35. PM que não satisfizer condições de curso, interstício ou serviço arregimentado mas possa satisfazê-las, pode ser incluído sob condição. Parágrafo único: exigência de curso não se aplica quando não oportunizado pela Corporação.
Art. 36. Interstício mínimo: I - Praças: a) Soldado 60 meses; b) Cabo 48 meses; c) 3ºSgt 24 meses; d) 2ºSgt 24 meses; e) 1ºSgt 24 meses. II - Oficiais: a) Aspirante 6 meses; b) 2ºTen 24 meses; c) 1ºTen 36 meses; d) Capitão 36 meses; e) Major 36 meses; f) Ten-Cel 36 meses.
Art. 37. Interstício pode ser reduzido à metade por ato do Chefe do Poder Executivo (Oficiais) ou CG (Praças).

Seção II - Da Condição de Saúde
Art. 38. Higidez indispensável ao exercício no novo Posto/Graduação. §1º Saúde verificada em inspeção médica oficial. §2º Incapacidade física temporária não impede ingresso no QA nem promoção. §3º Incapacidade definitiva: situação definida nos termos da lei.

Seção III - Das Condições Peculiares
Art. 39. Atividades peculiares: I - cursos; II - serviço arregimentado; III - exercício de função específica.
§1º Cursos: a) CHC (promoção a Cabo); b) CHS (promoção a 3º, 2º e 1ºSgt); c) CAS (promoção a Subtenente); d) CFO/CHO (promoção até Capitão); e) CAO (promoção a Major e Ten-Cel); f) CSP (promoção a Coronel - revogado pela Lei 2.765/2013).
§4º Serviço arregimentado: tempo no exercício de funções militares previstas nos QOD.
§5º Computado como arregimentado: tempo na Casa Militar e órgãos de direção, apoio, execução e especiais.
§6º Mínimo 1/3 do interstício em serviço arregimentado para ingresso no QA.
§7º Exigência de curso não se aplica quando não oportunizado pela Corporação ao PM que complete o interstício.
Art. 40. Função específica: execução das atividades previstas para o Posto/Graduação, incluindo substituições eventuais.

Seção IV - Da Avaliação Profissional e Moral
Art. 41. Pontuação final do QAM: diferença entre pontos positivos e negativos. §1º Classificação resulta do valor positivo. §2º Não se inclui no QAM o PM cujos negativos superem os positivos.
Art. 42. Valores numéricos positivos: I - tempo de efetivo serviço: 2 pts/semestre; II - tempo no Posto/Graduação atual: 3 pts/semestre; III - exercício em atividade PM no grau atual: 10 pts/6 meses; IV - média final no curso de formação/habilitação/aperfeiçoamento: >=9 (30pts), 8-8,99 (20pts), 7-7,99 (10pts); V - curso civil MEC (não exigido para acesso): graduação 10pts, especialização 5pts, mestrado 15pts, doutorado 20pts, pós-doutorado 30pts; VI - classificação geral em curso: 1º lugar 15pts, 2º 10pts, 3º 5pts; VII - curso profissionalizante militar >=150h: >=9 (7pts), 8-8,99 (5pts), 7-7,99 (3pts); VIII - elogio individual em boletim: Ação Meritória Excepcional 10pts, Ação Destacada 5pts; IX - comportamento militar: excepcional 15pts, ótimo 10pts, bom 5pts; X - pontuação do Conceito Profissional e Moral; XI - trabalho técnico-científico de interesse institucional: 10pts (uma vez); XII - curso/estágio profissionalizante 40-150h: 1pt cada, até 10 cursos; XIII - atividade Pioneiros Mirins: 1pt/12 meses.
Art. 43. Valores numéricos negativos: I - punições disciplinares: a) prisão: 20pts + dias da punição; b) detenção: 10pts + 1pt/2 dias; c) repreensão: 5pts + igual por reincidência; II - sentença penal condenatória transitada em julgado: 100pts; III - desligamento de curso: falta de aproveitamento 40pts, motivo disciplinar 50pts, desistência 30pts; IV - conclusão em segunda época: 30pts; V - dispensa de função/serviço por motivo disciplinar: 20pts. §2º Punições dos últimos 5 anos. §3º Sentença até reabilitação penal.

Seção V - Do Conceito Profissional e Moral
Art. 44. Conceito graduado de 0 a 130 pontos, atribuído individualmente pelo Comandante ao qual subordinado nos últimos 6 meses.
§1º Quesitos: I - contribuição para hierarquia e disciplina; II - interesse no aprimoramento intelectual e profissional; III - consciência ética e respeito aos direitos/deveres da cidadania; IV - destemor e segurança nas atitudes; V - disponibilidade e compromisso com resultado; VI - criatividade; VII - iniciativa no exercício profissional; VIII - apresentação e higiene pessoais; IX - esforço de aprimoramento físico; X - zelo com bens da Fazenda Pública; XI - relacionamento em sociedade; XII - pontualidade e assiduidade; XIII - organização e qualidade.
§2º Pontuação por quesito: Excelente 10pts, Muito Bom 8pts, Bom 5pts, Regular 3pts, Insuficiente 0pts.
§3º Valor final: soma dos valores de cada quesito. §4º Conceito final: média aritmética dos avaliadores.
Art. 45. Somente figura no QAM o PM com mínimo de 65 pontos no Conceito Profissional e Moral.
Art. 46. Conceito inferior a 65 e superior a 120 deve ser justificado pelo avaliador.

Seção VI - Da Promoção do Tenente Coronel
Art. 47. Promoção de Ten-Cel a Coronel pelo critério de escolha.
Art. 48. Chefe do Poder Executivo efetiva a promoção em lista dos Ten-Cel que atendam requisitos do art. 31. Parágrafo único: não cabe recurso administrativo.

CAPÍTULO VI - DA PROMOÇÃO POR BRAVURA, POST-MORTEM, TEMPO DE CONTRIBUIÇÃO E INVALIDEZ
Art. 49. Ato de bravura comprovado em sindicância instaurada para esse fim. §1º Ato apreciado uma só vez. §2º Decai em 1 ano o direito de requerer promoção por bravura.
Art. 50. Inexistindo vaga, promovido por bravura ocupa a primeira que abrir. Parágrafo único: não altera sequência do art. 7º.
Art. 51. PM promovido por bravura que não atenda requisitos da nova posição deve cumpri-los. §1º Corporação providencia matrícula no curso. §2º Transferido para reserva ex-officio se não adquirir diplomação no prazo.
Art. 52. PM promovido post-mortem quando: I - óbito: a) em ação de manutenção da ordem pública; b) em consequência de ferimento/doença contraída em ação; c) em acidente a serviço; II - ao falecer, já cumpria condições de acesso e integrava a faixa de concorrentes. Parágrafo único: independe de Posto superior, vaga, interstício ou curso.
Art. 53. Óbito no cumprimento do dever comprovado em sindicância ou IPM.
Art. 54. Requisitos para promoção por tempo de contribuição: I - 30 anos de contribuição (homem), 25 anos (mulher); II - não ser Coronel. §1º Independe de Posto superior, vaga, interstício ou curso. §2º Subtenente promovido a 2ºTen. §3º Promoção precede ato de transferência para reserva.
Art. 55. PM promovido por invalidez quando julgado pela JMCS definitivamente incapaz em consequência de: I - ferimento/doença em ação de manutenção da ordem pública; II - acidente a serviço ou doença que nele tenha causa eficiente.
Art. 56. Promoção por invalidez independe de Posto superior, vaga, interstício ou curso.
Art. 57. PM do último Posto que satisfaça requisitos de invalidez tem subsídio acrescido do percentual da Lei 1.775/2007.

CAPÍTULO VII - DOS RECURSOS
Art. 58. Recurso contra composição de QA ou preterição dirigido ao CG, encaminhado à comissão de promoção.
Art. 59. Recurso contra promoção efetivada: I - ao CG (Praças); II - ao Chefe do Poder Executivo (Oficiais).
Art. 60. Prazo de 10 dias da publicação oficial para recorrer da composição do QA. Parágrafo único: recurso solucionado em 90 dias.
Art. 61. Ressarcimento de preterição quando: I - comprovado erro administrativo; II - cessada situação de desaparecimento/extravio; III - absolvido no processo; IV - julgado apto por Conselho.

CAPÍTULO VIII - DOS CURSOS DE HABILITAÇÃO E APERFEIÇOAMENTO
Art. 62. Matrícula exige: I - comportamento mínimo Bom; II - sem sentença condenatória transitada em julgado; III - apto em inspeção médica. Parágrafo único - cursos específicos: I - CSP: Coronel ou Ten-Cel do QOPM, designado pelo CG por antiguidade; II - CAO: Capitão do QOPM, designado pelo CG por antiguidade; III - CHOA: Subtenente ou 1ºSgt do QPPM, diplomado no CAS, aprovado em seleção ou convocado (art. 64); IV - CHOM: Subtenente ou 1ºSgt do QPE; V - CAS: 1ºSgt do QPPM, designado pelo CG por antiguidade; VI - CHS: Cabo, aprovado em seleção ou convocado (art. 65); VII - CHC: Soldado, aprovado em seleção ou convocado (art. 66).
Art. 63. Vagas CHOA e CHOM: I - 30% Subtenentes com 24+ meses e 17 anos de serviço, por antiguidade; II - 70% Subtenentes ou 1ºSgt com 24+ meses, por seleção interna.
Art. 64. Vagas CHS: I - 30% Cabos com 48+ meses e 9 anos de serviço, por antiguidade; II - 70% Cabos com 48+ meses, por seleção interna.
Art. 65. Vagas CHC: I - 30% Soldados com 60+ meses, por antiguidade; II - 70% Soldados com 60+ meses, por seleção interna.
Art. 66. Praças do QPPM, QPS e QPE concorrem às vagas em edital nos respectivos quadros.

CAPÍTULO IX - DISPOSIÇÕES GERAIS E FINAIS
Art. 67. Não há promoção onde houver excedente, salvo ressarcimento de preterição.
Art. 68. Primeira vaga preenchida pelo critério de antiguidade.
Art. 69. Revogam-se as Leis 127/1990 e 1.381/2003.
Art. 70. Esta Lei entra em vigor na data de sua publicação.`,
  },
  {
    disciplina: "CPPM",
    leiNome: "Código de Processo Penal Militar — Arts. 8º a 28º e 243º a 253º",
    fonteUrl: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm",
    assuntos: [
      "Polícia Judiciária Militar (Arts. 7º e 8º): exercício, competências, delegação, requisitos do encarregado",
      "Inquérito Policial Militar (Arts. 9º a 22): conceito, finalidade, modos de início, medidas preliminares, formação, encarregado, escrivão, sigilo, incomunicabilidade, detenção, prazos, relatório",
      "Remessa e Arquivamento do IPM (Arts. 23 a 28): remessa à Auditoria, proibição de arquivamento pela autoridade militar, instauração de novo inquérito, devolução de autos, auto de flagrante como inquérito, dispensa de inquérito",
      "Prisão em Flagrante (Arts. 243 a 253): pessoas que efetuam, hipóteses de flagrante, infrações permanentes, lavratura do auto, nota de culpa, relaxamento, remessa ao juiz, liberdade provisória",
    ],
    leiSeca: `DECRETO-LEI Nº 1.002, DE 21 DE OUTUBRO DE 1969 - CÓDIGO DE PROCESSO PENAL MILITAR
APENAS Arts. 8º a 28º e Arts. 243º a 253º conforme edital.

TÍTULO II - DA POLÍCIA JUDICIÁRIA MILITAR
Art. 7º A polícia judiciária militar é exercida nos termos do art. 8º, pelas seguintes autoridades, conforme as respectivas jurisdições: a) pelos ministros da Marinha, do Exército e da Aeronáutica, em todo o território nacional e fora dele; b) pelo chefe do Estado-Maior das Forças Armadas; c) pelos chefes de Estado-Maior e pelo secretário-geral da Marinha; d) pelos comandantes de Exército e pelo comandante-chefe da Esquadra; e) pelos comandantes de Região Militar, Distrito Naval ou Zona Aérea; f) pelo secretário do Ministério do Exército e pelo chefe de Gabinete do Ministério da Aeronáutica; g) pelos diretores e chefes de órgãos, repartições, estabelecimentos ou serviços previstos nas leis de organização básica; h) pelos comandantes de forças, unidades ou navios. §1º As atribuições poderão ser delegadas a oficiais da ativa, para fins especificados e por tempo limitado. §2º A delegação para instauração de IPM deverá recair em oficial de posto superior ao do indiciado. §3º Não sendo possível, poderá ser feita a de oficial do mesmo posto, desde que mais antigo. §4º Se o indiciado é oficial da reserva ou reformado, não prevalece a antiguidade de posto. §5º Se o posto e a antiguidade excluírem de modo absoluto a existência de outro oficial nas condições do §3º, caberá ao ministro competente a designação de oficial da reserva de posto mais elevado.
Art. 8º Compete à Polícia judiciária militar: a) apurar os crimes militares, bem como os que, por lei especial, estão sujeitos à jurisdição militar, e sua autoria; b) prestar aos órgãos e juízes da Justiça Militar e aos membros do Ministério Público as informações necessárias à instrução e julgamento dos processos, bem como realizar as diligências que por eles lhe forem requisitadas; c) cumprir os mandados de prisão expedidos pela Justiça Militar; d) representar a autoridades judiciárias militares acerca da prisão preventiva e da insanidade mental do indiciado; e) cumprir as determinações da Justiça Militar relativas aos presos sob sua guarda e responsabilidade, bem como as demais prescrições deste Código, nesse sentido; f) solicitar das autoridades civis as informações e medidas que julgar úteis à elucidação das infrações penais, que esteja a seu cargo; g) requisitar da polícia civil e das repartições técnicas civis as pesquisas e exames necessários ao complemento e subsídio de inquérito policial militar; h) atender, com observância dos regulamentos militares, a pedido de apresentação de militar ou funcionário de repartição militar à autoridade civil competente, desde que legal e fundamentado o pedido.

TÍTULO III - DO INQUÉRITO POLICIAL MILITAR
Art. 9º O inquérito policial militar é a apuração sumária de fato, que, nos termos legais, configure crime militar, e de sua autoria. Tem o caráter de instrução provisória, cuja finalidade precípua é a de ministrar elementos necessários à propositura da ação penal. Parágrafo único. São, porém, efetivamente instrutórios da ação penal os exames, perícias e avaliações realizados regularmente no curso do inquérito, por peritos idôneos e com obediência às formalidades previstas neste Código.
Art. 10. O inquérito é iniciado mediante portaria: a) de ofício, pela autoridade militar em cujo âmbito de jurisdição ou comando haja ocorrido a infração penal, atendida a hierarquia do infrator; b) por determinação ou delegação da autoridade militar superior, que, em caso de urgência, poderá ser feita por via telegráfica ou radiotelefônica e confirmada, posteriormente, por ofício; c) em virtude de requisição do Ministério Público; d) por decisão do Superior Tribunal Militar, nos termos do art. 25; e) a requerimento da parte ofendida ou de quem legalmente a represente, ou em virtude de representação devidamente autorizada de quem tenha conhecimento de infração penal, cuja repressão caiba à Justiça Militar; f) quando, de sindicância feita em âmbito de jurisdição militar, resulte indício da existência de infração penal militar. §1º Tendo o infrator posto superior ou igual ao do comandante, será feita a comunicação do fato à autoridade superior competente. §2º O aguardamento da delegação não obsta que o oficial responsável tome ou determine que sejam tomadas imediatamente as providências cabíveis, previstas no art. 12. §3º Se a infração penal não for, evidentemente, de natureza militar, comunicará o fato à autoridade policial competente. §4º Se o infrator for oficial general, será sempre comunicado o fato ao ministro e ao chefe de Estado-Maior competentes. §5º Se, no curso do inquérito, o seu encarregado verificar a existência de indícios contra oficial de posto superior ao seu, ou mais antigo, tomará as providências necessárias para que as suas funções sejam delegadas a outro oficial.
Art. 11. A designação de escrivão para o inquérito caberá ao respectivo encarregado, se não tiver sido feita pela autoridade que lhe deu delegação, recaindo em segundo ou primeiro-tenente, se o indiciado for oficial, e em sargento, se praça. Parágrafo único. O escrivão prestará compromisso de manter o sigilo do inquérito e de cumprir fielmente as determinações deste Código.
Art. 12. Logo que tiver conhecimento da prática de infração penal militar, verificável na ocasião, a autoridade deverá, se possível: a) dirigir-se ao local, providenciando para que se não alterem o estado e a situação das coisas, enquanto necessário; b) apreender os instrumentos e todos os objetos que tenham relação com o fato; c) efetuar a prisão do infrator, observado o disposto no art. 244; d) colher todas as provas que sirvam para o esclarecimento do fato e suas circunstâncias.
Art. 13. O encarregado do inquérito deverá, para a formação deste: a) tomar as medidas previstas no art. 12; b) ouvir o ofendido; c) ouvir o indiciado; d) ouvir testemunhas; e) proceder a reconhecimento de pessoas e coisas, e acareações; f) determinar, se for o caso, que se proceda a exame de corpo de delito e a quaisquer outros exames e perícias; g) determinar a avaliação e identificação da coisa subtraída, desviada, destruída ou danificada; h) proceder a buscas e apreensões, nos termos dos arts. 172 a 184 e 185 a 189; i) tomar as medidas necessárias destinadas à proteção de testemunhas, peritos ou do ofendido. Parágrafo único. Para verificar a possibilidade de haver sido a infração praticada de determinado modo, o encarregado do inquérito poderá proceder à reprodução simulada dos fatos, desde que esta não contrarie a moralidade ou a ordem pública, nem atente contra a hierarquia ou a disciplina militar.
Art. 14. Em se tratando de apuração de fato delituoso de excepcional importância ou de difícil elucidação, o encarregado do inquérito poderá solicitar do procurador-geral a indicação de procurador que lhe dê assistência.
Art. 15. Será encarregado do inquérito, sempre que possível, oficial de posto não inferior ao de capitão ou capitão-tenente; e, em se tratando de infração penal contra a segurança nacional, sê-lo-á, sempre que possível, oficial superior, atendida, em cada caso, a sua hierarquia, se oficial o indiciado.
Art. 16. O inquérito é sigiloso, mas seu encarregado pode permitir que dele tome conhecimento o advogado do indiciado.
Art. 16-A. Nos casos em que servidores das polícias militares e dos corpos de bombeiros militares figurarem como investigados em IPM cujo objeto for a investigação de fatos relacionados ao uso da força letal praticados no exercício profissional, o indiciado poderá constituir defensor. (Incluído pela Lei nº 13.964/2019). §1º O investigado deverá ser citado da instauração do procedimento investigatório, podendo constituir defensor no prazo de até 48 horas a contar do recebimento da citação. §2º Esgotado o prazo do §1º com ausência de nomeação de defensor pelo investigado, a autoridade responsável pela investigação deverá intimar a instituição a que estava vinculado o investigado à época da ocorrência dos fatos, para que esta, no prazo de 48 horas, indique defensor.
Art. 17. O encarregado do inquérito poderá manter incomunicável o indiciado, que estiver legalmente preso, por três dias no máximo.
Art. 18. Independentemente de flagrante delito, o indiciado poderá ficar detido, durante as investigações policiais, até trinta dias, comunicando-se a detenção à autoridade judiciária competente. Esse prazo poderá ser prorrogado, por mais vinte dias, pelo comandante da Região, Distrito Naval ou Zona Aérea, mediante solicitação fundamentada do encarregado do inquérito e por via hierárquica. Parágrafo único. Se entender necessário, o encarregado do inquérito solicitará, dentro do mesmo prazo ou sua prorrogação, justificando-a, a decretação da prisão preventiva ou de menagem, do indiciado.
Art. 19. As testemunhas e o indiciado, exceto caso de urgência inadiável, devem ser ouvidos durante o dia, em período que medeie entre as sete e as dezoito horas. §1º O escrivão lavrará assentada do dia e hora do início das inquirições ou depoimentos; e, da mesma forma, do seu encerramento ou interrupções. §2º A testemunha não será inquirida por mais de quatro horas consecutivas, sendo-lhe facultado o descanso de meia hora. §3º Não sendo útil o dia seguinte, a inquirição poderá ser adiada para o primeiro dia que o for, salvo caso de urgência.
Art. 20. O inquérito deverá terminar dentro em vinte dias, se o indiciado estiver preso, contado esse prazo a partir do dia em que se executar a ordem de prisão; ou no prazo de quarenta dias, quando o indiciado estiver solto, contados a partir da data em que se instaurar o inquérito. §1º Este último prazo poderá ser prorrogado por mais vinte dias pela autoridade militar superior, desde que não estejam concluídos exames ou perícias já iniciados, ou haja necessidade de diligência indispensável à elucidação do fato. §2º Não haverá mais prorrogação, além da prevista no §1º, salvo dificuldade insuperável, a juízo do ministro de Estado competente. §3º São deduzidas dos prazos referidos neste artigo as interrupções pelo motivo previsto no §5º do art. 10.
Art. 21. Todas as peças do inquérito serão, por ordem cronológica, reunidas num só processado e datilografadas, em espaço dois, com as folhas numeradas e rubricadas, pelo escrivão. Parágrafo único. De cada documento junto, a que precederá despacho do encarregado do inquérito, o escrivão lavrará o respectivo termo, mencionando a data.
Art. 22. O inquérito será encerrado com minucioso relatório, em que o seu encarregado mencionará as diligências feitas, as pessoas ouvidas e os resultados obtidos, com indicação do dia, hora e lugar onde ocorreu o fato delituoso. Em conclusão, dirá se há infração disciplinar a punir ou indício de crime, pronunciando-se, neste último caso, justificadamente, sobre a conveniência da prisão preventiva do indiciado. §1º No caso de ter sido delegada a atribuição para a abertura do inquérito, o seu encarregado enviá-lo-á à autoridade de que recebeu a delegação, para que lhe homologue ou não a solução. §2º Discordando da solução dada ao inquérito, a autoridade que o delegou poderá avocá-lo e dar solução diferente.
Art. 23. Os autos do inquérito serão remetidos ao auditor da Circunscrição Judiciária Militar onde ocorreu a infração penal, acompanhados dos instrumentos desta, bem como dos objetos que interessem à sua prova. §1º Na Circunscrição onde houver Auditorias Especializadas, atender-se-á, para a remessa, à especialização de cada uma. §2º Os autos de inquérito instaurado fora do território nacional serão remetidos à 1ª Auditoria da Circunscrição com sede na Capital da União.
Art. 24. A autoridade militar não poderá mandar arquivar autos de inquérito, embora conclusivo da inexistência de crime ou de inimputabilidade do indiciado.
Art. 25. O arquivamento de inquérito não obsta a instauração de outro, se novas provas aparecerem em relação ao fato, ao indiciado ou a terceira pessoa, ressalvados o caso julgado e os casos de extinção da punibilidade. §1º Verificando a hipótese contida neste artigo, o juiz remeterá os autos ao Ministério Público. §2º O Ministério Público poderá requerer o arquivamento dos autos, se entender inadequada a instauração do inquérito.
Art. 26. Os autos de inquérito não poderão ser devolvidos a autoridade policial militar, a não ser: I — mediante requisição do Ministério Público, para diligências imprescindíveis ao oferecimento da denúncia; II — por determinação do juiz, antes da denúncia, para o preenchimento de formalidades ou para complemento de prova. Parágrafo único. Em qualquer dos casos, o juiz marcará prazo, não excedente de vinte dias, para a restituição dos autos.
Art. 27. Se, por si só, for suficiente para a elucidação do fato e sua autoria, o auto de flagrante delito constituirá o inquérito, dispensando outras diligências, salvo o exame de corpo de delito no crime que deixe vestígios, a identificação da coisa e a sua avaliação, quando o seu valor influir na aplicação da pena.
Art. 28. O inquérito poderá ser dispensado, sem prejuízo de diligência requisitada pelo Ministério Público: a) quando o fato e sua autoria já estiverem esclarecidos por documentos ou outras provas materiais; b) nos crimes contra a honra, quando decorrerem de escrito ou publicação, cujo autor esteja identificado; c) nos crimes previstos nos arts. 341 e 349 do Código Penal Militar.

SEÇÃO II - DA PRISÃO EM FLAGRANTE (Arts. 243 a 253)
Art. 243. Qualquer pessoa poderá e os militares deverão prender quem for insubmisso ou desertor, ou seja encontrado em flagrante delito.
Art. 244. Considera-se em flagrante delito aquele que: a) está cometendo o crime; b) acaba de cometê-lo; c) é perseguido logo após o fato delituoso em situação que faça acreditar ser ele o seu autor; d) é encontrado, logo depois, com instrumentos, objetos, material ou papéis que façam presumir a sua participação no fato delituoso. Parágrafo único. Nas infrações permanentes, considera-se o agente em flagrante delito enquanto não cessar a permanência.
Art. 245. Apresentado o preso ao comandante ou ao oficial de dia, de serviço ou de quarto, ou autoridade correspondente, ou à autoridade judiciária, será, por qualquer deles, ouvido o condutor e as testemunhas que o acompanharem, bem como inquirido o indiciado sobre a imputação que lhe é feita, e especialmente sobre o lugar e hora em que o fato aconteceu, lavrando-se de tudo auto, que será por todos assinado. §1º Em se tratando de menor inimputável, será apresentado, imediatamente, ao juiz de menores. §2º A falta de testemunhas não impedirá o auto de prisão em flagrante, que será assinado por duas pessoas, pelo menos, que hajam testemunhado a apresentação do preso. §3º Quando a pessoa conduzida se recusar a assinar, não souber ou não puder fazê-lo, o auto será assinado por duas testemunhas. §4º Sendo o auto presidido por autoridade militar, designará esta, para exercer as funções de escrivão, um capitão, capitão-tenente, primeiro ou segundo-tenente, se o indiciado for oficial. Nos demais casos, poderá designar um subtenente, suboficial ou sargento. §5º Na falta ou impedimento de escrivão, a autoridade designará qualquer pessoa idônea, que prestará o compromisso legal.
Art. 246. Se das respostas resultarem fundadas suspeitas contra a pessoa conduzida, a autoridade mandará recolhê-la à prisão, procedendo-se, imediatamente, se for o caso, a exame de corpo de delito, à busca e apreensão dos instrumentos do crime e a qualquer outra diligência necessária ao seu esclarecimento.
Art. 247. Dentro em vinte e quatro horas após a prisão, será dada ao preso nota de culpa assinada pela autoridade, com o motivo da prisão, o nome do condutor e os das testemunhas. §1º Da nota de culpa o preso passará recibo que será assinado por duas testemunhas, quando ele não souber, não puder ou não quiser assinar. §2º Se a autoridade militar ou judiciária verificar a manifesta inexistência de infração penal militar ou a não participação da pessoa conduzida, relaxará a prisão. Em se tratando de infração penal comum, remeterá o preso à autoridade civil competente.
Art. 248. Em qualquer hipótese, de tudo quanto ocorrer será lavrado auto ou termo, para remessa à autoridade judiciária competente, a fim de que esta confirme ou infirme os atos praticados.
Art. 249. Quando o fato for praticado em presença da autoridade, ou contra ela, no exercício de suas funções, deverá ela própria prender e autuar em flagrante o infrator, mencionando a circunstância.
Art. 250. Quando a prisão em flagrante for efetuada em lugar não sujeito à administração militar, o auto poderá ser lavrado por autoridade civil, ou pela autoridade militar do lugar mais próximo daquele em que ocorrer a prisão.
Art. 251. O auto de prisão em flagrante deve ser remetido imediatamente ao juiz competente, se não tiver sido lavrado por autoridade judiciária; e, no máximo, dentro em cinco dias, se depender de diligência prevista no art. 246. Parágrafo único. Lavrado o auto de flagrante delito, o preso passará imediatamente à disposição da autoridade judiciária competente para conhecer do processo.
Art. 252. O auto poderá ser mandado ou devolvido à autoridade militar, pelo juiz ou a requerimento do Ministério Público, se novas diligências forem julgadas necessárias ao esclarecimento do fato.
Art. 253. Quando o juiz verificar pelo auto de prisão em flagrante que o agente praticou o fato nas condições dos arts. 35, 38, observado o disposto no art. 40, e dos arts. 39 e 42, do Código Penal Militar, poderá conceder ao indiciado liberdade provisória, mediante termo de comparecimento a todos os atos do processo, sob pena de revogar a concessão.`,
  },
  {
    disciplina: "RDMETO",
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins — Decreto nº 4.994/2014",
    fonteUrl: "https://central3.to.gov.br/arquivo/179903/",
    assuntos: [
      "Disposições Gerais e Deontologia Militar (Arts. 1º a 13): finalidade, sujeição ao RDMETO, conceitos (honra, pundonor, decoro, hierarquia, disciplina, transgressão), direitos humanos, manifestações da disciplina, ordens, camaradagem",
      "Comunicação e Sindicância (Arts. 14 a 29): Parte (comunicação de fato transgressivo), instauração, competência, impedimento, autuação, citação, interrogatório, defesa preliminar",
      "Instrução Processual (Arts. 30 a 78): testemunhas, ofendido, acareação, reconhecimento, insanidade mental, diligências, carta precatória, revelia, defensor (constituído, dativo, ad hoc)",
      "Relatório, Solução e Recursos (Arts. 80 a 103): alegações finais, relatório do sindicante, prazo (30 dias + 20 prorrogação), suspensão e interrupção, solução, enquadramento, fase recursal (reconsideração 5 dias úteis, recurso hierárquico 5 dias úteis), modificação (relevação e atenuação), anulação",
      "Punições Disciplinares (Arts. 104 a 128): advertência, repreensão, detenção, prisão, demissão, pontuação (leve 5pts, média 20pts, grave 30pts), atenuantes (+3pts) e agravantes (-3pts), causas de justificação, exclusão da infração, extinção da punibilidade, prescrição, comportamento das praças, cancelamento e anulação de registro",
      "Conselhos de Justificação e Disciplina (Arts. 130 a 171): constituição, prazos (50 dias + 30), sessão inaugural, libelo acusatório, instrução, alegações finais, deliberação, relatório, decisão (20 dias), apelação (15 dias úteis), medidas (IPM, reforma, reserva, demissão)",
    ],
    leiSeca: `DECRETO Nº 4.994, DE 14 DE FEVEREIRO DE 2014 - Regulamento Disciplinar dos Militares Estaduais do Tocantins (RDMETO).

CAPÍTULO I - DISPOSIÇÕES GERAIS
Art. 1º O RDMETO tem por finalidade regular os processos administrativos disciplinares de que trata a Lei 2.578/2012.
Art. 2º Sujeitam-se ao RDMETO: I - militares do Estado (ativa, reserva, agregados, reformados); II - alunos dos cursos de formação; III - militares matriculados em outras corporações; IV - militares designados/cedidos. Parágrafo único: aplica-se também quando no meio civil infrinjam hierarquia, disciplina, ética, pundonor e decoro.
Art. 3º Conceitos: I - honra pessoal: sentimento de dignidade própria; II - pundonor militar: dever de alto padrão de comportamento ético; III - decoro da classe: valor moral e social da Instituição; IV - hierarquia: ordenação por postos e graduações; V - disciplina: rigorosa observância das leis e regulamentos; VI - transgressão disciplinar: infração administrativa por violação aos preceitos da ética militar.

DEONTOLOGIA MILITAR E DIREITOS HUMANOS
Art. 4º A Deontologia Militar reúne valores éticos destinados a elevar a carreira militar à condição de missão.
Art. 5º Cumpre ao militar obedecer ao Código de Conduta da ONU (Resolução 34/169 de 1979).
Art. 6º Respeitar e proteger a dignidade da pessoa humana.
Art. 7º Emprego da força somente quando estritamente necessário (legalidade, necessidade, proporcionalidade).
Art. 8º Proibido infligir, instigar ou tolerar tortura ou tratamento cruel/desumano.
Art. 9º Respeitar capacidade e limitações individuais, sem preconceito ou discriminação.

MANIFESTAÇÕES DA DISCIPLINA
Art. 10. Manifestações essenciais: I - correção de atitudes; II - obediência pronta; III - dedicação integral; IV - colaboração espontânea; V - consciência das responsabilidades.
Art. 11. Disciplina e respeito à hierarquia são permanentes (ativa e inatividade).
Art. 12. Ordens devem ser prontamente obedecidas. §1º Superior: responsável pelas ordens; Subordinado: solicitar esclarecimentos. §2º Responsabilidade criminal: subordinado pode requerer confirmação por escrito. §3º Subordinado que exorbitar é responsável pelos excessos.
Art. 13. Camaradagem é indispensável à família militar.

COMUNICAÇÃO DE FATO TRANSGRESSIVO
Art. 14. Comunicação mediante "Parte". §1º Comunicação verbal: formalizada por escrito em até 48 horas. §3º Autoridade competente: pode expedir memorando facultando justificativa em 48 horas.

CAPÍTULO II - DA SINDICÂNCIA
Art. 15. Sindicância: instrumento pelo qual a Administração Militar apura transgressões disciplinares, assegurados devido processo legal, ampla defesa e contraditório. Utilizada também para promoção na carreira e averiguação de danos.
Art. 17. Competência: autoridades descritas no art. 40 da Lei 2.578/2012. §3º Sindicantes: I - Oficial (superior ou mais antigo que sindicado); II - Aspirante a Oficial (praças inferiores a Subtenente).
Art. 18. Impedimentos do sindicante: ser parte, orientar parte, noticiar conduta, ser testemunha, ser defensor, ser credor/devedor, ser parente até 3º grau, não ter precedência hierárquica.
Art. 21. Sindicância instaurada por portaria em boletim: I - reservado (Oficial/Aspirante); II - ostensivo (Praça).
Art. 26-27. Citação por mandado. Contrafé entregue ao sindicado. Antecedência mínima de 48 horas para interrogatório. §5º Citação por edital: quando sindicado não localizado.
Art. 28. Interrogatório: sindicado qualificado e cientificado da acusação, informado dos direitos ao contraditório e ampla defesa. §2º Silêncio não importa confissão.
Art. 30. Defesa preliminar: 3 dias úteis após interrogatório.
Art. 31. Na defesa preliminar: arrolar até 3 testemunhas, juntar documentos, solicitar diligências.
Art. 33. Instrução: tomada de depoimentos, acareações, reconhecimentos, diligências.

OFENDIDO E TESTEMUNHAS
Art. 41. Ofendido ouvido após interrogatório, não presta compromisso.
Art. 42-43. Testemunha: presta compromisso de verdade, advertida de falso testemunho. Sem compromisso: doente mental, menor de 14, parentes/cônjuge do sindicado.
Art. 47. Defensor pode fazer perguntas diretamente às testemunhas.
Art. 51. Testemunhas do comunicante/ofendido: acusação (até 3). Defesa: até 3.

ACAREAÇÃO E RECONHECIMENTO
Art. 54. Acareação entre: sindicados, testemunhas, ofendidos e combinações.
Art. 58. Reconhecimento de pessoa: descrição prévia, colocação ao lado de semelhantes.

INSANIDADE MENTAL
Art. 61-65. Dúvida sobre sanidade: sindicância suspensa, JMCS emite laudo em até 30 dias. Insanidade temporária: sindicância retomada após restabelecimento. Insanidade permanente: defensor dativo nomeado, arquivamento por extinção da punibilidade.

ALEGAÇÕES FINAIS E RELATÓRIO
Art. 80. Alegações finais: 5 dias úteis após instrução. §5º Sindicado defende-se dos fatos, não de capitulações.
Art. 81-82. Relatório: circunstanciado, com parte expositiva, diligências, argumentos da defesa, análise dos fatos e conclusão. Imparcial, sucinto, conclusivo.

PRAZO DA SINDICÂNCIA
Art. 83. Conclusão: 30 dias (portaria até recebimento pela autoridade). Prorrogável por 20 dias.
Art. 85. Interrupção: aditamento da portaria, despacho para diligências, despacho saneador.
Art. 87. Suspensão: férias, afastamento médico, viagem de serviço, espera de diligência, força maior.

SOLUÇÃO E ENQUADRAMENTO
Art. 89. Solução: decisão motivada, publicada em boletim. Autoridade pode concordar, discordar motivadamente, arquivar.
Art. 92. Despacho saneador: devolução ao sindicante para sanar vícios de nulidade.
Art. 93. Enquadramento: documento que oficializa a punição após publicação.

RECURSOS
Art. 94. Recursos no âmbito da sindicância: I - pedido de reconsideração (5 dias úteis); II - recurso hierárquico (5 dias úteis). §8º Recurso hierárquico dirigido ao CEM (se instauradora for Corregedor ou inferior) ou autoridade superior. §9º Recurso individual.
Art. 95. Interposição tempestiva suspende cumprimento da punição.
Art. 96. Preclusão: não interpor recurso no prazo. Parágrafo único: Não interpor reconsideração elide direito ao recurso hierárquico.
Art. 98. Recurso não conhecido: fora do prazo, sem legitimidade, dirigido a autoridade incompetente. §4º Não se pode agravar a punição.

MODIFICAÇÃO E ANULAÇÃO
Art. 100-103. Modificação: relevação (suspensão após 1/3 cumprido) e atenuação (reforma para punição menos rigorosa). Anulação pelo Comandante-Geral.

CAPÍTULO III - PUNIÇÕES DISCIPLINARES
Art. 104. Punição: sanção administrativa com efeito pedagógico ao punido e aos demais membros.
Art. 105. Punições em ordem crescente: I - advertência; II - repreensão; III - detenção; IV - prisão; V - demissão.
Art. 106. Advertência: admoestação verbal, particular, não consta nos assentamentos.
Art. 107. Repreensão: admoestação escrita, publicada em boletim, consta nos assentamentos.
Art. 108. Detenção: cerceamento da liberdade, permanece na OM, comparece a atos de instrução e serviço.
Art. 109. Prisão: confinamento em local designado. Diferentes círculos separados. Presos disciplinares separados dos judiciais.
Art. 110-111. Demissão (no âmbito da sindicância): exclusão do militar não estável. Motivos: incorrigibilidade, conduta incompatível, condenação penal. Acarreta perda do grau hierárquico.

PONTUAÇÃO PARA APLICAÇÃO
Art. 112. Pontuação base: leve 5pts negativos, média 20pts negativos, grave 30pts negativos. Atenuante: +3pts. Agravante: -3pts.
Art. 112, V - Punições: a) Só leves: até 10pts = advertência; acima 10pts = até repreensão. b) Maior gravidade média: <30pts = 1-10 dias detenção; 30-39pts = 11-20 dias; >39pts = 21-30 dias. c) Ao menos uma grave: <40pts = 1-10 dias prisão; 40-48pts = 11-20 dias; >48pts = 21-30 dias. d) Grave + incompatibilidade = demissão (não estável).
Art. 113. Classificação da transgressão pode ser alterada motivadamente (antecedentes, causas, natureza, consequências).

CAUSAS DE JUSTIFICAÇÃO
Art. 116. Não há punição quando: I - ação meritória; II - obediência a ordem (não manifestamente ilegal); III - uso imperativo dos meios (perigo, urgência, calamidade, disciplina); IV - força maior/caso fortuito; V - coação irresistível; VI - consequências atingem o próprio transgressor.

EXCLUSÃO DA INFRAÇÃO
Art. 117. Infração excluída por: I - legítima defesa; II - estado de necessidade; III - estrito cumprimento do dever legal.

EXTINÇÃO DA PUNIBILIDADE
Art. 118. Extingue-se por: I - morte; II - anistia estadual; III - retroatividade de lei; IV - prescrição; V - causa de justificação; VI - insanidade mental incapacitante e irreversível.
Art. 119. Prescrição: leve 1 ano; média 2 anos; grave 5 anos. Instauração de processo interrompe prescrição.

ATENUANTES E AGRAVANTES
Art. 120. Atenuantes: I - comportamento excepcional/ótimo; II - bons serviços prestados; III - evitar mal maior ou defesa própria; IV - confissão na primeira oportunidade.
Art. 121. Agravantes: I - premeditação; II - comportamento insuficiente/mau; III - reincidência específica; IV - prática simultânea/conexão; V - conluio; VI - durante serviço, em presença de subordinado/tropa/público, com abuso de autoridade. Reincidência específica: mesma capitulação em 5 anos.

COMPORTAMENTO DAS PRAÇAS
Art. 122-124. Comportamento reflete conduta civil e profissional. Classificação: Excepcional (8 anos sem punição), Ótimo (4 anos até 1 detenção), Bom (2 anos até 2 prisões), Insuficiente (1 ano até 2 prisões), Mau (1 ano mais de 2 prisões). Praça incluída no comportamento "Bom". Equivalência: 2 repreensões = 1 detenção; 4 repreensões = 1 prisão; 2 detenções = 1 prisão; 1 transferência a bem da disciplina = 1 detenção.

CANCELAMENTO E ANULAÇÃO
Art. 125-128. Cancelamento do registro: retirar da ficha. Condições: prisão: 8 anos sem punição; repreensão/detenção: 4 anos. Anulação pelo CG em até 5 anos por ilegalidade/vício insanável, efeitos retroativos.

CAPÍTULO IV - CONSELHOS DE JUSTIFICAÇÃO E DISCIPLINA
Art. 130. Avaliam capacidade do militar de permanecer na Corporação. Oficial: Conselho de Justificação; Praça: Conselho de Disciplina.
Art. 131. Submetido nas situações do art. 57 da Lei 2.578/2012.
Art. 138-139. Competência: art. 41 da Lei 2.578/2012. Constituição: art. 59 da Lei 2.578/2012.
Art. 140. Prazo: 50 dias (sessão inaugural até relatório), prorrogável por 30 dias.
Art. 146-148. Instauração por portaria. Sessão inaugural em até 5 dias após publicação.
Art. 151. Interrogatório com 48h de antecedência. Membros podem formular perguntas.
Art. 152-153. Libelo acusatório: qualificação, exposição circunstanciada, tipificação (art. 57), agravantes.
Art. 154. Defesa preliminar: 3 dias úteis.
Art. 158. Alegações finais: 5 dias úteis.
Art. 159-160. Sessão de deliberação secreta. Relatório pelo Relator com medidas do art. 62 da Lei 2.578/2012.
Art. 161. Decisão da autoridade em 20 dias. Pode devolver para diligências (30 dias). Oficial: autos ao TJ para perda do posto.
Art. 162-163. Apelação: 15 dias úteis. Competência exclusiva do Chefe do Poder Executivo. Não suspende cumprimento (exceto punições privativas de liberdade).
Art. 164. Autoridade pode: novas provas, anular, modificar, dar tipificação diversa, manter decisão.

MEDIDAS NO ÂMBITO DOS CONSELHOS
Art. 165-171. Medidas: I - IPM; II - encaminhamento à autoridade policial; III - reforma disciplinar; IV - reserva remunerada proporcional; V - demissão a bem da disciplina; VI - punição disciplinar; VII - arquivamento. Demissão: exclusão do militar por conduta incompatível, acarreta perda do grau hierárquico.`,
  },
  {
    disciplina: "Direito Penal Militar",
    leiNome: "Código Penal Militar — Decreto-Lei nº 1.001/1969 — Parte Geral",
    fonteUrl: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm",
    assuntos: [
      "Aplicação da Lei Penal Militar (Arts. 1º a 28): princípio de legalidade, retroatividade, tempo e lugar do crime, crimes militares em tempo de paz (Art. 9º), equiparação, conceito de superior e inferior",
      "Do Crime (Arts. 29 a 47): relação de causalidade, crime consumado e tentado, desistência voluntária, crime impossível, dolo e culpa, erro de fato e de direito, coação irresistível, obediência hierárquica, exclusões de crime, estado de necessidade, legítima defesa, excesso punível",
      "Imputabilidade Penal (Arts. 48 a 52): inimputáveis, doença mental, embriaguez, menoridade",
      "Concurso de Agentes (Arts. 53 a 54): coautoria e participação, condições pessoais, cabeças, agravação e atenuação",
      "Penas Principais e Aplicação (Arts. 55 a 97): morte, reclusão, detenção, prisão, impedimento; circunstâncias agravantes e atenuantes, reincidência, concurso de crimes, suspensão condicional da pena, livramento condicional",
      "Penas Acessórias e Efeitos da Condenação (Arts. 98 a 109): perda de posto e patente, indignidade/incompatibilidade com oficialato, exclusão das forças armadas, perda de função pública",
      "Medidas de Segurança (Arts. 110 a 120): pessoais (detentivas e não detentivas), patrimoniais, internação, confisco",
      "Ação Penal e Extinção da Punibilidade (Arts. 121 a 135): ação penal pública, prescrição da pretensão punitiva e executória, reabilitação",
    ],
    leiSeca: `DECRETO-LEI Nº 1.001, DE 21 DE OUTUBRO DE 1969 — CÓDIGO PENAL MILITAR — PARTE GERAL (com alterações da Lei nº 14.688/2023)

TÍTULO I — DA APLICAÇÃO DA LEI PENAL MILITAR

Art. 1º Não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal.

Art. 2º Ninguém pode ser punido por fato que lei posterior deixa de considerar crime, cessando em virtude dela a execução e os efeitos penais da sentença condenatória.
§1º A lei posterior que, de qualquer outro modo, favorece o agente, aplica-se retroativamente, ainda quando já tenha sobrevindo sentença condenatória irrecorrível.
§2º Para se reconhecer qual a mais favorável, a lei posterior e a anterior devem ser consideradas separadamente, cada qual no conjunto de suas normas aplicáveis ao fato.

Art. 3º As medidas de segurança regem-se pela lei vigente ao tempo da sentença, prevalecendo, entretanto, se diversa, a lei vigente ao tempo da execução.

Art. 4º A lei excepcional ou temporária, embora decorrido o período de sua duração ou cessadas as circunstâncias que a determinaram, aplica-se ao fato praticado durante sua vigência.

Art. 5º Considera-se praticado o crime no momento da ação ou omissão, ainda que outro seja o do resultado.

Art. 6º Considera-se praticado o fato, no lugar em que se desenvolveu a atividade criminosa, no todo ou em parte, e ainda que sob forma de participação, bem como onde se produziu ou deveria produzir-se o resultado. Nos crimes omissivos, o fato considera-se praticado no lugar em que deveria realizar-se a ação omitida.

Art. 7º Aplica-se a lei penal militar, sem prejuízo de convenções, tratados e regras de direito internacional, ao crime cometido, no todo ou em parte no território nacional, ou fora dele, ainda que, neste caso, o agente esteja sendo processado ou tenha sido julgado pela justiça estrangeira.
§1º Para os efeitos da lei penal militar consideram-se como extensão do território nacional as aeronaves e os navios brasileiros, onde quer que se encontrem, sob comando militar ou militarmente utilizados ou ocupados por ordem legal de autoridade competente, ainda que de propriedade privada.
§2º É também aplicável a lei penal militar ao crime praticado a bordo de aeronaves ou navios estrangeiros, desde que em lugar sujeito à administração militar, e o crime atente contra as instituições militares.

Art. 8º A pena cumprida no estrangeiro atenua a pena imposta no Brasil pelo mesmo crime, quando diversas, ou nela é computada, quando idênticas.

Art. 9º Consideram-se crimes militares, em tempo de paz:
I - os crimes de que trata este Código, quando definidos de modo diverso na lei penal comum, ou nela não previstos, qualquer que seja o agente, salvo disposição especial;
II - os crimes previstos neste Código, embora também o sejam com igual definição na lei penal comum, quando praticados:
a) por militar da ativa contra militar na mesma situação;
b) por militar da ativa, em lugar sujeito à administração militar, contra militar da reserva ou reformado ou contra civil;
c) por militar em serviço ou atuando em razão da função, em comissão de natureza militar, ou em formatura, ainda que fora do lugar sujeito à administração militar contra militar da reserva, ou reformado, ou civil;
d) por militar, durante o período de manobras ou exercício, contra militar da reserva ou reformado ou contra civil;
e) por militar da ativa contra o patrimônio sob a administração militar ou contra a ordem administrativa militar;
III - os crimes praticados por militar da reserva, ou reformado, ou por civil, contra as instituições militares, considerando-se como tais não só os compreendidos no inciso I, como os do inciso II, nos seguintes casos:
a) contra o patrimônio sob a administração militar, ou contra a ordem administrativa militar;
b) em lugar sujeito à administração militar, contra militar da ativa ou contra servidor público das instituições militares ou da Justiça Militar, no exercício de função inerente ao seu cargo;
c) contra militar em formatura, ou durante o período de prontidão, vigilância, observação, exploração, exercício, acampamento, acantonamento ou manobras;
d) ainda que fora do lugar sujeito à administração militar, contra militar em função de natureza militar, ou no desempenho de serviço de vigilância, garantia e preservação da ordem pública, administrativa ou judiciária, quando legalmente requisitado para aquele fim, ou em obediência a determinação legal superior.
§1º Os crimes de que trata este artigo, quando dolosos contra a vida e cometidos por militares contra civil, serão da competência do Tribunal do Júri.
§2º Os crimes militares de que trata este artigo, incluídos os previstos na legislação penal, quando dolosos contra a vida e cometidos por militares das Forças Armadas contra civil, serão da competência da Justiça Militar da União, se praticados no contexto:
I – do cumprimento de atribuições que lhes forem estabelecidas pelo Presidente da República ou pelo Ministro de Estado da Defesa;
II – de ação que envolva a segurança de instituição militar ou de missão militar, mesmo que não beligerante; ou
III – de atividade de natureza militar, de operação de paz, de garantia da lei e da ordem ou de atribuição subsidiária.

Art. 10. Consideram-se crimes militares, em tempo de guerra:
I - os especialmente previstos neste Código para o tempo de guerra;
II - os crimes militares previstos para o tempo de paz;
III - os crimes previstos neste Código, embora também o sejam com igual definição na lei penal comum ou especial, quando praticados, qualquer que seja o agente: a) em território nacional, ou estrangeiro, militarmente ocupado; b) em qualquer lugar, se comprometem ou podem comprometer a preparação, a eficiência ou as operações militares;
IV - os crimes definidos na lei penal comum ou especial, embora não previstos neste Código, quando praticados em zona de efetivas operações militares ou em território estrangeiro, militarmente ocupado.

Art. 11. Os militares estrangeiros, quando em comissão ou em estágio em instituições militares, ficam sujeitos à lei penal militar brasileira, ressalvado o disposto em tratados ou em convenções internacionais.

Art. 12. O militar da reserva ou reformado, quando empregado na administração militar, equipara-se ao militar da ativa, para o efeito da aplicação da lei penal militar.

Art. 13. O militar da reserva, ou reformado, conserva as responsabilidades e prerrogativas do posto ou graduação, para o efeito da aplicação da lei penal militar, quando pratica ou contra ele é praticado crime militar.

Art. 14. O defeito do ato de incorporação ou de matrícula não exclui a aplicação da lei penal militar, salvo se alegado ou conhecido antes da prática do crime.

Art. 15. O tempo de guerra, para os efeitos da aplicação da lei penal militar, começa com a declaração ou o reconhecimento do estado de guerra, ou com o decreto de mobilização se nele estiver compreendido aquele reconhecimento; e termina quando ordenada a cessação das hostilidades.

Art. 16. No cômputo dos prazos inclui-se o dia do começo. Contam-se os dias, os meses e os anos pelo calendário comum.

Art. 17. As regras gerais deste Código aplicam-se aos fatos incriminados por lei penal militar especial, se esta não dispõe de modo diverso. Para os efeitos penais, salário mínimo é o maior mensal vigente no país, ao tempo da sentença.

Art. 18. Ficam sujeitos às disposições deste Código os crimes praticados em prejuízo de país em guerra contra país inimigo do Brasil: I - se o crime é praticado por brasileiro; II - se o crime é praticado no território nacional, ou em território estrangeiro, militarmente ocupado por força brasileira, qualquer que seja o agente.

Art. 19. Este Código não compreende as infrações dos regulamentos disciplinares.

Art. 20. Aos crimes praticados em tempo de guerra, salvo disposição especial, aplicam-se as penas cominadas para o tempo de paz, com o aumento de um terço.

Art. 22. É militar, para o efeito da aplicação deste Código, qualquer pessoa que, em tempo de paz ou de guerra, seja incorporada a instituições militares ou nelas matriculada, para servir em posto ou em graduação ou em regime de sujeição à disciplina militar.

Art. 23. Equipara-se ao comandante, para o efeito da aplicação da lei penal militar, toda autoridade com função de direção.

Art. 24. Considera-se superior para fins de aplicação da lei penal militar:
I – o militar que ocupa nível hierárquico, posto ou graduação superiores, conforme a antiguidade;
II – o militar que, em virtude da função, exerce autoridade sobre outro de igual posto ou graduação.
Parágrafo único. O militar sobre o qual se exerce autoridade nas condições descritas nos incisos I e II do caput deste artigo é considerado inferior hierárquico para fins de aplicação da lei penal militar.

Art. 25. Diz-se crime praticado em presença do inimigo, quando o fato ocorre em zona de efetivas operações militares, ou na iminência ou em situação de hostilidade.

Art. 26. Quando a lei penal militar se refere a "brasileiro" ou "nacional", compreende as pessoas enumeradas como brasileiros na Constituição do Brasil. Parágrafo único. Para os efeitos da lei penal militar, são considerados estrangeiros os apátridas e os brasileiros que perderam a nacionalidade.

Art. 27. Para o efeito da aplicação deste Código, consideram-se servidores da Justiça Militar os juízes, os servidores públicos e os auxiliares da Justiça Militar.

Art. 28. Os crimes contra a segurança externa do país ou contra as instituições militares, definidos neste Código, excluem os da mesma natureza definidos em outras leis.

TÍTULO II — DO CRIME

Art. 29. O resultado de que depende a existência do crime somente é imputável a quem lhe deu causa. Considera-se causa a ação ou omissão sem a qual o resultado não teria ocorrido.
§1º A superveniência de causa relativamente independente exclui a imputação quando, por si só, produziu o resultado. Os fatos anteriores, imputam-se, entretanto, a quem os praticou.
§2º A omissão é relevante como causa quando o omitente devia e podia agir para evitar o resultado. O dever de agir incumbe a quem tenha por lei obrigação de cuidado, proteção ou vigilância; a quem, de outra forma, assumiu a responsabilidade de impedir o resultado; e a quem, com seu comportamento anterior, criou o risco de sua superveniência.

Art. 30. Diz-se o crime:
I - consumado, quando nele se reúnem todos os elementos de sua definição legal;
II - tentado, quando, iniciada a execução, não se consuma por circunstâncias alheias à vontade do agente.
Parágrafo único. Pune-se a tentativa com a pena correspondente ao crime, diminuída de um a dois terços, podendo o juiz, no caso de excepcional gravidade, aplicar a pena do crime consumado.

Art. 31. O agente que, voluntariamente, desiste de prosseguir na execução ou impede que o resultado se produza, só responde pelos atos já praticados.

Art. 32. Quando, por ineficácia absoluta do meio empregado ou por absoluta impropriedade do objeto, é impossível consumar-se o crime, nenhuma pena é aplicável.

Art. 33. Diz-se o crime:
I - doloso, quando o agente quis o resultado ou assumiu o risco de produzi-lo;
II - culposo, quando o agente, deixando de empregar a cautela, atenção, ou diligência ordinária, ou especial, a que estava obrigado em face das circunstâncias, não prevê o resultado que podia prever ou, prevendo-o, supõe levianamente que não se realizaria ou que poderia evitá-lo.
Parágrafo único. Salvo os casos expressos em lei, ninguém pode ser punido por fato previsto como crime, senão quando o pratica dolosamente.

Art. 34. Pelos resultados que agravam especialmente as penas só responde o agente quando os houver causado, pelo menos, culposamente.

Art. 35. A pena pode ser atenuada ou substituída por outra menos grave quando o agente, salvo em se tratando de crime que atente contra o dever militar, supõe lícito o fato, por ignorância ou erro de interpretação da lei, se escusáveis.

Art. 36. É isento de pena quem, ao praticar o crime, supõe, por erro plenamente escusável, a inexistência de circunstância de fato que o constitui ou a existência de situação de fato que tornaria a ação legítima.
§1º Se o erro deriva de culpa, a este título responde o agente, se o fato é punível como crime culposo.
§2º Se o erro é provocado por terceiro, responderá este pelo crime, a título de dolo ou culpa, conforme o caso.

Art. 37. Quando o agente, por erro de percepção ou no uso dos meios de execução, ou outro acidente, atinge uma pessoa em vez de outra, responde como se tivesse praticado o crime contra aquela que realmente pretendia atingir.
§1º Se, por erro ou outro acidente na execução, é atingido bem jurídico diverso do visado pelo agente, responde este por culpa, se o fato é previsto como crime culposo.

Art. 38. Não é culpado quem comete o crime:
a) sob coação irresistível ou que lhe suprima a faculdade de agir segundo a própria vontade;
b) em estrita obediência a ordem direta de superior hierárquico, em matéria de serviços.
§1º Responde pelo crime o autor da coação ou da ordem.
§2º Se a ordem do superior tem por objeto a prática de ato manifestamente criminoso, ou há excesso nos atos ou na forma da execução, é punível também o inferior hierárquico.

Art. 39. Não é igualmente culpado quem, para proteger direito próprio ou de pessoa a quem está ligado por estreitas relações de parentesco ou afeição, contra perigo certo e atual, que não provocou, nem podia de outro modo evitar, sacrifica direito alheio, ainda quando superior ao direito protegido, desde que não lhe era razoavelmente exigível conduta diversa.

Art. 40. Nos crimes em que há violação do dever militar, o agente não pode invocar coação irresistível senão quando física ou material.

Art. 41. Nos casos do art. 38, letras a e b, se era possível resistir à coação, ou se a ordem não era manifestamente ilegal; ou, no caso do art. 39, se era razoavelmente exigível o sacrifício do direito ameaçado, o juiz, tendo em vista as condições pessoais do réu, pode atenuar a pena.

Art. 42. Não há crime quando o agente pratica o fato:
I - em estado de necessidade;
II - em legítima defesa;
III - em estrito cumprimento do dever legal;
IV - em exercício regular de direito.
Parágrafo único. Não há igualmente crime quando o comandante de navio, aeronave ou praça de guerra, na iminência de perigo ou grave calamidade, compele os subalternos, por meios violentos, a executar serviços e manobras urgentes, para salvar a unidade ou vidas, ou evitar o desânimo, o terror, a desordem, a rendição, a revolta ou o saque.

Art. 43. Considera-se em estado de necessidade quem pratica o fato para preservar direito seu ou alheio, de perigo certo e atual, que não provocou, nem podia de outro modo evitar, desde que o mal causado, por sua natureza e importância, é consideravelmente inferior ao mal evitado, e o agente não era legalmente obrigado a arrostar o perigo.

Art. 44. Entende-se em legítima defesa quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem.

Art. 45. O agente que, em qualquer dos casos de exclusão de crime, excede culposamente os limites da necessidade, responde pelo fato, se este é punível, a título de culpa.
Parágrafo único. Não é punível o excesso quando resulta de escusável surpresa ou perturbação de ânimo, em face da situação.

Art. 46. O juiz pode atenuar a pena ainda quando punível o fato por excesso doloso.

Art. 47. Deixam de ser elementos constitutivos do crime:
I - a qualidade de superior ou a de inferior, quando não conhecida do agente;
II - a qualidade de superior ou a de inferior, a de oficial de dia, de serviço ou de quarto, ou a de sentinela, vigia, ou plantão, quando a ação é praticada em repulsa a agressão.

TÍTULO III — DA IMPUTABILIDADE PENAL

Art. 48. Não é imputável quem, no momento da ação ou da omissão, não possui a capacidade de entender o caráter ilícito do fato ou de determinar-se de acordo com esse entendimento, em virtude de doença mental, de desenvolvimento mental incompleto ou retardado.
Parágrafo único. Se a doença ou a deficiência mental não suprime, mas diminui consideravelmente a capacidade de entendimento da ilicitude do fato ou a de autodeterminação, não fica excluída a imputabilidade, mas a pena pode ser reduzida de 1/3 a 2/3, sem prejuízo do disposto no art. 113 deste Código.

Art. 49. Não é igualmente imputável o agente que, por embriaguez completa proveniente de caso fortuito ou força maior, era, ao tempo da ação ou da omissão, inteiramente incapaz de entender o caráter criminoso do fato ou de determinar-se de acordo com esse entendimento.
Parágrafo único. A pena pode ser reduzida de um a dois terços, se o agente por embriaguez proveniente de caso fortuito ou força maior, não possuía, ao tempo da ação ou da omissão, a plena capacidade de entender o caráter criminoso do fato ou de determinar-se de acordo com esse entendimento.

Art. 50. O menor de 18 (dezoito) anos é penalmente inimputável, ficando sujeito às normas estabelecidas na legislação especial.

TÍTULO IV — DO CONCURSO DE AGENTES

Art. 53. Quem, de qualquer modo, concorre para o crime incide nas penas a este cominadas.
§1º A punibilidade de qualquer dos concorrentes é independente da dos outros, determinando-se segundo a sua própria culpabilidade. Não se comunicam, outrossim, as condições ou circunstâncias de caráter pessoal, salvo quando elementares do crime.
§2º A pena é agravada em relação ao agente que: I - promove ou organiza a cooperação no crime ou dirige a atividade dos demais agentes; II - coage outrem à execução material do crime; III - instiga ou determina a cometer o crime alguém sujeito à sua autoridade, ou não punível em virtude de condição ou qualidade pessoal; IV - executa o crime, ou nele participa, mediante paga ou promessa de recompensa.
§3º A pena é atenuada com relação ao agente, cuja participação no crime é de somenos importância.
§4º Na prática de crime de autoria coletiva necessária, reputam-se cabeças os que dirigem, provocam, instigam ou excitam a ação.
§5º Quando o crime é cometido por inferiores hierárquicos e um ou mais oficiais, são estes considerados cabeças, assim como os inferiores hierárquicos que exercem função de oficial.

Art. 54. O ajuste, a determinação ou instigação e o auxílio, salvo disposição em contrário, não são puníveis se o crime não chega, pelo menos, a ser tentado.

TÍTULO V — DAS PENAS

CAPÍTULO I — DAS PENAS PRINCIPAIS

Art. 55. As penas principais são: a) morte; b) reclusão; c) detenção; d) prisão; e) impedimento.

Art. 56. A pena de morte é executada por fuzilamento.

Art. 57. A sentença definitiva de condenação à morte é comunicada, logo que passe em julgado, ao Presidente da República, e não pode ser executada senão depois de sete dias após a comunicação.
Parágrafo único. Se a pena é imposta em zona de operações de guerra, pode ser imediatamente executada, quando o exigir o interesse da ordem e da disciplina militares.

Art. 58. O mínimo da pena de reclusão é de um ano, e o máximo de trinta anos; o mínimo da pena de detenção é de trinta dias, e o máximo de dez anos.

Art. 59. A pena de reclusão ou de detenção até 2 (dois) anos, aplicada a militar, é convertida em pena de prisão e cumprida, quando não cabível a suspensão condicional:
I - pelo oficial, em recinto de estabelecimento militar;
II - pela praça, em estabelecimento penal militar.

Art. 61. A pena privativa da liberdade por mais de 2 (dois) anos, aplicada a militar, é cumprida em penitenciária militar e, na falta dessa, em estabelecimento prisional civil.

Art. 62. O civil cumpre a pena aplicada pela Justiça Militar, em estabelecimento prisional civil.

Art. 63. A pena de impedimento sujeita o condenado a permanecer no recinto da unidade, sem prejuízo da instrução militar.

Art. 67. Computam-se na pena privativa de liberdade o tempo de prisão provisória, no Brasil ou no estrangeiro, e o de internação em hospital ou manicômio.

CAPÍTULO II — DA APLICAÇÃO DA PENA

Art. 69. Para fixação da pena privativa de liberdade, o juiz aprecia a gravidade do crime praticado e a personalidade do réu, devendo ter em conta a intensidade do dolo ou grau da culpa, a maior ou menor extensão do dano ou perigo de dano, os meios empregados, o modo de execução, os motivos determinantes, as circunstâncias de tempo e lugar, os antecedentes do réu e sua atitude de insensibilidade, indiferença ou arrependimento após o crime.

Art. 70. São circunstâncias que sempre agravam a pena, quando não integrantes ou qualificativas do crime: a) a reincidência; b) ter o agente cometido o crime: por motivo fútil ou torpe; para facilitar ou assegurar a execução, a ocultação, a impunidade ou vantagem de outro crime; à traição, de emboscada, com surpresa; com emprego de veneno, asfixia, tortura, fogo, explosivo, ou outro meio cruel; contra ascendente, descendente, irmão ou cônjuge; com abuso de poder ou violação de dever inerente a cargo; contra criança, pessoa maior de 60 anos, pessoa enferma, mulher grávida ou pessoa com deficiência; quando o ofendido estava sob imediata proteção da autoridade; em ocasião de calamidade pública; estando de serviço; com emprego de arma ou material de serviço; em auditório da Justiça Militar; em país estrangeiro.

Art. 71. Verifica-se a reincidência quando o agente comete novo crime, depois de transitar em julgado a sentença que o tenha condenado por crime anterior.
§1º Não se toma em conta, para efeito da reincidência, a condenação anterior, se, entre a data do cumprimento ou extinção da pena e o crime posterior, decorreu período de tempo superior a cinco anos.

Art. 72. São circunstâncias que sempre atenuam a pena: a) ser o agente menor de vinte e um ou maior de setenta anos; b) ser meritório seu comportamento anterior.

Art. 73. Quando a lei determina a agravação ou atenuação da pena sem mencionar o quantum, deve o juiz fixá-lo entre um quinto e um terço, guardados os limites da pena cominada ao crime.

Art. 77. A pena-base será fixada de acordo com o critério definido no art. 69 deste Código e, em seguida, serão consideradas as circunstâncias atenuantes e agravantes e, por último, as causas de diminuição e de aumento de pena.

Art. 79. Quando o agente, mediante mais de uma ação ou omissão, pratica dois ou mais crimes, idênticos ou não, aplicam-se-lhe cumulativamente as penas privativas de liberdade em que haja incorrido (concurso material).

Art. 79-A. Quando o agente, mediante uma só ação ou omissão, pratica dois ou mais crimes, idênticos ou não, aplica-se-lhe a mais grave das penas cabíveis ou, se iguais, somente uma delas, mas aumentada, em qualquer caso, de 1/6 até metade (concurso formal).

Art. 80. Quando o agente, mediante mais de uma ação ou omissão, pratica dois ou mais crimes da mesma espécie e, pelas condições de tempo, lugar, maneira de execução e outras semelhantes, devem os subsequentes ser havidos como continuação do primeiro, aplica-se-lhe a pena de um só dos crimes, se idênticas, ou a mais grave, se diversas, aumentada de 1/6 a 2/3 (crime continuado).

Art. 81. A pena unificada não pode ultrapassar de trinta anos, se é de reclusão, ou de quinze anos, se é de detenção.

CAPÍTULO III — DA SUSPENSÃO CONDICIONAL DA PENA

Art. 84. A execução da pena privativa de liberdade não superior a 2 (dois) anos pode ser suspensa por 3 (três) a 5 (cinco) anos, no caso de pena de reclusão, e por 2 (dois) a 4 (quatro) anos, no caso de pena de detenção, desde que:
I – o sentenciado não haja sofrido condenação irrecorrível por outro crime a pena privativa da liberdade;
II – a culpabilidade, os antecedentes, a conduta social e a personalidade do agente, bem como os motivos e as circunstâncias do crime, autorizem a concessão do benefício.
§2º A execução da pena privativa de liberdade não superior a 4 (quatro) anos poderá ser suspensa por 4 (quatro) a 6 (seis) anos, desde que o condenado seja maior de 70 (setenta) anos de idade ou existam razões de saúde que justifiquem a suspensão.

Art. 86. A suspensão é revogada se, no curso do prazo, o beneficiário: I – é condenado por crime doloso, na Justiça Militar ou na Justiça Comum, por sentença irrecorrível; II - não efetua, sem motivo justificado, a reparação do dano.

Art. 87. Se o prazo expira sem que tenha sido revogada a suspensão, fica extinta a pena privativa de liberdade.

Art. 88. A suspensão condicional da pena não se aplica: I - ao condenado por crime cometido em tempo de guerra; II - em tempo de paz (casos específicos).

CAPÍTULO IV — DO LIVRAMENTO CONDICIONAL

Art. 89. O condenado a pena de reclusão ou de detenção por tempo igual ou superior a dois anos pode ser liberado condicionalmente, desde que:
I - tenha cumprido: a) metade da pena, se primário; b) dois terços, se reincidente;
II - tenha reparado, salvo impossibilidade de fazê-lo, o dano causado pelo crime;
III - sua boa conduta durante a execução da pena, sua adaptação ao trabalho e às circunstâncias atinentes a sua personalidade permitem supor que não voltará a delinquir.
§2º Se o condenado é primário e menor de vinte e um ou maior de setenta anos, o tempo de cumprimento da pena pode ser reduzido a um terço.

Art. 93. Revoga-se o livramento, se o liberado vem a ser condenado, em sentença irrecorrível, a pena privativa de liberdade: I - por infração penal cometida durante a vigência do benefício; II - por infração penal anterior.

Art. 95. Se, até o seu termo, o livramento não é revogado, considera-se extinta a pena privativa de liberdade.

Art. 96. O livramento condicional não se aplica ao condenado por crime cometido em tempo de guerra.

Art. 97. Em tempo de paz, o livramento condicional por crime contra a segurança externa do país, ou de revolta, motim, aliciação e incitamento, violência contra superior ou militar de serviço, só será concedido após o cumprimento de dois terços da pena.

CAPÍTULO V — DAS PENAS ACESSÓRIAS

Art. 98. São penas acessórias: I - a perda de posto e patente; II - a indignidade para o oficialato; III - a incompatibilidade com o oficialato; IV - a exclusão das forças armadas; V - a perda da função pública, ainda que eletiva; VI - a inabilitação para o exercício de função pública; VII - a incapacidade para o exercício do poder familiar, da tutela ou da curatela; VIII - a suspensão dos direitos políticos.

Art. 99. A perda de posto e patente resulta da condenação a pena privativa de liberdade por tempo superior a 2 (dois) anos, por crimes comuns e militares, e importa a perda das condecorações, desde que submetido o oficial ao julgamento previsto no inciso VI do §3º do art. 142 da Constituição Federal.

Art. 100. Fica sujeito à declaração de indignidade para o oficialato o militar condenado, qualquer que seja a pena, nos crimes de traição, espionagem ou cobardia, ou em qualquer dos definidos nos arts. 161, 235, 240, 242, 243, 244, 245, 251, 252, 303, 304, 311 e 312.

Art. 101. Fica sujeito à declaração de incompatibilidade com o oficialato o militar condenado nos crimes dos arts. 141 e 142.

Art. 102. A condenação da praça a pena privativa de liberdade, por tempo superior a dois anos, importa sua exclusão das forças armadas.

Art. 103. Incorre na perda da função pública o civil: I - condenado a pena privativa de liberdade por crime cometido com abuso de poder ou violação de dever inerente à função pública; II - condenado, por outro crime, a pena privativa de liberdade por mais de dois anos.

Art. 104. Incorre na inabilitação para o exercício de função pública, pelo prazo de dois até vinte anos, o condenado a reclusão por mais de quatro anos, em virtude de crime praticado com abuso de poder ou violação do dever militar ou inerente à função pública.

Art. 106. Durante a execução da pena privativa de liberdade ou da medida de segurança imposta em substituição, ou enquanto perdura a inabilitação para função pública, o condenado não pode votar, nem ser votado.

CAPÍTULO VI — DOS EFEITOS DA CONDENAÇÃO

Art. 109. São efeitos da condenação: I - tornar certa a obrigação de reparar o dano resultante do crime; II - a perda em favor da Fazenda Pública, ressalvado o direito do lesado ou de terceiro de boa-fé: a) dos instrumentos do crime, desde que consistam em coisas cujo fabrico, alienação, uso, porte ou detenção constitua fato ilícito; b) do produto do crime ou de qualquer bem ou valor que constitua proveito auferido pelo agente com a sua prática.

TÍTULO VI — DAS MEDIDAS DE SEGURANÇA

Art. 110. As medidas de segurança são pessoais ou patrimoniais.
§1º As medidas de segurança pessoais subdividem-se em: I – detentivas: compreendem a internação em estabelecimento de custódia e tratamento ou em seção especial de estabelecimento penal; II – não detentivas: compreendem o tratamento ambulatorial, a interdição de licença para direção de veículos motorizados, o exílio local e a proibição de frequentar determinados lugares.
§2º As medidas de segurança patrimoniais compreendem a interdição de estabelecimento ou sede de sociedade ou associação e o confisco.

Art. 111. As medidas de segurança somente podem ser impostas: I - aos civis; II – aos militares condenados a pena privativa de liberdade por tempo superior a 2 anos, aos que hajam perdido função, posto ou patente ou aos que tenham sido excluídos das Forças Armadas; III – aos militares, no caso do art. 48; IV – aos militares, no caso do art. 115, com aplicação dos seus §§1º, 2º e 3º.

Art. 112. Quando o agente é inimputável, nos termos do art. 48 deste Código, o juiz poderá determinar sua internação em estabelecimento de custódia e tratamento.
§1º A internação ou o tratamento ambulatorial será por tempo indeterminado, perdurando enquanto não for averiguada, mediante perícia médica, a cessação da periculosidade, observado que o prazo mínimo deverá ser de 1 a 3 anos.

Art. 113. Na hipótese do parágrafo único do art. 48, e se o condenado necessitar de especial tratamento curativo, a pena privativa de liberdade poderá ser substituída por internação ou por tratamento ambulatorial, pelo prazo mínimo de 1 a 3 anos.

Art. 119. O juiz, embora não apurada a autoria, deve ordenar o confisco dos instrumentos e produtos do crime, desde que consistam em coisas: I - cujo fabrico, alienação, uso, porte ou detenção constitui fato ilícito; II - que, pertencendo às forças armadas ou sendo de uso exclusivo de militares, estejam em poder ou em uso do agente; III - abandonadas, ocultas ou desaparecidas.

TÍTULO VII — DA AÇÃO PENAL

Art. 121. A ação penal é promovida pelo Ministério Público, na forma da lei.
Parágrafo único. Será admitida ação privada, se a ação pública não for intentada no prazo legal.

TÍTULO VIII — DA EXTINÇÃO DA PUNIBILIDADE

Art. 123. Extingue-se a punibilidade: I - pela morte do agente; II - pela anistia, graça ou indulto; III - pela retroatividade de lei que não mais considera o fato como criminoso; IV - pela prescrição; V - pelo ressarcimento do dano, no peculato culposo (art. 303, §4º); VI - pelo perdão judicial, nos casos previstos em lei.

Art. 124. A prescrição refere-se à pretensão punitiva ou à executória.

Art. 125. A prescrição da pretensão punitiva regula-se pelo máximo da pena privativa de liberdade cominada ao crime, verificando-se:
I - em trinta anos, se a pena é de morte;
II - em vinte anos, se o máximo da pena é superior a doze;
III - em dezesseis anos, se o máximo da pena é superior a oito e não excede a doze;
IV - em doze anos, se o máximo da pena é superior a quatro e não excede a oito;
V - em oito anos, se o máximo da pena é superior a dois e não excede a quatro;
VI - em quatro anos, se o máximo da pena é igual a um ano ou, sendo superior, não excede a dois;
VII – em 3 (três) anos, se o máximo da pena é inferior a 1 (um) ano.
§1º Sobrevindo sentença condenatória, de que somente o réu tenha recorrido, a prescrição passa a regular-se pela pena imposta.
§2º A prescrição da ação penal começa a correr: a) do dia em que o crime se consumou; b) no caso de tentativa, do dia em que cessou a atividade criminosa; c) nos crimes permanentes, do dia em que cessou a permanência; d) nos crimes de falsidade, da data em que o fato se tornou conhecido.
§5º O curso da prescrição da ação penal interrompe-se: I - pela instauração do processo; II – pela sentença condenatória ou acórdão condenatório recorríveis; III – pelo início ou continuação da execução provisória ou definitiva da pena; IV – pela reincidência.

Art. 129. São reduzidos de metade os prazos da prescrição, quando o criminoso era, ao tempo do crime, menor de vinte e um anos ou maior de setenta.

Art. 130. É imprescritível a execução das penas acessórias.

Art. 131. A prescrição começa a correr, no crime de insubmissão, do dia em que o insubmisso atinge a idade de trinta anos.

Art. 132. No crime de deserção, embora decorrido o prazo da prescrição, esta só extingue a punibilidade quando o desertor atinge a idade de quarenta e cinco anos, e, se oficial, a de sessenta.

Art. 133. A prescrição, embora não alegada, deve ser declarada de ofício.

Art. 134. A reabilitação alcança quaisquer penas impostas por sentença definitiva.
§1º A reabilitação poderá ser requerida decorridos cinco anos do dia em que for extinta, de qualquer modo, a pena principal ou terminar a execução desta ou da medida de segurança.

Art. 135. Declarada a reabilitação, serão cancelados, mediante averbação, os antecedentes criminais.`,
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
