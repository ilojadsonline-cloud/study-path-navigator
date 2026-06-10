---
name: Verificação de Assinatura em Segundo Plano (não destrutiva)
description: checkSubscription({background:true}) no timer de 30min nunca revoga acesso por falha transitória; evita redirect súbito que parecia "site recarregando sozinho"
type: feature
---
## Problema
Usuários relatavam que, após um tempo logados, o site "recarregava sozinho".
Não existe `window.location.reload()` no código. A causa real: o re-check de
assinatura em segundo plano (timer de 30 min) chamava `checkSubscription()`,
que em falha transitória/negativa fazia `applySubState(false, null)` →
`ProtectedRoute` redirecionava para `/assinatura` ou `/login` (parecia reload).

## Correção (`src/contexts/AuthContext.tsx`)
- `checkSubscription(opts?: { background?: boolean })`.
- Com `background: true`, NUNCA chama `applySubState(false, null)` por erro
  transitório nem por negativa — mantém o estado atual de acesso.
- O `setInterval` de 30 min usa `checkSubscription({ background: true })`.
- A verificação destrutiva só ocorre em login/recarga manual (foreground).

## Regra geral
- onAuthStateChange já ignora TOKEN_REFRESHED/USER_UPDATED/SIGNED_IN repetido.
- App.tsx: react-query com refetchOnWindowFocus/Reconnect/Mount = false.
- Nunca derrubar acesso de sessão ativa por falha de rede momentânea.
