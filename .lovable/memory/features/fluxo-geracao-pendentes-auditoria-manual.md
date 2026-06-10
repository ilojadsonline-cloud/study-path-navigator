---
name: Fluxo oficial geração → pendentes → auditoria manual → publicar/excluir
description: Geração NÃO audita/descarta (cross-audit desligado); tudo vai p/ pendentes; admin audita manualmente (keep_pending) e publica ou exclui
type: feature
---
## Fluxo oficial (pedido do admin)

1. **Gerar questões** → TODAS as questões válidas são inseridas com `audit_status='pending'`.
2. **Lista de pendentes** (`PendingPublicationCard`, aba Validação IA) → as recém-geradas aparecem aqui, ocultas dos alunos.
3. **Auditoria manual** → admin seleciona e clica **"Auditar selecionadas"**. A IA audita e **corrige o conteúdo**, mas mantém `audit_status='pending'` (não publica nem oculta).
4. **Publicar/Excluir** → admin publica as boas (`approved`) ou exclui as ruins (soft delete).

## Mudanças técnicas

### generate-questions-batch
- **Auditoria cruzada pós-geração DESATIVADA** (`const ENABLE_CROSS_AUDIT = false`). Antes ela descartava/auto-corrigia na geração e causava "+0 lotes". Agora nada é descartado/corrigido na geração — tudo vai para pendentes para auditoria manual.

### audit-questions (modo `selected` + `keep_pending`)
- `start` com `mode='selected'` aceita `keep_pending: true` (gravado em `scope.keep_pending`).
- `processQuestion(supabase, q, cache, { keepPending })`: quando `keepPending`, NUNCA muda `audit_status` para `approved`/`auto_corrected`/`manual_review`/`deleted` — sempre volta para `pending` (aplica correções de conteúdo normalmente). Duplicata/irrecuperável também ficam `pending` (audit registra `soft_deleted` como sugestão), e o admin decide.
- Sem `keep_pending` (aba Validação IA padrão / "Todo o banco" etc.), o comportamento antigo continua: aprova/oculta/exclui automaticamente.

### PendingPublicationCard (UI)
- Botão "Auditar selecionadas" chama `audit-questions` (start mode=selected, keep_pending=true) e roda o loop `run` mostrando progresso.
- Carrega a auditoria mais recente por questão (`question_audits`) e mostra um **AuditBadge** por linha: OK na auditoria / Corrigida / Revisar / Sugerido excluir.
