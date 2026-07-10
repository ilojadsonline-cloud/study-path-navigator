---
name: Acesso garantido por registro local (check-subscription resiliente)
description: check-subscription confia em app_metadata.access_expires_at / trial_usage antes de consultar Stripe/MP; evita "acesso expirado" para quem já pagou (avulso PIX/boleto) quando a API do gateway falha ou o pagamento sai da janela de busca
type: feature
---
## Problema
Cliente pagou (ex.: PIX/boleto avulso via Mercado Pago), admin reconhecia a
assinatura ("Ativo", "MP pago", dias restantes), mas ao logar aparecia
"acesso expirado" e redirecionava para /assinatura.

Causa: `check-subscription` (que libera o login via `subscribed`) dependia de
uma nova consulta AO VIVO na API do Mercado Pago (`findApprovedMercadoPagoPayment`)
a cada verificação. Para pagamento avulso (não recorrente), se essa chamada
falhasse (erro/rate-limit da API) ou o pagamento saísse da janela de busca de
90 dias / paginação, a função retornava `subscribed: false` → frontend bloqueava.

## Correção (`supabase/functions/check-subscription/index.ts`)
- **PRIORIDADE 0 (fonte da verdade local)**: logo após autenticar o usuário,
  antes de qualquer ida ao Stripe/MP, verifica-se:
  - `user.app_metadata.access_expires_at` (gravado pelo mercadopago-webhook em
    `reactivateUser`) — desde que `trial_blocked !== true`.
  - `trial_usage.converted_to_paid = true` + `trial_ends_at` (data de acesso).
  - Se a maior dessas datas ainda está no futuro → retorna `subscribed: true`
    (`source: "stored"`), faz `unbanAuthUser`, e NÃO chama a API do gateway.

## Regra geral
- Pagamento já confirmado grava a data de expiração localmente
  (app_metadata.access_expires_at). Essa data é a fonte da verdade para MANTER
  acesso — nunca derrubar acesso de quem pagou por falha transitória de API.
- A consulta ao vivo (Stripe/MP) serve para DESCOBRIR/ESTENDER acesso novo,
  não como única forma de manter o acesso existente.
