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
- [Multi-curso Fase 4](mem://features/multi-curso-fase4-conteudo-admin) — conteúdo do admin por curso: geração IA, import Markdown, mapas, bizu aulas, textos legais, banco de questões admin, simulado semanal (edge aceita curso_id)
- [Acesso por Registro Local (resiliência)](mem://features/acesso-por-registro-local-resiliencia) — check-subscription confia em app_metadata.access_expires_at / trial_usage.converted_to_paid ANTES de consultar Stripe/MP
- [Notificações Direcionadas](mem://features/notificacoes-direcionadas-alerta-flutuante) — notifications.user_id (null=todos/id=individual), realtime, sino + alerta flutuante
- [Simulado Semanal + Import Markdown](mem://features/simulado-semanal-importacao-markdown) — importação por Markdown e simulado semanal online com ranking
- [Análise de Desempenho por Disciplina/Assunto](mem://features/analise-desempenho-disciplina-assunto) — AnaliseDificuldade + RPC get_desempenho_disciplinas
- [Maritaca Geração Primária](mem://technical/maritaca-geracao-primaria) — sabia-4 primário; fallback DeepSeek
- [Prompt Mestre Banca](mem://pedagogical/prompt-mestre-banca) — Diretriz oficial 16 regras para toda disciplina
- [Auditoria Escopo Literal](mem://features/auditoria-escopo-literal) — escopo de reauditoria por banco/disciplina
- [Publicação Pendente](mem://features/publicacao-pendente-questoes) — fluxo de publicação de questões geradas
- [Fluxo Geração/Auditoria Manual](mem://features/fluxo-geracao-pendentes-auditoria-manual)
- [Criação Manual e UX de Questões](mem://features/criacao-manual-e-ux-questoes)
- [Editor de Texto Rico](mem://features/editor-texto-rico-questoes)
- [Resposta IA a Reportes](mem://features/resposta-ia-reportes-erro)
- [POP Sigiloso](mem://features/pop-sigiloso-acesso-restrito) — /pop-questoes com allowlist; POP nunca aparece no banco geral
- [Verificação de Assinatura em Background](mem://features/verificacao-assinatura-background)
- [Anti-fraude Trial](mem://security/anti-fraude-trial) — janela única de 24h
