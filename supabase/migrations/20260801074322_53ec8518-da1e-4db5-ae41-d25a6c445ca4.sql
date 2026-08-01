ALTER TABLE public.discipline_legal_texts DROP CONSTRAINT IF EXISTS discipline_legal_texts_disciplina_key;
CREATE UNIQUE INDEX IF NOT EXISTS discipline_legal_texts_disciplina_curso_uidx
  ON public.discipline_legal_texts (disciplina, COALESCE(curso_id, '00000000-0000-0000-0000-000000000000'::uuid));