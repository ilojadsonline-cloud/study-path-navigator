---
name: Simulado Semanal e Importação Markdown
description: Importação de questões via Markdown (admin) e Simulado Semanal online com ranking, 1 tentativa e timer de 4h
type: feature
---
## Importação de questões via Markdown
- `src/lib/markdown-questoes-parser.ts`: parser "blocos com rótulos" (separador `---`). Campos: Disciplina, Assunto, Dificuldade, Banca, Ano, Prova, Enunciado (multilinha), alternativas `A) ... E)`, Gabarito (A–E), Comentário (multilinha). Retorna `{ validas, ignoradas }`. Questões fora do padrão são IGNORADAS (disciplina não reconhecida, enunciado curto, alternativa faltando, gabarito inválido, comentário ausente).
- `src/lib/edital-distribuicao.ts`: `EDITAL_DISTRIBUICAO` (Anexo II): Lei 2.578=9, Lei 2.575=8, LC 128=5, CPPM=6, RDMETO=5, POP=7, Língua Portuguesa=5, Redação Oficial=5 → 50 questões × 2,0 = 100 pts. `normalizarDisciplina()` mapeia aliases p/ o padrão do banco. NOTA_MINIMA=60, VAGAS=50.
- UI admin: `MarkdownImportCard.tsx` embutido no `AdminGerarTab` (aba Gerar). Insere em `questoes` com `origem='manual'`, `audit_status='approved'`.

## Simulado Semanal (online, ranking)
- Tabelas: `simulados_semanais` (meta), `simulado_semanal_questoes` (gabarito oculto — RLS admin-only), `simulado_semanal_tentativas` (1 por user via UNIQUE(simulado_id,user_id)). RPC `get_simulado_semanal_ranking(p_simulado_id)` (security definer, só authenticated) ordena por pontuação desc, tempo asc; respeita `show_in_ranking` (mascara nome) mas sempre retorna user_id; situação: classificado (≥60 e posição≤50) / aprovado_nao_classificado / reprovado.
- Edge function `simulado-semanal` (verify_jwt=false, valida JWT no código): ações `status|start|save|submit|results`. Score é calculado SEMPRE no servidor (service role) a partir dos gabaritos; timer de 4h (`duracao_minutos`) não pausa; auto-finaliza ao expirar; 1 tentativa única.
- Admin sobe a prova via Markdown na aba "Simulado Semanal" (`AdminSimuladoSemanalTab`), com validação obrigatória da distribuição do edital (exatamente 50 na proporção). Pode ativar/desativar, ver ranking, excluir.
- Aluno: página `/simulado-semanal` (`SimuladoSemanal.tsx`) com intro/regras, prova com cronômetro + autosave (25s), e tela de resultado (nota, situação, ranking, gabarito + revisão via `QuestaoComentario`).
- Destaque no dashboard: `SimuladoSemanalDestaque.tsx` no topo do painel "Meu Desempenho" (chama `status`); estados novo/em andamento/concluído. Link no sidebar "Simulado Semanal".
