WITH last AS (
  SELECT DISTINCT ON (questao_id) questao_id, status, applied_patch
  FROM public.question_audits
  ORDER BY questao_id, created_at DESC
)
UPDATE public.questoes q
SET audit_status = 'auto_corrected',
    audit_status_updated_at = now()
FROM last l
WHERE l.questao_id = q.id
  AND q.audit_status = 'manual_review'
  AND l.status IN ('auto_fixed','approved')
  AND l.applied_patch IS NOT NULL;