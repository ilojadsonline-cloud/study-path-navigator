# Project Memory

## Core
- **Identity**: "Método CHOA 2026", active practice platform (not cursinho). Domain: www.metodochoa.com.br.
- **Style**: Dark theme, glassmorphism, gold gradients, Framer Motion.
- **Database**: Additive migrations ONLY. Never drop columns or risk user/subscription data.
- **Edge Functions**: Use Deno with `https://esm.sh/` imports (never `npm:`). Timeout 150s, 18KB context limit.
- **AI/LLM**: Geração de questões usa **Maritaca AI (sabia-4)** como primário; fallback automático → DeepSeek **Reasoner (R1)** → deepseek-chat → Gemini quando Maritaca falha/sem crédito (motivo logado). Maritaca NÃO suporta response_format json_object. **Auditoria/validação seguem DeepSeek/Gemini (inalteradas).** Remove `<think>` tags.
- **Data Integrity**: `gabarito` must be integer 0-4. RLS restricts `questoes` to auth users to hide answers.
- **React**: Vite config uses `resolve.dedupe` for React to prevent dual-instance crashes.
- **Multi-curso**: conteúdo filtrado por `curso_id` via `CursoContext`; PMTO é o curso padrão/legado.

## Memories
- [Multi-curso Fase 2](mem://features/multi-curso-fase2-contexto-filtros) — CursoContext/CursoSwitcher (oculto com 1 curso), filtro curso_id em Questoes/Simulados/Mapas/BizuAula, coluna Cursos no AdminUsersTab
