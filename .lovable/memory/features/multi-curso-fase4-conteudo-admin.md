---
name: Multi-curso — Fase 4 (conteúdo do admin por curso)
description: Geração IA, import Markdown, mapas mentais, bizu aulas, textos legais, banco de questões admin e simulado semanal escopados por curso_id
type: feature
---
Fase 4 concluída — tudo criado/listado no admin respeita o curso ativo (`useCurso()`), usando `cursoOrFilter(cursoId)` (inclui legado `curso_id IS NULL`).

- `generate-questions-batch`: aceita `curso_id` e carimba nas questões (ambos os caminhos de insert).
- `AdminGerarTab`, `MarkdownImportCard`: enviam `cursoId`; badge do curso de destino.
- `AdminMapasMentaisTab`, `AdminBizuAulaTab`: listagem filtrada + insert com `curso_id`.
- `AdminTextosLegaisTab` + edge `store-legal-text`: aceita `curso_id`; delete-antes-de-inserir escopado no curso (não apaga texto de outro curso).
- `AdminQuestoesTab`: banco de questões do admin filtra por curso (count + lista).
- `AdminSimuladoSemanalTab`: lista e cria simulados com `curso_id`.
- Edge `simulado-semanal`: aceita `curso_id` no body e filtra simulados ativos; `SimuladoSemanal.tsx` e `SimuladoSemanalDestaque.tsx` enviam o curso ativo e refazem fetch ao trocar.
