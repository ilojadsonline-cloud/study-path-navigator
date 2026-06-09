---
name: Prompt Mestre da Banca
description: Diretriz oficial de 16 regras aplicada a TODAS as disciplinas na geração de questões
type: feature
---
Prompt-mestre oficial da coordenação (CHOA/2026 PMTO) aplicado em geração de questões de QUALQUER disciplina.

Implementado como constante `MASTER_BANCA_DIRECTIVE` em `generate-questions-batch/index.ts`, com PRECEDÊNCIA MÁXIMA, injetada nos 3 systemPrompts (jurídico, Língua Portuguesa, Redação Oficial).

16 regras-chave: 5 alternativas A–E; só 1 correta; distratores plausíveis/técnicos; só conteúdo da base interna; só dentro do edital; nada revogado; sem repetição; sem distratores fracos; correta não pode ser sempre a mais longa; sem dupla interpretação; enunciado enxuto; linguagem impessoal/militar; nomenclatura legal rigorosa; comentário analisa A–E; **"Dica de prova:" ao final**; informar base normativa.

Mapeamento p/ JSON (saída continua JSON, não markdown): Assunto→`assunto`; Nível→`dificuldade`; Competência→`cognitive_skill`; comentário+análise+dica+base normativa consolidados em `comentario`.
