
CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  disciplines jsonb NOT NULL DEFAULT '[]',
  batches_total integer NOT NULL DEFAULT 0,
  batches_done integer NOT NULL DEFAULT 0,
  batches_results jsonb NOT NULL DEFAULT '[]',
  total_generated integer NOT NULL DEFAULT 0,
  batch_size integer NOT NULL DEFAULT 3,
  batches_per_discipline integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage generation_jobs"
  ON public.generation_jobs
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
