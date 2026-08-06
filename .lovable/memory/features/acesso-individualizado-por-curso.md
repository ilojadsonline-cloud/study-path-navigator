---
name: Acesso individualizado por curso (PMTO x CBMTO)
description: Regra obrigatória — quem compra CHOA PMTO só libera PMTO, quem compra CHOA CBMTO só libera CBMTO; acesso vem de acessos_curso, nunca de cursos.visivel
type: feature
---
## Regra
O acesso a um curso é SEMPRE individualizado pelo plano comprado:
- `planos.cursos_slugs` define quais cursos o plano libera.
- A concessão é gravada em `acessos_curso` (webhook `mercadopago-webhook` →
  `grantCursoAccess`, ou `reconcile-mp-course-access` quando o pagamento
  ocorreu antes do cadastro).

## Implementação (src/contexts/CursoContext.tsx)
- `temAcesso(curso)` = admin OU registro ativo/não expirado em `acessos_curso`.
- `cursos` (lista navegável) = `todos.filter(temAcesso)` — a coluna
  `cursos.visivel` é apenas informativa e NUNCA libera acesso.
- Fallback legado: `subscribed && slug === 'pmto'` só vale para usuários que
  **não possuem nenhum registro** em `acessos_curso`. Quem comprou o CBMTO tem
  registro e por isso nunca herda o PMTO.

## Reconciliação
`reconcile-mp-course-access` roda no login: busca `payment_events` aprovados por
e-mail (coluna `email` e também e-mail embutido no `external_reference`),
resolve o `plano_slug` (`choa-paid-<ts>-<slug>::<email>` ou `metadata.plano_slug`)
e concede o curso correto. Nunca encurta um acesso existente mais longo.

## Duração
`planos.dias_acesso` manda: mensal 30, trimestral 90, anual 365. A data final é
`data do pagamento + dias`, gravada em `acessos_curso.expires_at` e em
`app_metadata.access_expires_at`. "Dias restantes" no painel é o que sobra até
essa data, não a duração do plano.
