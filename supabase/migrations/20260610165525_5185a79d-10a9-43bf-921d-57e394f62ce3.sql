-- Corrige disciplinas com espaços extras no banco
UPDATE public.questoes SET disciplina = TRIM(disciplina) WHERE disciplina != TRIM(disciplina);

-- Atualiza a função list_disciplinas para usar TRIM e evitar duplicatas por espaço
CREATE OR REPLACE FUNCTION public.list_disciplinas()
RETURNS TABLE(disciplina text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT TRIM(disciplina) FROM public.questoes ORDER BY TRIM(disciplina);
$$;