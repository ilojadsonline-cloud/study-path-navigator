ALTER TABLE public.questoes
  ADD COLUMN IF NOT EXISTS banca text,
  ADD COLUMN IF NOT EXISTS ano integer,
  ADD COLUMN IF NOT EXISTS prova text,
  ADD COLUMN IF NOT EXISTS origem text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questoes'
      AND policyname = 'Admins can insert questoes'
  ) THEN
    CREATE POLICY "Admins can insert questoes"
      ON public.questoes
      FOR INSERT
      TO authenticated
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questoes'
      AND policyname = 'Admins can update questoes'
  ) THEN
    CREATE POLICY "Admins can update questoes"
      ON public.questoes
      FOR UPDATE
      TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;