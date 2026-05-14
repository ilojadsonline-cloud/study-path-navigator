# Auditoria de Questões V4 — Plano de Implementação

Este plano cobre os 9 pontos do prompt. Nada fora de auditoria/geração será tocado.

## 1. Migração de banco (additiva)

Adicionar coluna `audit_status` em `questoes`:

```sql
ALTER TABLE public.questoes
  ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audit_status_updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS audit_techniques jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questoes_audit_status ON public.questoes(audit_status);
```

Valores: `pending | approved | auto_corrected | manual_review | admin_resolved | deleted`.

## 2. Edge function `audit-questions` — reset e regras

Antes de cada rodada:
- `UPDATE questoes SET audit_status='pending' WHERE audit_status IN ('approved','auto_corrected')`
- Selecionar para auditar: `WHERE audit_status='pending'` (manual_review e admin_resolved ficam de fora).

Ao final de cada questão, gravar `audit_status` conforme veredicto da IA:
- Sem issues → `approved`
- Patch aplicado automaticamente (confiança ≥0.9 + risco low) → `auto_corrected`
- Duplicata de menor qualidade ou irrecuperável → `DELETE` físico + log em `question_audits`
- Caso contrário → `manual_review`

Resumo final retornado ao frontend: `{ audited, approved, auto_corrected, manual_review, deleted, admin_resolved_skipped }`.

## 3. Novas verificações no auditor (prompt do DeepSeek)

Adicionar checks no system prompt + validações pós-IA:

**3a. Padrão "alternativa mais longa = correta"**
- Pós-processamento: se `len(alt[gabarito])` é o máximo OU mínimo do conjunto, marcar issue `length_bias` (high) — auditor deve reescrever distratores ou sinalizar.

**3b. Técnicas de distração (mínimo 2)**
- Lista de 10 técnicas no prompt; IA deve registrar em `audit_techniques`.
- Se <2 técnicas detectadas → issue `insufficient_distractors`.

**3c. Legislação desatualizada**
- Carregar `discipline_legal_texts` da disciplina; pedir IA para flagrar termos não encontrados (ex: CPI → CRP). Auto-corrige se substituição preserva sentido; senão manual_review.

**3d. Hierarquia funcional**
- Prompt instrui validar postos/cargos vs texto legal. Issue `hierarchy_violation` quando aplicável.

**3e. Múltiplas alternativas corretas**
- Issue `multiple_correct`. Se IA consegue reescrever distratores com confiança ≥0.9 → auto_corrected; senão manual_review.

**3f. Duplicatas**
- Após IA produzir `assinatura_semantica` (já existe), comparar com últimas N questões da mesma disciplina via Jaccard ≥0.75 do enunciado normalizado. Manter a de maior qualidade (score = len(comentario) + len(distratores) + presença de citação legal). Excluir a outra com `audit_status='deleted'` + DELETE físico.

**3g. Irrecuperáveis**
- Issue `unrecoverable` (enunciado incoerente, sem alternativa correta, fora do banco) → DELETE físico, log.

## 4. Comentário 4-partes (geração + auditoria)

Atualizar prompts de `generate-questions-batch` e do reescritor de `audit-questions`:

```
COMENTÁRIO OBRIGATÓRIO em 4 partes separadas por linha em branco:
1) "A alternativa correta é a [X], pois..." + citação literal do dispositivo.
2) "A pegadinha desta questão está em..." + identifica técnica usada.
3) Análise de cada alternativa errada com dispositivo que a contradiz.
4) "Lembre-se: segundo o [art. X da Lei Y], [regra geral]."
```

Validador pós-IA: regex para garantir presença de "alternativa correta é", "pegadinha", "Lembre-se:". Caso falte → reroll (1x) ou manual_review.

## 5. Questões multidisciplinares (geração)

Novo modo opcional no gerador: ao gerar lote, 20% das questões devem combinar 2 leis. Prompt diferenciado e citação obrigatória de dispositivos das duas leis no comentário.

## 6. UI — `AdminAuditoriaTab.tsx`

- Aba "Revisão Manual": adicionar checkbox por linha + "Selecionar todas" + barra de ação flutuante com "Excluir selecionadas (N)" + AlertDialog de confirmação.
- Botão "Marcar como resolvida" muda `audit_status='admin_resolved'`.
- Card de resumo no topo após auditoria com os contadores do passo 2.
- Botão "Limpar histórico de resolvidas" (`UPDATE questoes SET audit_status='pending' WHERE audit_status='admin_resolved'`).

## 7. Arquivos afetados

- `supabase/migrations/<novo>.sql` — coluna `audit_status`.
- `supabase/functions/audit-questions/index.ts` — reset, novos checks, duplicate/unrecoverable delete, status writes, summary.
- `supabase/functions/generate-questions-batch/index.ts` — anti-length-bias, técnicas registradas, comentário 4-partes, modo multidisciplinar.
- `src/components/admin/AdminAuditoriaTab.tsx` — checkboxes, seleção em lote, resumo, botão limpar resolvidas, botão "marcar resolvida".

## 8. Fora de escopo (não tocar)

Pagamentos, login, ranking, assinaturas, bloqueio/desbloqueio, demais abas admin.

## 9. Critérios de aceite

Conforme item 11 do prompt do usuário — validados manualmente após deploy.
