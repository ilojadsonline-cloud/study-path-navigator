CREATE OR REPLACE FUNCTION public.dedup_questoes(
  p_dry_run boolean DEFAULT true,
  p_threshold_enun real DEFAULT 0.82,
  p_threshold_alts real DEFAULT 0.78
)
RETURNS TABLE(
  removed_id bigint,
  kept_id bigint,
  disciplina text,
  sim_enun real,
  sim_alts real,
  removed_enun text,
  kept_enun text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  k record;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  CREATE TEMP TABLE _kept (
    id bigint,
    disciplina text,
    enun text,
    alts text,
    snippet text
  ) ON COMMIT DROP;

  FOR rec IN
    SELECT
      q.id,
      q.disciplina AS disc,
      lower(regexp_replace(q.enunciado, '\s+', ' ', 'g')) AS enun,
      lower(regexp_replace(
        coalesce(q.alt_a,'')||' '||coalesce(q.alt_b,'')||' '||coalesce(q.alt_c,'')||' '||
        coalesce(q.alt_d,'')||' '||coalesce(q.alt_e,''), '\s+', ' ', 'g')) AS alts,
      left(q.enunciado, 160) AS snippet,
      CASE q.audit_status
        WHEN 'approved' THEN 0
        WHEN 'admin_resolved' THEN 1
        WHEN 'auto_corrected' THEN 2
        ELSE 3
      END AS prio
    FROM public.questoes q
    WHERE q.audit_status IN ('approved','auto_corrected','admin_resolved','pending')
    ORDER BY q.disciplina, prio, q.id
  LOOP
    SELECT t.id, t.snippet,
           similarity(t.enun, rec.enun) AS se,
           similarity(t.alts, rec.alts) AS sa
      INTO k
    FROM _kept t
    WHERE t.disciplina = rec.disc
      AND (
        similarity(t.enun, rec.enun) > p_threshold_enun
        OR (similarity(t.enun, rec.enun) > 0.45 AND similarity(t.alts, rec.alts) > p_threshold_alts)
      )
    ORDER BY similarity(t.enun, rec.enun) DESC
    LIMIT 1;

    IF k.id IS NOT NULL THEN
      removed_id := rec.id;
      kept_id := k.id;
      disciplina := rec.disc;
      sim_enun := k.se;
      sim_alts := k.sa;
      removed_enun := rec.snippet;
      kept_enun := k.snippet;
      RETURN NEXT;

      IF NOT p_dry_run THEN
        INSERT INTO public.question_versions(questao_id, snapshot, change_reason, changed_by)
        SELECT q.id, to_jsonb(q.*), 'dedup: duplicata/similar de #'||k.id, auth.uid()
        FROM public.questoes q WHERE q.id = rec.id;

        UPDATE public.questoes
           SET audit_status = 'deleted',
               audit_status_updated_at = now()
         WHERE id = rec.id;
      END IF;
    ELSE
      INSERT INTO _kept VALUES (rec.id, rec.disc, rec.enun, rec.alts, rec.snippet);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dedup_questoes(boolean, real, real) TO authenticated;