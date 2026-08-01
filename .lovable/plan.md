## Objetivo

Transformar a geração/auditoria de questões do **CHOA CBMTO 2026** em um fluxo editorial controlado, com escopo do edital vinculante, biblioteca de fontes versionada, matriz de dificuldade (11 critérios) e estados editoriais (Aprovada / Correção / Quarentena / Reprovada). Tudo isolado do CHOA PMTO, que continua exatamente como está.

Aproveito o que já existe (admin por curso, `generate-questions-batch`, `audit-questions`, banco de questões, simulado semanal, textos legais) em vez de criar um módulo paralelo duplicado — as abas pedidas viram abas do Painel Admin quando o curso ativo é o CBMTO.

## Etapa 1 — Matriz de escopo do edital (base de tudo)

Novo arquivo `src/lib/escopo-cbmto.ts` com as 10 disciplinas do edital e, para cada uma: arquivo-fonte Markdown esperado, capítulos/artigos **autorizados**, capítulos/artigos **excluídos** (ex.: Salvamento em Altura cap. 17; APH somente caps. 2, 4, 5, 6, 9, 10, 11, 13, 17, 23), edital que autoriza (nº 1/2026/GABCOM, com prevalência do nº 7/2026/DEP só em APH) e data de corte 02/07/2026.

Ajuste das cotas oficiais: Direito (CPM+CPPM) passa a **cota única de 4** e Legislação Específica **cota única de 8** — a divisão interna vira apenas sugestão pedagógica, nunca subcota oficial. Total 50 questões, 2 pontos cada.

## Etapa 2 — Biblioteca "Fontes oficiais"

Nova aba no admin (curso CBMTO): upload e cadastro dos 2 PDFs de edital e dos 14 Markdown autorizados. Para cada fonte: nome, tipo, disciplina, versão, data do documento, data de upload, hash, capítulos autorizados/excluídos, status de validação e observações. Bucket privado + tabela com histórico.

Regra dura: disciplina sem fonte obrigatória validada **não gera e não aprova** questão. A recuperação de trechos para a IA filtra por disciplina + arquivo + capítulo autorizado; capítulo excluído nunca entra no contexto.

## Etapa 3 — Aba "Gerar" (CBMTO)

Modos: questão individual, lote personalizado, lote por disciplina e **simulado oficial de 50**. Campos: disciplina, assunto, quantidade, formato cognitivo, recorte de fonte, comparar com o banco (ineditismo) e observações. Dificuldade travada em **Difícil**.

Antes de redigir, a IA produz a matriz de planejamento por item (fonte, dispositivo, evidência de inclusão no edital, formato, operação cognitiva, letra planejada, hipótese concorrente, diferença em relação ao banco). Planejamento de gabarito: 13/13/12/12 no simulado oficial (alternando entre simulados), diferença máxima de 1 nos demais lotes, sem 3 letras iguais seguidas nem ciclo A-B-C-D.

Prompt de sistema fixo conforme o item 13 do seu texto, com as estratégias por disciplina do item 8, e saída estruturada nos 14 campos obrigatórios (incluindo Análise das alternativas, Dica de prova e Base normativa com arquivo + dispositivo).

## Etapa 4 — Aba "Auditar" (5 camadas)

Entradas: colar questão, importar Markdown/JSON, selecionar do banco, lote inteiro e "Auditoria de simulado oficial".

Camadas visíveis: estrutural, normativa/técnica (escopo, vigência, fidelidade à fonte), editorial, psicométrica e ineditismo (comparação semântica com banco, histórico e o próprio lote). Pontuação nos 11 critérios com mínimo 10/11 e os critérios 5, 6, 9 e 11 eliminatórios.

Para cada falha: categoria, severidade, trecho, motivo, regra violada, fonte usada, correção proposta e resultado da reauditoria. Botão "Corrigir e auditar novamente" só corrige o que tem suporte expresso na fonte; sem suporte → **Quarentena**. Depois de qualquer correção, as 5 camadas rodam de novo.

## Etapa 5 — Lote, banco e relatórios

Auditoria de lote: numeração, distribuição A–D, letras repetidas, diversidade de assuntos/formatos, colisões de ineditismo e, no modo oficial, exatamente 50 itens com as cotas certas. Painel-resumo com aprovadas/correção/quarentena/reprovadas, distribuição por disciplina e por letra, matriz média, fontes usadas, lacunas temáticas e falhas por severidade.

Banco: questões em quarentena ficam separadas do banco publicável; editar questão aprovada volta para "Correção necessária". Exportação Markdown e JSON. Filtros por disciplina, assunto, fonte e status.

## Detalhes técnicos

- Banco: novas tabelas `fontes_oficiais` (com escopo autorizado e hash), `questao_editorial` (status editorial, dispositivo, evidências, 11 critérios, relatório das 5 camadas, hipótese concorrente e lógica dos distratores, assinatura de ineditismo) e log/versão reaproveitando `question_versions`. Tudo escopado por `curso_id`, sem tocar nos dados PMTO. Migrações apenas aditivas.
- Edge functions: novas `cbmto-gerar-questoes` e `cbmto-auditar-questao` (Deno + esm.sh), separadas das atuais, com o prompt-mestre CBMTO e recuperação de trechos filtrada por capítulo. Mantêm o roteamento de IA já usado no projeto.
- Frontend: abas novas no `AdminPanel` visíveis só quando o curso ativo é CBMTO, reaproveitando os componentes de UI existentes.
- Testes automatizados dos 12 critérios de aceite (bloqueio de alternativa E, APH antigo x retificado, cap. 17 de Altura, data de corte, fonte ausente, dupla resposta, 10 pontos com eliminatório, desequilíbrio A–D, simulado 50 com 13/13/12/12, campos obrigatórios, reedição invalidando aprovação e relatório final).

## Sequência de entrega

1. Escopo + cotas + testes de escopo.
2. Biblioteca de fontes (upload, validação, bloqueio).
3. Auditoria em 5 camadas + matriz de 11 critérios + estados editoriais.
4. Gerador com matriz de planejamento e controle de gabarito.
5. Lote/simulado oficial, relatórios e exportação.

Nenhuma questão definitiva é gerada enquanto os arquivos oficiais não estiverem cadastrados e validados; dados de demonstração ficam marcados como fictícios.
