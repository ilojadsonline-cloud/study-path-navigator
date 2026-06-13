---
name: Resposta IA a reportes de erro
description: Fluxo admin para a IA julgar reporte de questão, propor correção e redigir resposta ao usuário
type: feature
---
# Resposta assistida por IA aos reportes de erro

Na aba de Reportes do admin (`AdminReportsTab.tsx`), cada reporte tem o botão "Analisar e corrigir com IA" que chama a edge function `resolve-report-ai`.

A função (`supabase/functions/resolve-report-ai/index.ts`):
- Valida admin (getClaims + user_roles).
- Recebe `{ report_id }`, agrupa TODOS os reportes não resolvidos da mesma questão.
- Carrega o texto legal da disciplina (`discipline_legal_texts`) como fonte única de verdade.
- Usa `runAiStage("heavy_reported_question_audit", ...)` (Gemini Pro → Flash → OpenRouter; complexity high, jsonResponse).
- Retorna: `procedente` (bool), `needs_human_review`, `confianca`, `justificativa`, `resposta_usuario` (mensagem cordial ao aluno) e `proposed_patch` (somente campos alterados; gabarito 0-4 sanitizado).

UI: mostra veredito procedente/improcedente, justificativa, correção sugerida campo a campo, botão "Aplicar correção na questão" (via `admin-manage-users` action `update_question`) e pré-preenche o textarea de resposta com `resposta_usuario`. Nada é aplicado automaticamente — admin revisa, aplica e envia a resposta (que vira `admin_notes` + status resolvido).
