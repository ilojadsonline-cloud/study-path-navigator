ALTER TABLE public.questoes
  ADD COLUMN IF NOT EXISTS difficulty_level text,
  ADD COLUMN IF NOT EXISTS cognitive_skill text,
  ADD COLUMN IF NOT EXISTS trap_type text;