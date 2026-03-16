
-- Table to persist in-progress simulado state
CREATE TABLE public.simulado_progress (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disciplina text NOT NULL,
  questao_ids integer[] NOT NULL,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  total integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.simulado_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress"
  ON public.simulado_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.simulado_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.simulado_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON public.simulado_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_simulado_progress_updated_at
  BEFORE UPDATE ON public.simulado_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
