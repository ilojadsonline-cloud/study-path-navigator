---
name: Fluxo de publicação pendente de questões
description: Questões geradas ficam audit_status='pending' e ocultas dos alunos até serem publicadas/aprovadas; painel de publicação em lote na aba Auditoria
type: feature
---
## Gate de publicação (pending até auditar/publicar)

- Questões recém-geradas são inseridas com `audit_status='pending'` (default da tabela) e **NÃO aparecem para alunos**.
- Filtros do aluno (`Questoes.tsx`, `Simulados.tsx`) usam apenas `["approved","auto_corrected","admin_resolved"]` — `pending` foi removido.
- Migração única já feita: todas as `pending` antigas (~920, do fluxo antigo que já eram públicas) foram convertidas para `approved` para não sumirem.
- A auditoria (audit-questions) publica ao aprovar (`approved`/`auto_corrected`); ou o admin publica manualmente em lote.

## Painel "Pendentes de publicação" (aba Auditoria)
- Componente `src/components/admin/PendingPublicationCard.tsx`, renderizado no topo de `AdminAuditoriaTab`.
- Lê `questoes` onde `audit_status='pending'`, paginação server-side (50/pág, `range` + count exact), filtro por disciplina (`list_disciplinas` RPC).
- Seleção em lote: por linha, por página, e "Selecionar todas (N)" (busca só ids, leve).
- Ações: **Publicar selecionadas** (update → `approved`, em chunks de 200), **Excluir** (RPC `excluir_questoes_por_ids`, soft delete com snapshot), visualizar+publicar individual.

## Admin Usuários — paginação
- `admin-manage-users` action `list_users` agora aceita `page`/`page_size`, usa `range` + count exact, retorna `{users,total,page,page_size}`. Antes tinha `.limit(100)` (usuários sumiam).
- `AdminUsersTab.tsx`: estado `page`/`total`, controles Anterior/Próxima, PAGE_SIZE=50.
