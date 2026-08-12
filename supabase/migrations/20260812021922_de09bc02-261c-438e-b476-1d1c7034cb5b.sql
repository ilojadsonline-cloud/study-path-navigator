CREATE OR REPLACE FUNCTION public.enforce_cbmto_four_alternatives()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curso_slug text;
BEGIN
  IF NEW.curso_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO v_curso_slug
  FROM public.cursos
  WHERE id = NEW.curso_id;

  IF v_curso_slug = 'cbmto' THEN
    NEW.alt_e := '';
    IF NEW.gabarito NOT BETWEEN 0 AND 3 THEN
      RAISE EXCEPTION 'Questões do CHOA CBMTO aceitam somente gabarito entre A e D (0 a 3)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cbmto_four_alternatives_trigger ON public.questoes;
CREATE TRIGGER enforce_cbmto_four_alternatives_trigger
BEFORE INSERT OR UPDATE OF curso_id, alt_e, gabarito
ON public.questoes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cbmto_four_alternatives();