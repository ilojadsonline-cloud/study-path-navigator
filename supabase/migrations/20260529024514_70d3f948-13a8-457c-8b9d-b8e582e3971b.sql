CREATE TABLE IF NOT EXISTS public.ai_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  stage text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  routing_mode text NULL,
  success boolean NOT NULL DEFAULT false,
  attempt_index integer NOT NULL DEFAULT 0,
  question_id bigint NULL,
  generation_job_id uuid NULL,
  input_tokens integer NULL,
  output_tokens integer NULL,
  duration_ms integer NULL,
  fallback_reason text NULL,
  error_message text NULL,
  metadata jsonb NULL
);

GRANT SELECT ON public.ai_provider_attempts TO authenticated;
GRANT ALL ON public.ai_provider_attempts TO service_role;

ALTER TABLE public.ai_provider_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_provider_attempts"
ON public.ai_provider_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ai_provider_attempts_created_at ON public.ai_provider_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_attempts_stage ON public.ai_provider_attempts (stage);
CREATE INDEX IF NOT EXISTS idx_ai_provider_attempts_question_id ON public.ai_provider_attempts (question_id);