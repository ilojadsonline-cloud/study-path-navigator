ALTER TABLE public.questoes
  ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audit_status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS audit_techniques jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questoes_audit_status ON public.questoes(audit_status);