CREATE OR REPLACE FUNCTION public.list_disciplinas()
RETURNS TABLE(disciplina text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT disciplina FROM public.questoes ORDER BY disciplina;
$$;