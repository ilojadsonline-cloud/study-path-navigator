
CREATE TABLE public.cronogramas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Meu Cronograma',
  tipo TEXT NOT NULL DEFAULT 'padrao',
  horas_semanais INTEGER NOT NULL DEFAULT 20,
  distribuicao JSONB NOT NULL DEFAULT '{"videoaulas": 40, "lei": 30, "questoes": 30}'::jsonb,
  dias_semana TEXT[] NOT NULL DEFAULT ARRAY['segunda','terca','quarta','quinta','sexta'],
  horario_inicio TEXT NOT NULL DEFAULT '19:00',
  horario_fim TEXT NOT NULL DEFAULT '23:00',
  atividades JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cronogramas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cronogramas"
ON public.cronogramas FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cronogramas"
ON public.cronogramas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cronogramas"
ON public.cronogramas FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cronogramas"
ON public.cronogramas FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all cronogramas"
ON public.cronogramas FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cronogramas_updated_at
BEFORE UPDATE ON public.cronogramas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
