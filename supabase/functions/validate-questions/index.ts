import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// ── LEGISLATION DATABASE (same as generate-questions-batch) ──
// Each entry maps a disciplina name to its full legal text for AI context

const LEGISLATION: Record<string, { leiNome: string; leiSeca: string }> = {
  "Lei nº 2.578/2012": {
    leiNome: "Estatuto dos Policiais Militares e Bombeiros Militares do Estado do Tocantins",
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

  "LC nº 128/2021": {
    leiNome: "Organização Básica da Polícia Militar do Estado do Tocantins",
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

  "Lei nº 2.575/2012": {
    leiNome: "Promoções dos Militares Estaduais do Tocantins",
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

  "CPPM": {
    leiNome: "Código de Processo Penal Militar — Arts. 8º a 28º e 243º a 253º",
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
Art. 22. O inquérito será encerrado com minucioso relatório, em que o seu encarregado mencionará as diligências feitas, as pessoas ouvidas e os resultados obtidos, com indicação do dia, hora e lugar onde ocorreu o fato delituoso. Em conclusão, dirá se há infração disciplinar a punir ou indício de crime, pronunciando-se, neste último caso, justificadamente, sobre a conveniência da prisão preventiva do indiciado. §1º No caso de ter sido delegada a atribuição para a abertura do inquérito, o seu encarregado enviá-lo-á à autoridade de que recebeu a delegação, para que lhe homologue ou não a solução, aplique penalidade, no caso de ter sido apurada infração disciplinar, ou determine novas diligências, se as julgar necessárias. §2º Discordando da solução dada ao inquérito, a autoridade que o delegou poderá avocá-lo e dar solução diferente.
Art. 23. Os autos do inquérito serão remetidos ao auditor da Circunscrição Judiciária Militar onde ocorreu a infração penal, acompanhados dos instrumentos desta, bem como dos objetos que interessem à sua prova. §1º Na Circunscrição onde houver Auditorias Especializadas, atender-se-á, para a remessa, à especialização de cada uma. Onde houver mais de uma na mesma sede, a remessa será feita à primeira Auditoria, para a respectiva distribuição. §2º Os autos de inquérito instaurado fora do território nacional serão remetidos à 1ª Auditoria da Circunscrição com sede na Capital da União.
Art. 24. A autoridade militar não poderá mandar arquivar autos de inquérito, embora conclusivo da inexistência de crime ou de inimputabilidade do indiciado.
Art. 25. O arquivamento de inquérito não obsta a instauração de outro, se novas provas aparecerem em relação ao fato, ao indiciado ou a terceira pessoa, ressalvados o caso julgado e os casos de extinção da punibilidade. §1º Verificando a hipótese contida neste artigo, o juiz remeterá os autos ao Ministério Público, para os fins do disposto no art. 10, letra c. §2º O Ministério Público poderá requerer o arquivamento dos autos, se entender inadequada a instauração do inquérito.
Art. 26. Os autos de inquérito não poderão ser devolvidos a autoridade policial militar, a não ser: I — mediante requisição do Ministério Público, para diligências por ele consideradas imprescindíveis ao oferecimento da denúncia; II — por determinação do juiz, antes da denúncia, para o preenchimento de formalidades previstas neste Código, ou para complemento de prova que julgue necessária. Parágrafo único. Em qualquer dos casos, o juiz marcará prazo, não excedente de vinte dias, para a restituição dos autos.
Art. 27. Se, por si só, for suficiente para a elucidação do fato e sua autoria, o auto de flagrante delito constituirá o inquérito, dispensando outras diligências, salvo o exame de corpo de delito no crime que deixe vestígios, a identificação da coisa e a sua avaliação, quando o seu valor influir na aplicação da pena. A remessa dos autos, com breve relatório da autoridade policial militar, far-se-á sem demora ao juiz competente, nos termos do art. 20.
Art. 28. O inquérito poderá ser dispensado, sem prejuízo de diligência requisitada pelo Ministério Público: a) quando o fato e sua autoria já estiverem esclarecidos por documentos ou outras provas materiais; b) nos crimes contra a honra, quando decorrerem de escrito ou publicação, cujo autor esteja identificado; c) nos crimes previstos nos arts. 341 e 349 do Código Penal Militar.

SEÇÃO II - DA PRISÃO EM FLAGRANTE (Arts. 243 a 253)
Art. 243. Qualquer pessoa poderá e os militares deverão prender quem for insubmisso ou desertor, ou seja encontrado em flagrante delito.
Art. 244. Considera-se em flagrante delito aquele que: a) está cometendo o crime; b) acaba de cometê-lo; c) é perseguido logo após o fato delituoso em situação que faça acreditar ser ele o seu autor; d) é encontrado, logo depois, com instrumentos, objetos, material ou papéis que façam presumir a sua participação no fato delituoso. Parágrafo único. Nas infrações permanentes, considera-se o agente em flagrante delito enquanto não cessar a permanência.
Art. 245. Apresentado o preso ao comandante ou ao oficial de dia, de serviço ou de quarto, ou autoridade correspondente, ou à autoridade judiciária, será, por qualquer deles, ouvido o condutor e as testemunhas que o acompanharem, bem como inquirido o indiciado sobre a imputação que lhe é feita, e especialmente sobre o lugar e hora em que o fato aconteceu, lavrando-se de tudo auto, que será por todos assinado. §1º Em se tratando de menor inimputável, será apresentado, imediatamente, ao juiz de menores. §2º A falta de testemunhas não impedirá o auto de prisão em flagrante, que será assinado por duas pessoas, pelo menos, que hajam testemunhado a apresentação do preso. §3º Quando a pessoa conduzida se recusar a assinar, não souber ou não puder fazê-lo, o auto será assinado por duas testemunhas, que lhe tenham ouvido a leitura na presença do indiciado, do condutor e das testemunhas do fato delituoso. §4º Sendo o auto presidido por autoridade militar, designará esta, para exercer as funções de escrivão, um capitão, capitão-tenente, primeiro ou segundo-tenente, se o indiciado for oficial. Nos demais casos, poderá designar um subtenente, suboficial ou sargento. §5º Na falta ou impedimento de escrivão ou das pessoas referidas no parágrafo anterior, a autoridade designará, para lavrar o auto, qualquer pessoa idônea, que, para esse fim, prestará o compromisso legal.
Art. 246. Se das respostas resultarem fundadas suspeitas contra a pessoa conduzida, a autoridade mandará recolhê-la à prisão, procedendo-se, imediatamente, se for o caso, a exame de corpo de delito, à busca e apreensão dos instrumentos do crime e a qualquer outra diligência necessária ao seu esclarecimento.
Art. 247. Dentro em vinte e quatro horas após a prisão, será dada ao preso nota de culpa assinada pela autoridade, com o motivo da prisão, o nome do condutor e os das testemunhas. §1º Da nota de culpa o preso passará recibo que será assinado por duas testemunhas, quando ele não souber, não puder ou não quiser assinar. §2º Se, ao contrário da hipótese prevista no art. 246, a autoridade militar ou judiciária verificar a manifesta inexistência de infração penal militar ou a não participação da pessoa conduzida, relaxará a prisão. Em se tratando de infração penal comum, remeterá o preso à autoridade civil competente.
Art. 248. Em qualquer hipótese, de tudo quanto ocorrer será lavrado auto ou termo, para remessa à autoridade judiciária competente, a fim de que esta confirme ou infirme os atos praticados.
Art. 249. Quando o fato for praticado em presença da autoridade, ou contra ela, no exercício de suas funções, deverá ela própria prender e autuar em flagrante o infrator, mencionando a circunstância.
Art. 250. Quando a prisão em flagrante for efetuada em lugar não sujeito à administração militar, o auto poderá ser lavrado por autoridade civil, ou pela autoridade militar do lugar mais próximo daquele em que ocorrer a prisão.
Art. 251. O auto de prisão em flagrante deve ser remetido imediatamente ao juiz competente, se não tiver sido lavrado por autoridade judiciária; e, no máximo, dentro em cinco dias, se depender de diligência prevista no art. 246. Parágrafo único. Lavrado o auto de flagrante delito, o preso passará imediatamente à disposição da autoridade judiciária competente para conhecer do processo.
Art. 252. O auto poderá ser mandado ou devolvido à autoridade militar, pelo juiz ou a requerimento do Ministério Público, se novas diligências forem julgadas necessárias ao esclarecimento do fato.
Art. 253. Quando o juiz verificar pelo auto de prisão em flagrante que o agente praticou o fato nas condições dos arts. 35, 38, observado o disposto no art. 40, e dos arts. 39 e 42, do Código Penal Militar, poderá conceder ao indiciado liberdade provisória, mediante termo de comparecimento a todos os atos do processo, sob pena de revogar a concessão.`,
  },

  "RDMETO": {
    leiNome: "Regulamento Disciplinar dos Militares Estaduais do Tocantins — Decreto nº 4.994/2014",
    leiSeca: `DECRETO Nº 4.994, DE 14 DE FEVEREIRO DE 2014 - RDMETO.

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
Art. 15. Sindicância: instrumento pelo qual a Administração Militar apura transgressões disciplinares, assegurados devido processo legal, ampla defesa e contraditório.
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

  "Direito Penal Militar": {
    leiNome: "Código Penal Militar — Decreto-Lei nº 1.001/1969 — Parte Geral",
    leiSeca: `DECRETO-LEI Nº 1.001, DE 21 DE OUTUBRO DE 1969 — CÓDIGO PENAL MILITAR — PARTE GERAL (com alterações da Lei nº 14.688/2023)

TÍTULO I — DA APLICAÇÃO DA LEI PENAL MILITAR

Art. 1º Não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal.
Art. 2º Ninguém pode ser punido por fato que lei posterior deixa de considerar crime, cessando em virtude dela a execução e os efeitos penais da sentença condenatória. §1º A lei posterior que, de qualquer outro modo, favorece o agente, aplica-se retroativamente, ainda quando já tenha sobrevindo sentença condenatória irrecorrível. §2º Para se reconhecer qual a mais favorável, a lei posterior e a anterior devem ser consideradas separadamente.
Art. 3º As medidas de segurança regem-se pela lei vigente ao tempo da sentença, prevalecendo, entretanto, se diversa, a lei vigente ao tempo da execução.
Art. 4º A lei excepcional ou temporária aplica-se ao fato praticado durante sua vigência.
Art. 5º Considera-se praticado o crime no momento da ação ou omissão, ainda que outro seja o do resultado.
Art. 6º Considera-se praticado o fato, no lugar em que se desenvolveu a atividade criminosa, no todo ou em parte, bem como onde se produziu ou deveria produzir-se o resultado.
Art. 7º Aplica-se a lei penal militar ao crime cometido, no todo ou em parte no território nacional, ou fora dele. §1º Consideram-se como extensão do território nacional as aeronaves e os navios brasileiros, sob comando militar. §2º Também aplicável ao crime a bordo de aeronaves ou navios estrangeiros, em lugar sujeito à administração militar.
Art. 8º A pena cumprida no estrangeiro atenua a pena imposta no Brasil pelo mesmo crime, quando diversas, ou nela é computada, quando idênticas.

Art. 9º Consideram-se crimes militares, em tempo de paz:
I - os crimes deste Código, quando definidos de modo diverso na lei penal comum, ou nela não previstos;
II - os crimes previstos neste Código, quando praticados: a) por militar da ativa contra militar na mesma situação; b) por militar da ativa, em lugar sujeito à administração militar, contra militar da reserva/reformado ou civil; c) por militar em serviço ou atuando em razão da função; d) por militar durante manobras ou exercício; e) por militar da ativa contra patrimônio sob administração militar ou contra a ordem administrativa militar;
III - os praticados por militar da reserva, reformado, ou civil, contra as instituições militares: a) contra patrimônio sob administração militar; b) em lugar sujeito à administração militar, contra militar da ativa ou servidor público das instituições militares/Justiça Militar; c) contra militar em formatura, prontidão, vigilância, exercício, manobras; d) contra militar em função de natureza militar ou no desempenho de serviço de vigilância/ordem pública.
§1º Crimes dolosos contra a vida cometidos por militares contra civil: competência do Tribunal do Júri.
§2º Crimes dolosos contra a vida cometidos por militares das Forças Armadas contra civil: competência da Justiça Militar da União, se praticados no contexto de atribuições do Presidente/Ministro da Defesa, segurança de instituição militar, ou atividade de natureza militar/operação de paz/GLO.

Art. 10. Crimes militares em tempo de guerra: I - os especialmente previstos para o tempo de guerra; II - os previstos para o tempo de paz; III - os previstos neste Código quando praticados em território militarmente ocupado ou que comprometam operações militares; IV - os da lei penal comum em zona de efetivas operações militares.
Art. 11. Militares estrangeiros em comissão/estágio ficam sujeitos à lei penal militar brasileira.
Art. 12. Militar da reserva/reformado empregado na administração militar equipara-se ao da ativa.
Art. 13. Militar da reserva/reformado conserva responsabilidades e prerrogativas do posto/graduação.
Art. 14. O defeito do ato de incorporação ou matrícula não exclui a aplicação da lei penal militar, salvo se alegado antes da prática do crime.
Art. 15. Tempo de guerra: começa com declaração/reconhecimento do estado de guerra ou decreto de mobilização; termina com cessação das hostilidades.
Art. 16. No cômputo dos prazos inclui-se o dia do começo.
Art. 17. Regras gerais aplicam-se a fatos incriminados por lei penal militar especial, se esta não dispõe de modo diverso.
Art. 19. Este Código não compreende as infrações dos regulamentos disciplinares.
Art. 20. Crimes em tempo de guerra: penas do tempo de paz com aumento de um terço.
Art. 22. É militar qualquer pessoa incorporada ou matriculada em instituições militares.
Art. 23. Equipara-se ao comandante toda autoridade com função de direção.
Art. 24. Superior: I – militar de nível hierárquico, posto ou graduação superiores; II – militar que, em virtude da função, exerce autoridade sobre outro de igual posto/graduação. Parágrafo único: inferior hierárquico é aquele sobre o qual se exerce autoridade.
Art. 25. Crime em presença do inimigo: fato em zona de efetivas operações militares.
Art. 27. Servidores da Justiça Militar: juízes, servidores públicos e auxiliares.
Art. 28. Crimes contra segurança externa/instituições militares deste Código excluem os de mesma natureza de outras leis.

TÍTULO II — DO CRIME
Art. 29. Resultado imputável a quem lhe deu causa. §1º Superveniência de causa independente exclui imputação quando, por si só, produziu o resultado. §2º Omissão relevante quando o omitente devia e podia agir.
Art. 30. Crime: I - consumado (todos elementos); II - tentado (iniciada execução, não consuma por circunstâncias alheias). Parágrafo único: tentativa punida com pena diminuída de 1 a 2/3.
Art. 31. Desistência voluntária: só responde pelos atos já praticados.
Art. 32. Crime impossível: nenhuma pena aplicável.
Art. 33. Crime: I - doloso (quis resultado ou assumiu risco); II - culposo (sem cautela, não prevê resultado previsível). Parágrafo único: só punição por dolo, salvo casos expressos.
Art. 34. Resultados agravantes: só responde se causados ao menos culposamente.
Art. 35. Erro de direito: pena atenuada se erro escusável, salvo crime contra dever militar.
Art. 36. Erro de fato: isento de pena se erro plenamente escusável. §1º Erro culposo: responde a título de culpa. §2º Erro provocado por terceiro: responde o provocador.
Art. 37. Erro sobre a pessoa: responde como se tivesse praticado contra a pessoa pretendida.
Art. 38. Não é culpado: a) sob coação irresistível; b) em estrita obediência a ordem de superior hierárquico. §1º Responde o autor da coação/ordem. §2º Se ordem manifestamente criminosa ou há excesso, punível também o inferior.
Art. 39. Estado de necessidade como excludente de culpabilidade: proteger direito próprio/de pessoa ligada por parentesco/afeição, contra perigo certo e atual.
Art. 40. Nos crimes com violação do dever militar, coação irresistível só quando física ou material.
Art. 41. Atenuação quando possível resistir à coação ou quando ordem não era manifestamente ilegal.
Art. 42. Não há crime: I - estado de necessidade; II - legítima defesa; III - estrito cumprimento do dever legal; IV - exercício regular de direito. Parágrafo único: comandante que compele subalternos em perigo/calamidade para salvar unidade/vidas.
Art. 43. Estado de necessidade: perigo certo e atual, mal causado consideravelmente inferior ao evitado.
Art. 44. Legítima defesa: repelir injusta agressão, atual ou iminente, usando moderadamente meios necessários.
Art. 45. Excesso culposo: punível se previsto como crime culposo. Parágrafo único: excesso escusável por surpresa/perturbação não punível.
Art. 46. Excesso doloso: juiz pode atenuar a pena.
Art. 47. Não constitutivos do crime: I - qualidade de superior/inferior não conhecida; II - qualidade de superior/inferior quando ação em repulsa a agressão.

TÍTULO III — IMPUTABILIDADE
Art. 48. Inimputável: doença mental, desenvolvimento mental incompleto/retardado. Parágrafo único: capacidade diminuída: pena reduzida de 1/3 a 2/3.
Art. 49. Embriaguez completa por caso fortuito/força maior: inimputável. Parágrafo único: pena reduzida de 1 a 2/3 se capacidade diminuída.
Art. 50. Menor de 18 anos: inimputável, sujeito a legislação especial.

TÍTULO IV — CONCURSO DE AGENTES
Art. 53. Quem concorre para o crime incide nas penas. §1º Punibilidade independente; condições pessoais não se comunicam, salvo elementares. §2º Agravação: I - organiza cooperação; II - coage; III - instiga sujeito à autoridade; IV - participa mediante paga. §3º Atenuação: participação de somenos importância. §4º Cabeças: dirigem, provocam, instigam. §5º Oficiais considerados cabeças quando crime cometido com inferiores.
Art. 54. Ajuste/instigação/auxílio não puníveis se crime não tentado.

TÍTULO V — DAS PENAS
Art. 55. Penas principais: a) morte; b) reclusão; c) detenção; d) prisão; e) impedimento.
Art. 56. Pena de morte executada por fuzilamento.
Art. 57. Sentença de morte comunicada ao Presidente da República, executada após 7 dias.
Art. 58. Reclusão: 1 a 30 anos. Detenção: 30 dias a 10 anos.
Art. 59. Pena até 2 anos convertida em prisão: oficial em estabelecimento militar; praça em estabelecimento penal militar.
Art. 61. Pena superior a 2 anos: penitenciária militar.
Art. 62. Civil: estabelecimento prisional civil.
Art. 63. Impedimento: permanecer no recinto da unidade.
Art. 69. Fixação da pena: gravidade, personalidade, dolo/culpa, extensão do dano, meios, modo de execução, motivos, circunstâncias, antecedentes.
Art. 70. Agravantes: reincidência, motivo fútil/torpe, traição, meio cruel, contra ascendente/descendente, abuso de poder, contra criança/idoso/enfermo/gestante/deficiente, de serviço, com arma de serviço.
Art. 71. Reincidência: novo crime após trânsito em julgado. §1º Temporariedade: 5 anos.
Art. 72. Atenuantes: menor de 21/maior de 70 anos; comportamento anterior meritório.
Art. 77. Pena-base fixada pelo art. 69, depois atenuantes/agravantes, depois causas de diminuição/aumento.
Art. 79. Concurso material: penas cumulativas.
Art. 79-A. Concurso formal: mais grave aumentada de 1/6 a metade.
Art. 80. Crime continuado: pena de um só crime aumentada de 1/6 a 2/3.
Art. 81. Limite: 30 anos (reclusão), 15 anos (detenção).
Art. 84. Suspensão condicional: pena até 2 anos, suspensa por 3-5 anos (reclusão) ou 2-4 anos (detenção). §2º Pena até 4 anos suspensa por 4-6 anos se maior de 70 anos ou razões de saúde.
Art. 89. Livramento condicional: pena ≥ 2 anos, cumprida metade (primário) ou 2/3 (reincidente).
Art. 95. Se livramento não revogado, extinta a pena.
Art. 96. Livramento não se aplica a crime em tempo de guerra.

PENAS ACESSÓRIAS (Arts. 98-108)
Art. 98. Penas acessórias: I - perda de posto e patente; II - indignidade para oficialato; III - incompatibilidade com oficialato; IV - exclusão das forças armadas; V - perda da função pública; VI - inabilitação para função pública; VII - incapacidade para poder familiar/tutela/curatela; VIII - suspensão dos direitos políticos.
Art. 99. Perda de posto e patente: pena > 2 anos, com julgamento do art. 142, §3º, VI, da CF.
Art. 100. Indignidade: crimes de traição, espionagem ou cobardia.
Art. 102. Exclusão da praça: pena > 2 anos.
Art. 103. Perda da função pública (civil): crime com abuso de poder ou pena > 2 anos.

EFEITOS DA CONDENAÇÃO (Art. 109)
Art. 109. Efeitos: I - obrigação de reparar o dano; II - perda em favor da Fazenda Pública dos instrumentos e produtos do crime.

MEDIDAS DE SEGURANÇA (Arts. 110-120)
Art. 110. Pessoais (detentivas: internação; não detentivas: tratamento ambulatorial, interdição de licença, exílio local, proibição de frequentar lugares) e patrimoniais (interdição de estabelecimento, confisco).
Art. 112. Inimputável: internação em estabelecimento de custódia e tratamento, prazo mínimo 1-3 anos.
Art. 119. Confisco dos instrumentos e produtos do crime.

AÇÃO PENAL E EXTINÇÃO DA PUNIBILIDADE (Arts. 121-135)
Art. 121. Ação penal promovida pelo MP. Parágrafo único: ação privada subsidiária.
Art. 123. Extinção da punibilidade: morte, anistia/graça/indulto, abolitio criminis, prescrição, ressarcimento no peculato culposo, perdão judicial.
Art. 125. Prescrição da pretensão punitiva: 30 anos (morte), 20 anos (pena > 12), 16 anos (> 8 a 12), 12 anos (> 4 a 8), 8 anos (> 2 a 4), 4 anos (1 a 2 anos), 3 anos (< 1 ano).
§5º Interrupção: instauração do processo, sentença/acórdão condenatório, início da execução, reincidência.
Art. 129. Prazos reduzidos pela metade: menor de 21 ou maior de 70 anos.
Art. 130. Imprescritível a execução das penas acessórias.
Art. 132. Deserção: prescrição só extingue punibilidade quando desertor atinge 45 anos (praça) ou 60 anos (oficial).
Art. 133. Prescrição declarada de ofício.`,
  },

  "Lei Orgânica PM": {
    leiNome: "Lei Orgânica Nacional das Polícias Militares — Lei nº 14.751/2023",
    leiSeca: `LEI Nº 14.751, DE 12 DE DEZEMBRO DE 2023.
Institui a Lei Orgânica Nacional das Polícias Militares e dos Corpos de Bombeiros Militares.

Art. 1º Institui a Lei Orgânica Nacional das PMs e CBMs.
Art. 2º PMs e CBMs são instituições militares permanentes, exclusivas e típicas de Estado, essenciais à Justiça Militar, forças auxiliares e reserva do Exército, organizadas com base na hierarquia e disciplina militares, comandadas por oficial da ativa do último posto.
Art. 3º Princípios: I - hierarquia; II - disciplina; III - proteção, promoção e respeito aos direitos humanos; IV - legalidade; V - impessoalidade; VI - publicidade; VII - moralidade; VIII - eficiência; IX - efetividade; X - razoabilidade e proporcionalidade; XI - universalidade na prestação do serviço; XII - participação e interação comunitária.
Art. 4º Diretrizes: I - atendimento permanente ao cidadão; II - planejamento estratégico; III - integração com comunidade; IV - racionalidade e imparcialidade; V - caráter técnico e científico; XIV - uso racional da força e uso progressivo dos meios.
Art. 5º Compete às PMs: I - planejar, coordenar e dirigir a polícia ostensiva; II - executar polícia ostensiva e privativamente a polícia judiciária militar; III - prevenção e repressão dos ilícitos penais militares; V - polícia ostensiva rodoviária e de trânsito; X - coleta, busca e análise de dados sobre criminalidade; XI - inteligência; XIV - recrutar, selecionar e formar membros.
Art. 6º Compete aos CBMs: I - prevenção, extinção e perícia de incêndios; II - busca, salvamento e resgate; III - normas de segurança contra incêndio.
Art. 7º Comandados por oficial da ativa do último posto, do Quadro de Oficiais de Estado-Maior.
Art. 10. Membros são servidores militares dos Estados/DF/Territórios.
Art. 11. Garantias: I - estabilidade; II - irredutibilidade de subsídios.
Art. 15. Ingresso por concurso público de provas ou provas e títulos.
Art. 20. Promoções conforme legislação de cada ente, observando antiguidade, merecimento e demais critérios.`,
  },
};

