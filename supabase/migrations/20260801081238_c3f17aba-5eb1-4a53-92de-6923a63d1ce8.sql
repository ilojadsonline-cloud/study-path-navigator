DROP FUNCTION IF EXISTS public.list_disciplinas();

CREATE OR REPLACE FUNCTION public.list_disciplinas(p_curso_id uuid DEFAULT NULL)
RETURNS TABLE(disciplina text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT TRIM(q.disciplina)
  FROM public.questoes q
  WHERE TRIM(q.disciplina) <> 'POP'
    AND (
      p_curso_id IS NULL
      OR q.curso_id = p_curso_id
      OR (q.curso_id IS NULL AND p_curso_id = public.curso_pmto_id())
    )
  ORDER BY TRIM(q.disciplina);
$function$;

CREATE OR REPLACE FUNCTION public.dedup_disciplina_preview(
  p_disciplina text,
  p_threshold_enun real DEFAULT 0.82,
  p_threshold_alts real DEFAULT 0.78,
  p_curso_id uuid DEFAULT NULL
)
RETURNS TABLE(dup_id bigint, keep_id bigint, sim_enun real, sim_alts real, dup_enun text, keep_enun text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  k record;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SET LOCAL statement_timeout = '120s';

  CREATE TEMP TABLE _kept_one (
    id bigint,
    enun text,
    alts text,
    snippet text
  ) ON COMMIT DROP;

  FOR rec IN
    SELECT
      q.id,
      lower(regexp_replace(q.enunciado, '\s+', ' ', 'g')) AS enun,
      lower(regexp_replace(
        coalesce(q.alt_a,'')||' '||coalesce(q.alt_b,'')||' '||coalesce(q.alt_c,'')||' '||
        coalesce(q.alt_d,'')||' '||coalesce(q.alt_e,''), '\s+', ' ', 'g')) AS alts,
      left(q.enunciado, 220) AS snippet,
      CASE q.audit_status
        WHEN 'approved' THEN 0
        WHEN 'admin_resolved' THEN 1
        WHEN 'auto_corrected' THEN 2
        ELSE 3
      END AS prio
    FROM public.questoes q
    WHERE q.disciplina = p_disciplina
      AND q.audit_status IN ('approved','auto_corrected','admin_resolved','pending')
      AND (
        p_curso_id IS NULL
        OR q.curso_id = p_curso_id
        OR (q.curso_id IS NULL AND p_curso_id = public.curso_pmto_id())
      )
    ORDER BY prio, q.id
  LOOP
    SELECT t.id, t.snippet,
           similarity(t.enun, rec.enun) AS se,
           similarity(t.alts, rec.alts) AS sa
      INTO k
    FROM _kept_one t
    WHERE (
        similarity(t.enun, rec.enun) > p_threshold_enun
        OR (similarity(t.enun, rec.enun) > 0.45 AND similarity(t.alts, rec.alts) > p_threshold_alts)
      )
    ORDER BY similarity(t.enun, rec.enun) DESC
    LIMIT 1;

    IF k.id IS NOT NULL THEN
      dup_id := rec.id;
      keep_id := k.id;
      sim_enun := k.se;
      sim_alts := k.sa;
      dup_enun := rec.snippet;
      keep_enun := k.snippet;
      RETURN NEXT;
    ELSE
      INSERT INTO _kept_one VALUES (rec.id, rec.enun, rec.alts, rec.snippet);
    END IF;
  END LOOP;
END;
$function$;