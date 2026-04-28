-- Bloco 2: Auditoria cética com correção automática + versionamento

-- Fila/registro de auditoria (uma linha por questão auditada)
CREATE TABLE IF NOT EXISTS public.question_audits (
  id BIGSERIAL PRIMARY KEY,
  questao_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | auto_fixed | manual_review | approved | rejected | error
  confidence NUMERIC(4,3),
  risk_level TEXT,
  -- low | medium | high
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_patch JSONB,
  ai_summary TEXT,
  applied_patch JSONB,
  audited_by_ai BOOLEAN NOT NULL DEFAULT true,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_audits_status ON public.question_audits(status);
CREATE INDEX IF NOT EXISTS idx_question_audits_questao ON public.question_audits(questao_id);
CREATE INDEX IF NOT EXISTS idx_question_audits_created ON public.question_audits(created_at DESC);

-- Versionamento: snapshot da questão antes de aplicar patch
CREATE TABLE IF NOT EXISTS public.question_versions (
  id BIGSERIAL PRIMARY KEY,
  questao_id BIGINT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  change_reason TEXT,
  changed_by UUID,
  audit_id BIGINT REFERENCES public.question_audits(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_versions_questao ON public.question_versions(questao_id, version_number DESC);

-- Job runner para auditoria em lote
CREATE TABLE IF NOT EXISTS public.audit_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  -- running | done | error | canceled
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { disciplinas?: string[], only_unaudited?: bool, limit?: number }
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  auto_fixed INTEGER NOT NULL DEFAULT 0,
  flagged INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_user ON public.audit_jobs(user_id, created_at DESC);

-- RLS
ALTER TABLE public.question_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage question_audits" ON public.question_audits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage question_versions" ON public.question_versions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage audit_jobs" ON public.audit_jobs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER trg_question_audits_updated
  BEFORE UPDATE ON public.question_audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_audit_jobs_updated
  BEFORE UPDATE ON public.audit_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();