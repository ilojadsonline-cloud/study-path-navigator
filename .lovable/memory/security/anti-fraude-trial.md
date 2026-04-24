---
name: anti-fraude-trial
description: Trial gratuito de 24h calculado pela MENOR data entre auth.users.created_at, profiles.created_at e trial_usage.trial_started_at; invalida trialing Stripe fora dessa janela
type: feature
---

# Regra anti-fraude de trial

A função `check-subscription` usa o helper compartilhado `supabase/functions/check-subscription/trial-access.ts` (`resolveTrialWindow`) para decidir se um usuário ainda está dentro do teste grátis de 24h.

## Como a janela é calculada
- `accessStartMs = min(auth.users.created_at, profiles.created_at, trial_usage.trial_started_at)` — a primeira evidência conhecida de existência da conta vence
- `trialEndsAt = min(stripe.trial_end, accessStartMs + 24h)` — mesmo se o Stripe abrir um novo trialing dias depois, ele é truncado para a janela original
- `expired = !converted_to_paid && trialEndsAt <= now`

## Efeitos
- Quando um trialing do Stripe está fora da janela, a função responde `subscribed: false`, `is_trial: false`, `trial_expired: true` e o frontend faz `signOut()` + redirect para `/assinatura`.
- Contas antigas sem `trial_usage` entram no mesmo cálculo via `auth.users.created_at` e `profiles.created_at`.
- Quando o trial expira **e não há pagamento ativo no Stripe ou no Mercado Pago**, o `check-subscription` chama `auth.admin.updateUserById(..., { ban_duration: "876000h" })` para inativar o login do auth — nenhum dado do usuário é apagado. Ao detectar pagamento ativo (Stripe `active`/`trialing` ou Mercado Pago aprovado), aplica `ban_duration: "none"` e o acesso é reativado automaticamente.
- O login (`signInWithPassword`) detecta `User is banned` e redireciona para `/assinatura?trial_expired=1`, exibindo o aviso de teste expirado.

## Por que existe
Bloqueia usuários que recriam contas/iniciam novo trial no Stripe usando o mesmo email/CPF para burlar o teste grátis de 24h.

**Validação MP (R$50 mínimo)**: `_shared/mercadopago-payments.ts` aceita só `approved` com `transaction_amount >= 50` (`MP_MIN_PAID_AMOUNT`). Autorizações R$0 ou cobranças R$4,99 do MP NÃO liberam 90 dias. Coberto em `mercadopago-payments.test.ts`.

**Sync de ban no admin**: `admin-manage-users` action `list_users` bane proativamente usuários fora da janela 24h sem assinatura ativa (Stripe/MP) e desbane quem reativou. UI mostra "Teste expirado".