// Find legislation for a given disciplina name (fuzzy match)
function findLegislation(disciplina: string): { leiNome: string; leiSeca: string } | null {
  // Direct match
  if (LEGISLATION[disciplina]) return LEGISLATION[disciplina];

  // Fuzzy match
  const lower = disciplina.toLowerCase();
  for (const [key, value] of Object.entries(LEGISLATION)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return value;
  }

  // Keyword matches
  if (lower.includes("2.578") || lower.includes("estatuto")) return LEGISLATION["Lei nº 2.578/2012"];
  if (lower.includes("128") && lower.includes("2021")) return LEGISLATION["LC nº 128/2021"];
  if (lower.includes("2.575") || lower.includes("promoç")) return LEGISLATION["Lei nº 2.575/2012"];
  if (lower.includes("cppm") || lower.includes("processo penal")) return LEGISLATION["CPPM"];
  if (lower.includes("rdmeto") || lower.includes("4.994") || lower.includes("regulamento disciplinar")) return LEGISLATION["RDMETO"];
  if (lower.includes("penal militar") || lower.includes("1.001") || lower.includes("cpm")) return LEGISLATION["Direito Penal Militar"];
  if (lower.includes("orgânica") || lower.includes("organica") || lower.includes("14.751")) return LEGISLATION["Lei Orgânica PM"];

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 2, after_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from("questoes")
      .select("*")
      .order("id", { ascending: true })
      .limit(limit);

    if (after_id && after_id > 0) {
      query = query.gt("id", after_id);
    }

    const { data: questoes, error: fetchErr } = await query;

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch questions", details: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!questoes || questoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more questions", validated: 0, ok: 0, fixed: 0, deleted: 0, last_id: after_id || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lastId = questoes[questoes.length - 1].id;

    // Group questions by disciplina so we can provide the right legislation
    const byDisciplina = new Map<string, typeof questoes>();
    for (const q of questoes) {
      const group = byDisciplina.get(q.disciplina) || [];
      group.push(q);
      byDisciplina.set(q.disciplina, group);
    }

    let fixed = 0;
    let deleted = 0;
    let okCount = 0;
    const errors: string[] = [];

    // Process each disciplina group with its specific legislation
    for (const [disciplina, groupQuestoes] of byDisciplina.entries()) {
      const leg = findLegislation(disciplina);

      if (!leg) {
        // No legislation found — these questions are from unknown laws, DELETE them
        for (const q of groupQuestoes) {
          await supabase.from("respostas_usuario").delete().eq("questao_id", q.id);
          const { error: delErr } = await supabase.from("questoes").delete().eq("id", q.id);
          if (delErr) errors.push(`Delete ${q.id}: ${delErr.message}`);
          else deleted++;
        }
        continue;
      }

      // Build payload for this group
      const payload = groupQuestoes.map((q) => ({
        id: q.id,
        disciplina: q.disciplina,
        assunto: q.assunto,
        dificuldade: q.dificuldade,
        enunciado: normalizeWhitespace(q.enunciado),
        alt_a: stripAlternativePrefix(q.alt_a),
        alt_b: stripAlternativePrefix(q.alt_b),
        alt_c: stripAlternativePrefix(q.alt_c),
        alt_d: stripAlternativePrefix(q.alt_d),
        alt_e: stripAlternativePrefix(q.alt_e),
        gabarito: q.gabarito,
        comentario: normalizeWhitespace(q.comentario),
      }));

      const prompt = `Você é um revisor especialista em questões de concurso militar (CHOA PMTO).

LEGISLAÇÃO APLICÁVEL (${leg.leiNome}):
===INÍCIO DA LEI SECA===
${leg.leiSeca}
===FIM DA LEI SECA===

MISSÃO CRÍTICA:
Revise CADA questão abaixo e verifique se ela está 100% conforme a legislação acima.

CRITÉRIOS DE VALIDAÇÃO OBRIGATÓRIOS:
1. O enunciado deve tratar EXCLUSIVAMENTE de conteúdo presente na lei seca fornecida acima.
2. A alternativa marcada como gabarito (0=A,1=B,2=C,3=D,4=E) DEVE conter a resposta EXATA conforme o texto legal.
3. As 4 alternativas incorretas devem ser plausíveis mas claramente erradas conforme a lei.
4. Cada questão deve ter exatamente 5 alternativas textuais válidas (sem placeholders como "A", "B", "I", "II", "UM", "DOIS").
5. O comentário DEVE citar o artigo/dispositivo legal correto que fundamenta a resposta.
6. NÃO pode haver informações inventadas, de outras leis, ou que contradigam o texto legal.

DECISÃO PARA CADA QUESTÃO:
- Se CORRETA e conforme a lei: {"id":X,"ok":true}
- Se pode ser CORRIGIDA (enunciado ok mas gabarito errado, alternativa com erro, comentário impreciso): {"id":X,"corrigida":{campos completos: enunciado, alt_a, alt_b, alt_c, alt_d, alt_e, gabarito (0-4), comentario}}
- Se IRRECUPERÁVEL (conteúdo fora da lei seca, informação inventada, mistura de legislações, impossível corrigir): {"id":X,"deletar":true,"motivo":"explicação breve"}

IMPORTANTE:
- NÃO invente conteúdo. Use APENAS o que está na lei seca acima.
- NÃO misture legislações diferentes.
- Gabarito 0-indexado: 0=A, 1=B, 2=C, 3=D, 4=E.
- Retorne TODOS os ids recebidos.

Questões para revisar:
${JSON.stringify(payload)}

Responda APENAS com JSON array válido.`;

      // Call Groq API directly (no Lovable credits consumed)
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (!groqKey) {
        return new Response(
          JSON.stringify({ error: "GROQ_API_KEY não configurada." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        const errText = await aiResponse.text();
        if (status === 429 || status === 402) {
          return new Response(
            JSON.stringify({
              error: status === 429 ? "Rate limit exceeded. Tente novamente em alguns segundos." : "Créditos insuficientes.",
              last_id: questoes.length > 0 ? questoes[questoes.indexOf(groupQuestoes[0]) > 0 ? questoes.indexOf(groupQuestoes[0]) - 1 : 0].id : after_id || 0,
              validated: okCount + fixed + deleted,
              ok: okCount, fixed, deleted,
            }),
            { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        errors.push(`AI error for ${disciplina}: ${errText.slice(0, 200)}`);
        // Mark as ok to skip (don't delete without AI confirmation)
        okCount += groupQuestoes.length;
        continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let aiResultados: any[] = [];
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) aiResultados = parsed;
        else if (Array.isArray(parsed?.resultados)) aiResultados = parsed.resultados;
        else {
          errors.push(`AI response not array for ${disciplina}`);
          okCount += groupQuestoes.length;
          continue;
        }
      } catch {
        errors.push(`Failed to parse AI for ${disciplina}: ${content.slice(0, 200)}`);
        okCount += groupQuestoes.length;
        continue;
      }

      const aiMap = new Map<number, any>();
      for (const item of aiResultados) {
        if (item?.id) aiMap.set(Number(item.id), item);
      }

      // Process and SAVE each question immediately
      for (const original of groupQuestoes) {
        const aiDecision = aiMap.get(Number(original.id));

        if (!aiDecision) {
          // AI didn't return a decision — skip safely
          okCount++;
          continue;
        }

        // DELETE irrecoverable questions
        if (aiDecision.deletar) {
          await supabase.from("respostas_usuario").delete().eq("questao_id", original.id);
          const { error: delErr } = await supabase.from("questoes").delete().eq("id", original.id);
          if (delErr) errors.push(`Delete ${original.id}: ${delErr.message}`);
          else deleted++;
          continue;
        }

        // OK — no changes needed
        if (aiDecision.ok) {
          okCount++;
          continue;
        }

        // CORRECT — apply fixes immediately
        if (aiDecision.corrigida) {
          const c = aiDecision.corrigida;
          const update: Record<string, any> = {};

          // Only update fields that differ
          const fields = ["enunciado", "alt_a", "alt_b", "alt_c", "alt_d", "alt_e", "comentario"] as const;
          for (const f of fields) {
            if (c[f] !== undefined) {
              const newVal = normalizeWhitespace(c[f]);
              const oldVal = normalizeWhitespace(original[f]);
              if (newVal !== oldVal && newVal.length > 3) {
                update[f] = f.startsWith("alt_") ? stripAlternativePrefix(c[f]) : newVal;
              }
            }
          }

          if (c.gabarito !== undefined) {
            const newGab = Math.min(Math.max(Number(c.gabarito), 0), 4);
            if (newGab !== original.gabarito) update.gabarito = newGab;
          }

          if (Object.keys(update).length > 0) {
            const { error: upErr } = await supabase.from("questoes").update(update).eq("id", original.id);
            if (upErr) errors.push(`Update ${original.id}: ${upErr.message}`);
            else fixed++;
          } else {
            okCount++;
          }
        } else {
          okCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        validated: questoes.length,
        ok: okCount,
        fixed,
        deleted,
        last_id: lastId,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
