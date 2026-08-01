---
name: Multi-curso — Fase 5 (auditoria, geração, dedup e assinaturas)
description: Auditoria IA, dedup, listas de disciplinas e painel de assinaturas escopados por curso; coluna "Curso assinado"
type: feature
---
- `audit-questions`: aceita `curso_id`/`curso_slug`; detecta questões de 4 alternativas (CBMTO, `alt_e` vazio) via `altKeysOf`/`altLettersOf`; carrega texto legal escopado no curso (fallback legado só no PMTO); jobs e reauditoria filtram por curso.
- `AdminAuditoriaTab`: usa `useCurso` + `getDisciplinasGeracao(cursoSlug)`; lista e inicia jobs no curso ativo.
- `generate-questions-batch`: dedup (`existingQ`) escopado por `curso_id` (legado NULL só no PMTO).
- RPCs: `list_disciplinas(p_curso_id)` e `dedup_disciplina_preview(..., p_curso_id)` filtram por curso (legado NULL = PMTO). Clientes: Questoes.tsx, AdminQuestoesTab, PendingPublicationCard, DedupQuestoesCard.
- `PendingPublicationCard`: pendentes e "selecionar todas" filtram por curso; POP só aparece no PMTO.
- Compartilhado entre cursos: usuários, assinaturas e presença online. `AdminAssinaturasTab` mostra coluna "Curso assinado" (badges por sigla, CBMTO em vermelho) e filtro por curso.
