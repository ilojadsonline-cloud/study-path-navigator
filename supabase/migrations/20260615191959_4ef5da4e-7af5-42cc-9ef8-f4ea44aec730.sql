-- 1) Lista de militares autorizados (planilha oficial) — somente admin
CREATE TABLE public.pop_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula text,
  rg text,
  cpf text,
  nome_completo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pop_allowlist TO authenticated;
GRANT ALL ON public.pop_allowlist TO service_role;
ALTER TABLE public.pop_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pop_allowlist"
  ON public.pop_allowlist FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE INDEX idx_pop_allowlist_cpf ON public.pop_allowlist (cpf);

CREATE TRIGGER update_pop_allowlist_updated_at
  BEFORE UPDATE ON public.pop_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Liberações manuais por usuário — admin gerencia; usuário lê a própria
CREATE TABLE public.pop_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pop_access TO authenticated;
GRANT ALL ON public.pop_access TO service_role;
ALTER TABLE public.pop_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pop_access"
  ON public.pop_access FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own pop_access"
  ON public.pop_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3) Função de verificação de acesso ao POP
CREATE OR REPLACE FUNCTION public.has_pop_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.pop_access pa WHERE pa.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.pop_allowlist al
        ON regexp_replace(coalesce(al.cpf,''), '\D', '', 'g') = regexp_replace(coalesce(p.cpf,''), '\D', '', 'g')
      WHERE p.user_id = auth.uid()
        AND length(regexp_replace(coalesce(p.cpf,''), '\D', '', 'g')) >= 11
    );
$$;

-- 4) Protege as questões do POP: só quem tem acesso lê
DROP POLICY "Authenticated users can read questoes" ON public.questoes;
CREATE POLICY "Authenticated users can read questoes"
  ON public.questoes FOR SELECT TO authenticated
  USING (
    TRIM(disciplina) <> 'POP' OR public.has_pop_access()
  );

-- 5) Remove POP das listagens públicas de disciplinas
CREATE OR REPLACE FUNCTION public.list_disciplinas()
RETURNS TABLE(disciplina text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT TRIM(q.disciplina)
  FROM public.questoes q
  WHERE TRIM(q.disciplina) <> 'POP'
  ORDER BY TRIM(q.disciplina);
$$;