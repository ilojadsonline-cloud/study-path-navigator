---
name: Análise de desempenho por disciplina/assunto
description: Componente AnaliseDificuldade + RPC get_desempenho_disciplinas; % de erro por assunto no resultado do simulado semanal e diagnóstico geral no dashboard
type: feature
---
Análise de dificuldade por % de erro, reutilizável.

- **Componente**: `src/components/AnaliseDificuldade.tsx` — recebe `items: {name,total,corretas}[]`, calcula % de erro, ranqueia da matéria mais difícil para a mais fácil, destaca "Priorize a revisão" (pctErro ≥ 40, top 3) e "Pontos fortes" (top 2 por acerto). Props: `minAmostra`, `unidade`, `emptyHint`. Cores: ≥70% acerto = success, 50-70 = warning, <50 = destructive.
- **Simulado Semanal** (`SimuladoSemanal.tsx` ResultsView): card "Análise de desempenho" com toggle Por disciplina / Por assunto, calculado client-side de `resultQuestoes` + `respostas` (anulada conta como acerto). Fica entre o Ranking e a Revisão/gabarito.
- **Dashboard** (`Dashboard.tsx`): card "Diagnóstico de Estudo — Onde Focar" (full-width, após grid Calendário), `minAmostra=5`, alimentado pela RPC `get_desempenho_disciplinas`.
- **RPC** `get_desempenho_disciplinas(p_user_id uuid default auth.uid())` SECURITY DEFINER: soma banco (respostas_usuario ⋈ questoes), simulados de disciplina ÚNICA (ignora mistos com '|' e "Todas as Disciplinas"), e simulado_semanal por questão (respostas jsonb vs gabarito, anulada=acerto). Client normaliza nomes com normalizarDisciplina.
