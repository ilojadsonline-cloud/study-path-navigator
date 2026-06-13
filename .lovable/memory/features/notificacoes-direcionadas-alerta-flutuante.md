---
name: Notificações direcionadas + alerta flutuante
description: notifications.user_id (null=todos / id=individual); realtime; sino + alerta flutuante à esquerda; resposta a reporte gera notificação ao usuário
type: feature
---
## Notificações direcionadas

- Tabela `notifications` ganhou `user_id uuid` (nullable): `null` = broadcast p/ todos; preenchido = individual.
- RLS SELECT: `user_id IS NULL OR user_id = auth.uid() OR has_role(admin)`. INSERT/DELETE só admin.
- Realtime habilitado (`ALTER PUBLICATION supabase_realtime ADD TABLE notifications` + REPLICA IDENTITY FULL).

## Frontend
- `AppLayout.tsx`: query filtra `.or(user_id.is.null,user_id.eq.<uid>)`. Canal realtime `notifications-realtime` (INSERT) → ignora se `user_id` é de outro; senão prepend na lista + mostra **alerta flutuante à esquerda** (`floatingAlert`, fixed left-4 bottom-4, auto-dismiss 9s, clique abre o sino). Sino atualiza contador via lista.
- `AdminNotificacoesTab.tsx`: seletor Destinatário Todos/Usuário específico (busca em `profiles` por nome/email, ilike). Badge Individual/Todos na lista de enviadas.
- `AdminReportsTab.tsx` `sendResponse`: além de gravar `admin_notes`/resolvido, INSERT em `notifications` com `user_id = report.user_id` → usuário recebe alerta no sino + flutuante.

## PendingPublicationCard
- Cada linha pendente tem ações: Visualizar, Editar (QuestionEditDialog + admin-manage-users update_question), Publicar (individual), Excluir (individual via excluir_questoes_por_ids). Dialog de visualizar também tem Editar/Excluir/Publicar.

## Removido
- Toast "Novas questões adicionadas recentemente!" em `Questoes.tsx` (aparecia a cada reload).
