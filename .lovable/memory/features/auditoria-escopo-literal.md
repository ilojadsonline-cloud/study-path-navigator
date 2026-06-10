---
name: Auditoria - escopo literal (todo o banco / por disciplina)
description: Ação 'start' da audit-questions reseta para pending conforme o escopo escolhido; "Todo o banco" reaudita TUDO (inclusive approved), "Disciplina" reaudita toda a disciplina
type: feature
---
## Literalidade do escopo na auditoria (audit-questions, action='start')

- `mode='all'` (Todo o banco): reseta **TODAS** as questões para `pending` (inclusive `approved`/`auto_corrected`/`admin_resolved`), exceto `deleted`. A UI promete isso.
- `mode='discipline'`: reseta **TODAS** as questões da(s) disciplina(s) selecionada(s), exceto `deleted`.
- `mode='unaudited'`: não reseta; loop filtra `only_unaudited` (pula as que já têm audit não-superseded).
- `mode='reported'`: reseta só questões com reportes pendentes.

### Bug corrigido
- Antes, `all`/`discipline` só resetavam `manual_review`/`error` → quando todas estavam `approved`, a fila ficava 0 e o job terminava "done 0/0". Corrigido para resetar todo o banco/disciplina.

### Detalhe técnico
- O reset usa **paginação por cursor (id) em páginas de 1000** com SELECT+UPDATE por ids, vencendo o teto de 1000 linhas do PostgREST para garantir que o banco inteiro entre na fila sem amostragem.
- Reauditar `all` torna questões temporariamente `pending` (ocultas dos alunos) até a auditoria reaprovar — comportamento intencional pedido pelo admin.
