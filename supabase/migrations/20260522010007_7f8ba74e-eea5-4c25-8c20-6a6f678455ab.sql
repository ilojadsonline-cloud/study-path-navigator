CREATE TABLE public.bizuaulas_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  disciplina_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  url_youtube TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bizuaulas_videos_disciplina ON public.bizuaulas_videos(disciplina_id, ordem);

ALTER TABLE public.bizuaulas_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read bizuaulas_videos"
ON public.bizuaulas_videos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage bizuaulas_videos"
ON public.bizuaulas_videos FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bizuaulas_videos_updated_at
BEFORE UPDATE ON public.bizuaulas_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();