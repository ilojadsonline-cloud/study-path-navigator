
-- Tabela de mapas mentais (1 PDF por (disciplina, tópico))
CREATE TABLE IF NOT EXISTS public.mapas_mentais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  disciplina_id TEXT NOT NULL,
  topico TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (disciplina_id, topico)
);

CREATE INDEX IF NOT EXISTS idx_mapas_mentais_disciplina ON public.mapas_mentais (disciplina_id);

ALTER TABLE public.mapas_mentais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mapas_mentais"
  ON public.mapas_mentais FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage mapas_mentais"
  ON public.mapas_mentais FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_mapas_mentais_updated_at
  BEFORE UPDATE ON public.mapas_mentais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para os PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('mapas-mentais', 'mapas-mentais', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de Storage: leitura para autenticados; admin gerencia
CREATE POLICY "Authenticated can read mapas-mentais files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'mapas-mentais');

CREATE POLICY "Admins can insert mapas-mentais files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'mapas-mentais' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update mapas-mentais files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'mapas-mentais' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete mapas-mentais files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'mapas-mentais' AND has_role(auth.uid(), 'admin'::app_role));
