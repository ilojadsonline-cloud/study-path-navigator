
CREATE TABLE public.simulado_semanal_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados_semanais(id) ON DELETE CASCADE,
  questao_id uuid NOT NULL REFERENCES public.simulado_semanal_questoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  argumento text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  decisao_admin text,
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (questao_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.simulado_semanal_recursos TO authenticated;
GRANT ALL ON public.simulado_semanal_recursos TO service_role;

ALTER TABLE public.simulado_semanal_recursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno vê seus recursos"
  ON public.simulado_semanal_recursos FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Aluno abre seu recurso"
  ON public.simulado_semanal_recursos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aluno edita recurso pendente / Admin decide"
  ON public.simulado_semanal_recursos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = user_id AND status = 'pendente')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = user_id AND status = 'pendente')
  );

CREATE TRIGGER update_simulado_semanal_recursos_updated_at
  BEFORE UPDATE ON public.simulado_semanal_recursos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recursos_simulado ON public.simulado_semanal_recursos(simulado_id, status);
