---
name: Criação Manual e UX de Questões
description: Cadastro manual de questões no painel Gerar com banca/ano/prova; tesoura para riscar alternativas; comentário estruturado
type: feature
---
## Campos novos em `questoes`
- `banca` (text), `ano` (integer), `prova` (text), `origem` (text: 'manual' | IA). Migração additiva.
- `id` é GENERATED ALWAYS AS IDENTITY — nunca enviar id no insert.
- RLS: admins podem INSERT/UPDATE em `questoes` (via `has_role`). Questão manual entra com `audit_status='approved'`, `origem='manual'`.

## Criação manual (Admin → aba Gerar)
- `src/components/admin/ManualQuestaoForm.tsx` embutido no topo do `AdminGerarTab` (colapsável).
- Campos: disciplina, assunto, dificuldade, banca, ano, prova, enunciado, 5 alternativas (clica na letra p/ marcar gabarito), comentário. Valida com zod.

## UX no Banco de Questões (`src/pages/Questoes.tsx`)
- Exibe linha "Ano / Banca / Prova" quando presentes.
- Ícone de tesoura por alternativa: clicar risca (line-through + opacity-40) e troca p/ ícone de desfazer (RotateCcw); alternativa riscada não pode ser selecionada. Estado em `crossedOut: Record<questaoId, number[]>`.
- Ao selecionar uma alternativa, a tesoura some e ela fica destacada (ring primary) até confirmar.

## Comentário estruturado (`src/components/QuestaoComentario.tsx`)
- Faz parse do comentário gerado em seções: gabarito (verde), pegadinha (âmbar), distratores incorretos (vermelho), "Lembre-se" (primary). Fallback: parágrafo único se não casar o padrão.
