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
    leiSeca: `DECRETO-LEI Nº 1.002/1969 - CÓDIGO DE PROCESSO PENAL MILITAR
APENAS Arts. 8º a 28º e Arts. 243º a 253º.

Art. 8º Compete à Polícia judiciária militar: a) apurar os crimes militares; b) prestar informações à Justiça Militar e MP; c) cumprir mandados de prisão; d) representar sobre prisão preventiva e insanidade mental; e) cumprir determinações da Justiça Militar; f) solicitar informações de autoridades civis; g) requisitar pesquisas e exames da polícia civil; h) atender pedido de apresentação de militar à autoridade civil.

Art. 9º O inquérito policial militar é a apuração sumária de fato que configure crime militar. Tem caráter de instrução provisória.
Art. 10. Inquérito iniciado por portaria: a) de ofício; b) determinação superior; c) requisição do MP; d) decisão do STM; e) requerimento da parte ofendida; f) sindicância com indício de infração penal militar.
Art. 12. Autoridade deve: a) dirigir-se ao local; b) apreender instrumentos; c) efetuar prisão do infrator; d) colher provas.
Art. 16. O inquérito é sigiloso.
Art. 17. Incomunicabilidade do indiciado: máximo 3 dias.
Art. 18. Detenção durante investigações: até 30 dias (prorrogável por mais 20).
Art. 20. Prazo do inquérito: 20 dias (preso) ou 40 dias (solto).
Art. 22. Inquérito encerrado com relatório minucioso.
Art. 24. Autoridade militar não pode mandar arquivar autos de inquérito.
Art. 25. Arquivamento não obsta novo inquérito se novas provas.
Art. 27. Auto de flagrante suficiente pode constituir o inquérito.
Art. 28. Inquérito dispensado: a) fato e autoria esclarecidos; b) crimes contra honra de autor identificado.

Art. 243. Qualquer pessoa pode e militares devem prender quem for insubmisso, desertor ou em flagrante delito.
Art. 244. Flagrante delito: a) está cometendo; b) acaba de cometer; c) é perseguido logo após; d) encontrado logo depois com instrumentos/objetos.
Art. 245. Infrações permanentes: flagrante enquanto não cessar permanência.
Art. 246. Auto de prisão lavrado pela autoridade, ouvidas testemunhas.
Art. 247. Prisão comunicada imediatamente ao juiz com cópia do auto.
Art. 248. Infração inafiançável: falta de testemunhas não impede o auto.
Art. 249. Falta do auto não obsta instauração do inquérito.
Art. 250. Indiciado conduzido à autoridade em 24 horas.
Art. 253. Preso em flagrante pode defender-se.`,
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
    leiSeca: `DECRETO-LEI Nº 1.001/1969 - CÓDIGO PENAL MILITAR - PARTE GERAL

Art. 1º Não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal.
Art. 2º Ninguém pode ser punido por fato que lei posterior deixa de considerar crime.
§1º A lei posterior que favorece o agente aplica-se retroativamente.
Art. 5º Crime praticado no momento da ação ou omissão.
Art. 6º Lugar do crime: onde se desenvolveu a atividade criminosa.
Art. 7º Lei penal militar aplica-se ao crime no todo ou em parte no território nacional, ou fora dele.

Art. 9º Crimes militares em tempo de paz:
I - crimes deste Código, definidos de modo diverso na lei penal comum, ou nela não previstos;
II - crimes previstos neste Código e na legislação penal, quando praticados: a) por militar da ativa contra militar na mesma situação; b) por militar da ativa, em lugar sujeito à administração militar, contra militar da reserva/reformado ou civil; c) por militar em serviço ou atuando em razão da função; d) por militar durante manobras ou exercício; e) por militar da ativa contra patrimônio sob administração militar.
III - crimes praticados por militar da reserva, reformado, ou civil, contra instituições militares.

Art. 12. Militar da reserva/reformado empregado na administração militar equipara-se ao da ativa.
Art. 22. Militar: qualquer pessoa incorporada ou matriculada em instituição militar.
Art. 24. Superior: I - nível hierárquico, posto ou graduação superiores; II - função com autoridade sobre outro de igual posto/graduação.

Art. 29. Resultado imputável a quem lhe deu causa.
Art. 30. Crime: I - consumado (todos elementos); II - tentado (iniciada execução, não consuma por circunstâncias alheias).
Art. 33. Crime: I - doloso (quis resultado ou assumiu risco); II - culposo (sem cautela, não prevê resultado previsível).
Art. 38. Não culpado: a) coação irresistível; b) estrita obediência a ordem de superior.

Art. 42. Não há crime: I - estado de necessidade; II - legítima defesa; III - estrito cumprimento do dever legal; IV - exercício regular de direito.
Art. 43. Estado de necessidade: preservar direito de perigo certo e atual.
Art. 44. Legítima defesa: repelir injusta agressão, atual ou iminente, usando moderadamente meios necessários.
Art. 45. Excesso culposo é punível se previsto como crime culposo.

Art. 55. Penas principais: I - morte; II - reclusão; III - detenção; IV - prisão; V - impedimento; VI - suspensão do exercício; VII - reforma.
Art. 57. Reclusão e detenção: até 30 anos.`,
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
    const { limit = 5, after_id } = await req.json();

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

      // Call AI with a strong model for accuracy
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
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
