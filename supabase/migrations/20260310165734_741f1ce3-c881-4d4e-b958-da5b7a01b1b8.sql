-- Table to store the full legal text for each discipline
CREATE TABLE public.discipline_legal_texts (
  id bigint generated always as identity primary key,
  disciplina text NOT NULL UNIQUE,
  lei_nome text NOT NULL,
  content text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discipline_legal_texts ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed by edge functions with service role, but also for admin UI)
CREATE POLICY "Anyone can read legal texts"
  ON public.discipline_legal_texts
  FOR SELECT
  TO public
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert legal texts"
  ON public.discipline_legal_texts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update legal texts"
  ON public.discipline_legal_texts
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete legal texts"
  ON public.discipline_legal_texts
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_discipline_legal_texts_updated_at
  BEFORE UPDATE ON public.discipline_legal_texts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();