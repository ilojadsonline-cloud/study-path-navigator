---
name: Multi-curso — Fase 2 (contexto e filtros)
description: CursoContext/CursoSwitcher, filtro curso_id nas páginas de conteúdo e coluna Cursos no painel de usuários
type: feature
---
Arquitetura multi-curso (PMTO / CBMTO), Fase 2 — sem mexer em cobrança.

- `src/contexts/CursoContext.tsx`: `CursoProvider` (dentro de `AuthProvider` em App.tsx) expõe `cursos` (acessíveis), `cursoAtivo`, `cursoId`, `setCursoSlug`, `refresh`. Curso ativo persiste em localStorage `choa.curso.slug` (default `pmto`). Admin vê todos os cursos ativos; aluno vê cursos `visivel=true` ou com registro ativo/não expirado em `acessos_curso`.
- Helper `cursoOrFilter(cursoId)` → `curso_id.eq.<id>,curso_id.is.null` (inclui legado sem curso). Usado com `.or(...)` em: Questoes, Simulados (geração), MapasMentais, BizuAula.
- `src/components/CursoSwitcher.tsx`: dropdown no header do AppLayout; **oculto quando há menos de 2 cursos disponíveis** (nada muda para os alunos atuais, só PMTO).
- `src/components/admin/UserCursosCell.tsx`: coluna "Cursos" em AdminUsersTab — badges por sigla + popover para conceder/remover acesso (upsert em `acessos_curso` com `origem='manual_admin'`, onConflict `user_id,curso_id`; remover = `ativo=false`, nunca deleta).
