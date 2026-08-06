# Corrigir menções à alternativa "E" nas questões do CHOA CBMTO

## O que foi verificado no banco (CBMTO)

- 1.050 questões CBMTO no total.
- **66 questões ainda têm a alternativa E preenchida** (o CBMTO deve ter apenas A–D). Essas realmente exibem 5 alternativas para o aluno.
- **7 questões trazem análise da alternativa E no comentário** (algumas delas sem alternativa E existente — é exatamente o que o aluno viu).
- **1 questão CBMTO tem gabarito = E**, ou seja, a resposta correta está na alternativa que não deveria existir. Essa precisa de tratamento manual, não pode ser apagada automaticamente.

## Correções propostas

### 1. Proteção na exibição (imediata, vale para tudo)
No componente de comentário, quando o curso ativo usa 4 alternativas (CBMTO), qualquer bloco de análise referente à letra "E" é descartado na renderização. Assim, mesmo que sobre texto antigo no banco, o aluno nunca mais vê análise de alternativa inexistente.

### 2. Limpeza dos dados (migração)
- Remover do texto do comentário o trecho de análise da alternativa E nas questões CBMTO afetadas (corta do marcador "E)" / "Alternativa E" até o próximo marcador reconhecido, preservando "Dica de prova" e "Base normativa").
- Limpar o campo da alternativa E nas 65 questões CBMTO que a têm preenchida e cujo gabarito é A–D.

### 3. Caso isolado
A única questão CBMTO com gabarito na letra E fica de fora da limpeza automática e será listada para você revisar/editar manualmente no painel admin (ou excluir, se preferir).

## Detalhes técnicos

- `src/components/QuestaoComentario.tsx`: aceitar `maxAlternativas` (via `useCurso`/`getQtdAlternativas`) e filtrar seções `alt`/`incorrect` com `letter === "E"`.
- Migração SQL: `UPDATE public.questoes` com regex sobre `comentario` e `alt_e = ''`, escopado por `curso_id` do curso `cbmto` e `gabarito < 4`. Nenhuma alteração de estrutura, nenhum registro apagado.
- A geração/auditoria já produz apenas A–D para CBMTO; isto é correção do legado.
