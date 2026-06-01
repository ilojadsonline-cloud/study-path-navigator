-- Função 1: analisa duplicatas/similares DENTRO de uma única disciplina (somente leitura, rápida)
CREATE OR REPLACE FUNCTION public.dedup_disciplina_preview(
  p_disciplina text,
  p_threshold_enun real DEFAULT 0.82,
  p_threshold_alts real DEFAULT 0.78
)
RETURNS TABLE(
  dup_id bigint,
  keep_id bigint,
  sim_enun real,
  sim_alts real,
  dup_enun text,
  keep_enun text
)
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

  -- limite de tempo generoso por statement, mas escopo é só 1 disciplina
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

-- Função 2: exclui (soft-delete) as questões escolhidas pelos IDs, com cópia de segurança
CREATE OR REPLACE FUNCTION public.excluir_questoes_por_ids(p_ids bigint[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- snapshot antes de alterar
  INSERT INTO public.question_versions(questao_id, snapshot, change_reason, changed_by)
  SELECT q.id, to_jsonb(q.*), 'dedup manual: removida pelo admin', auth.uid()
  FROM public.questoes q
  WHERE q.id = ANY(p_ids)
    AND q.audit_status <> 'deleted';

  UPDATE public.questoes
     SET audit_status = 'deleted',
         audit_status_updated_at = now()
   WHERE id = ANY(p_ids)
     AND audit_status <> 'deleted';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dedup_disciplina_preview(text, real, real) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_questoes_por_ids(bigint[]) TO authenticated;