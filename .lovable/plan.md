# Plano — Reforço do Pipeline de Questões (Método CHOA)

Implementação em ordem de prioridade (P0 → P2), sem operações destrutivas, preservando usuários, pagamentos e dados históricos.

## P0 — Proteção imediata aos alunos

### 1. Filtro público em `src/pages/Questoes.tsx` (e demais leituras públicas)
- Definir constante `PUBLIC_AUDIT_STATUSES = ["approved", "auto_corrected", "admin_resolved"]`.
- Aplicar `.in("audit_status", PUBLIC_AUDIT_STATUSES)` em TODAS as queries que servem questões ao aluno:
  - `src/pages/Questoes.tsx` (banco de estudo)
  - `src/pages/Simulados.tsx` (montagem de simulado)
  - `src/pages/GerarQuestoes.tsx` (se aplicável)
- Admin (`AdminQuestoesTab`, `AdminAuditoriaTab`) continua vendo tudo.

### 2. Trigger SQL — reporte bloqueia questão
Migração additiva:
```sql
CREATE OR REPLACE FUNCTION public.mark_question_manual_review_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.questoes
     SET audit_status = 'manual_review',
         audit_status_updated_at = now()
   WHERE id = NEW.questao_id
     AND audit_status NOT IN ('manual_review','admin_resolved','deleted');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_mark_question_manual_review_on_report ON public.question_reports;
CREATE TRIGGER trg_mark_question_manual_review_on_report
AFTER INSERT ON public.question_reports
FOR EACH ROW EXECUTE FUNCTION public.mark_question_manual_review_on_report();
```

### 3. Fonte única em geração e auditoria

**`generate-questions-batch/index.ts`**
- Bloquear geração quando `discipline_legal_texts.content` ausente ou `length < 500`: retornar erro `NO_LEGAL_TEXT` antes de chamar IA.
- Acrescentar bloco "FONTE ÚNICA DE VERDADE" no system prompt proibindo PDFs, anexos, memória do modelo, outras leis fora do texto carregado.
- Restringir citação cruzada: só citar diploma se literal no texto carregado.

**`audit-questions/index.ts`**
- Remover qualquer instrução tipo "use conhecimento jurídico geral com cautela".
- Antes de chamar IA por questão: se `legalText` vazio/`< 500` chars → registrar `question_audits` com `status=manual_review`, `risk_level=high`, issue `NO_LEGAL_TEXT`, setar `audit_status=manual_review` na questão e pular IA.

## P1 — Correção assistida (repair) + matriz de prova

### 4. Modo `repair` em `audit-questions/index.ts`
- Novo parâmetro `mode: "audit" | "repair"` no payload do endpoint.
- Prompt de repair instrui IA a devolver JSON exato (recoverable, confidence, risk_level, diagnosis, repair_type, source_articles, proof_matrix[5], patch{...}, needs_human_review).
- Auto-aplicar patch só se: `recoverable && confidence >= 0.9 && risk_level == "low" && proof_matrix.length == 5 && exatamente 1 verdict=true`.
- Casos sensíveis (troca de gabarito, múltipla correta, ou questão já tinha report) → grava patch em `question_audits.proposed_patch` + `audit_status=manual_review`, sem aplicar.
- Snapshot da questão original em `question_versions` antes de qualquer patch.

### 5. Matriz de prova obrigatória (geração + auditoria)
- Validação programática pós-IA: rejeita questão sem 5 entradas na matriz, sem evidência literal (substring real no `discipline_legal_texts.content`), ou com !=1 verdadeira.
- Em geração: descartar do lote. Em auditoria: marcar `manual_review`.

### 6. UI admin para revisar patches (`AdminAuditoriaTab.tsx`)
- Nova sub-aba "Patches pendentes" listando `question_audits` com `proposed_patch IS NOT NULL` e `status='manual_review'`.
- Cada linha → dialog com:
  - questão original × patch (diff visual)
  - diagnosis + proof_matrix renderizada
  - botões: **Aprovar patch**, **Editar e aprovar**, **Rejeitar**, **Marcar irrecuperável**
- Ao aprovar: chama edge function `apply-audit-patch` (nova, simples) que:
  1. cria snapshot em `question_versions`
  2. aplica patch em `questoes`
  3. seta `audit_status='admin_resolved'`
  4. atualiza `question_audits.applied_patch`, `reviewed_by`, `reviewed_at`

## P2 — Não-destrutivo + execução em lotes

### 7. Substituir DELETE físico por status lógico
- Em `audit-questions/index.ts`, qualquer caminho que hoje faz `supabase.from("questoes").delete()` passa a fazer `update audit_status='deleted'` (mantém histórico).
- Admin "Excluir" manual (`AdminQuestoesTab`) permanece como hard-delete (ação humana explícita).

### 8. Migração additiva única (consolidada)
```sql
-- trigger do P0.2 (acima)
-- nada mais; colunas audit_status/audit_status_updated_at/audit_techniques já existem
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | Trigger de reporte |
| `supabase/functions/generate-questions-batch/index.ts` | Bloqueio NO_LEGAL_TEXT, prompt fonte única, matriz de prova |
| `supabase/functions/audit-questions/index.ts` | Bloqueio NO_LEGAL_TEXT, remoção de fallback, modo repair, sem DELETE físico |
| `supabase/functions/apply-audit-patch/index.ts` | NOVA — aplica patch aprovado com versionamento |
| `src/pages/Questoes.tsx` | Filtro PUBLIC_AUDIT_STATUSES |
| `src/pages/Simulados.tsx` | Filtro PUBLIC_AUDIT_STATUSES |
| `src/components/admin/AdminAuditoriaTab.tsx` | Sub-aba "Patches pendentes" + diálogo de revisão |

## Fora de escopo (não tocar)

Pagamentos, login, perfis, ranking, assinaturas, MercadoPago, Stripe, trial, cronograma, mapas mentais, bizu-aulas.

## Critérios de aceite (validados após deploy)

- Aluno só vê `approved | auto_corrected | admin_resolved`.
- Reporte → questão sai do ar em <1s (trigger).
- Geração sem texto legal cadastrado retorna `NO_LEGAL_TEXT` sem chamar IA.
- Auditoria sem texto legal não usa conhecimento geral, vira `manual_review` com issue `NO_LEGAL_TEXT`.
- Modo repair propõe patch com proof_matrix; auto-aplica só em confidence ≥0.9 + low risk + 1 correta.
- Nenhum DELETE físico automático; apenas status `deleted` lógico.
- UI admin permite aprovar/editar/rejeitar patches; versionamento preservado.

Confirme para eu iniciar pela ordem P0 → P1 → P2, ou indique ajustes.
