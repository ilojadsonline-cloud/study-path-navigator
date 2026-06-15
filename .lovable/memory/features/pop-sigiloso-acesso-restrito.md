---
name: POP Sigiloso — Página e Acesso Restrito
description: Disciplina POP (sigilosa) com página própria não listada, controle de acesso por CPF/allowlist/admin, geração igual às demais
type: feature
---
# POP — Conteúdo Sigiloso (Restrito)

A disciplina **POP** existe no banco como `questoes.disciplina = 'POP'` e segue o MESMO pipeline de geração/validação/auditoria/correção/reporte das demais (tipo "lei", fonte única = `discipline_legal_texts.content` onde `disciplina='POP'`).

## Acesso (quem pode ver as questões POP)
Função `public.has_pop_access()` (SECURITY DEFINER) retorna true se:
1. usuário é admin (`has_role`), OU
2. existe linha em `pop_access` (liberação manual pelo admin), OU
3. o CPF do `profiles` do usuário (somente dígitos) bate com algum `pop_allowlist.cpf` (planilha oficial de militares).

Tabelas (admin gerencia; migração additive):
- `pop_allowlist` (matricula, rg, cpf, nome_completo) — lista oficial da planilha.
- `pop_access` (user_id único) — liberações manuais.

## Proteção
- RLS de `questoes` (SELECT): `TRIM(disciplina) <> 'POP' OR has_pop_access()`.
- `list_disciplinas()` exclui 'POP' → não aparece no Banco de Questões nem nos filtros.
- Simulados usam lista oficial (sem POP) → POP nunca entra em simulado.

## Frontend
- Página **`/pop-questoes`** (`src/pages/PopQuestoes.tsx`): NÃO listada na navegação/sidebar; acesso só por link direto. Faz gate via `has_pop_access`; mostra aviso de sigilo + responsabilidade do usuário por reprodução; prática completa (responder/gabarito/comentário/reportar).
- Admin: aba **POP (Sigiloso)** (`AdminPopAccessTab.tsx`) — importar/gerenciar allowlist (incl. colar em massa `Nome;CPF;RG;Matrícula`), liberar/revogar usuários, copiar link.
- Texto legal do POP cadastrado na aba **Textos Legais** (`disciplina: "POP"`).

## Geração (índice posicional!)
POP é o **ÚLTIMO** item (índice 7) tanto em `generate-questions-batch/index.ts` `DISCIPLINES` quanto em `AdminGerarTab.tsx` `DISCIPLINES`. NUNCA inserir POP no meio — `disciplina_index` é posicional e quebraria os índices das outras disciplinas.
