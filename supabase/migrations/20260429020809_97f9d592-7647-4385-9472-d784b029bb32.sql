-- Speed up audit queue lookups used by the admin validation tool
CREATE INDEX IF NOT EXISTS idx_question_audits_questao_status_created
ON public.question_audits (questao_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_audits_status_created
ON public.question_audits (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_status_created
ON public.audit_jobs (status, created_at DESC);

-- Close stale open audit rows when the same question already has a resolved audit row.
-- This keeps the admin queue focused on unresolved items without deleting history.
WITH resolved_questions AS (
  SELECT DISTINCT questao_id
  FROM public.question_audits
  WHERE status IN ('approved', 'auto_fixed', 'rejected')
)
UPDATE public.question_audits qa
SET status = 'superseded', updated_at = now()
FROM resolved_questions rq
WHERE qa.questao_id = rq.questao_id
  AND qa.status IN ('manual_review', 'pending', 'error');