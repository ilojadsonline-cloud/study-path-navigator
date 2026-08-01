CREATE OR REPLACE FUNCTION public.get_desempenho_disciplinas(p_user_id uuid DEFAULT auth.uid(), p_curso_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(disciplina text, total bigint, corretas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT p_curso_id IS NULL
        OR p_curso_id = public.curso_pmto_id() AS incluir_legado
  ),
  banco AS (
    SELECT q.disciplina AS disc,
           count(*)::bigint AS total,
           count(*) FILTER (WHERE r.correta)::bigint AS corretas
    FROM public.respostas_usuario r
    JOIN public.questoes q ON q.id = r.questao_id
    CROSS JOIN cfg
    WHERE r.user_id = p_user_id
      AND (p_curso_id IS NULL OR q.curso_id = p_curso_id OR (q.curso_id IS NULL AND cfg.incluir_legado))
    GROUP BY q.disciplina
  ),
  sim_single AS (
    SELECT s.disciplina AS disc,
           sum(s.total)::bigint AS total,
           sum(s.acertos)::bigint AS corretas
    FROM public.simulados s
    CROSS JOIN cfg
    WHERE s.user_id = p_user_id
      AND s.finalizado = true
      AND s.disciplina IS NOT NULL
      AND position('|' IN s.disciplina) = 0
      AND lower(trim(s.disciplina)) <> 'todas as disciplinas'
      AND (p_curso_id IS NULL OR s.curso_id = p_curso_id OR (s.curso_id IS NULL AND cfg.incluir_legado))
    GROUP BY s.disciplina
  ),
  semanal AS (
    SELECT ssq.disciplina AS disc,
           count(*)::bigint AS total,
           count(*) FILTER (
             WHERE ssq.anulada = true
                OR ((t.respostas ->> ssq.id::text) IS NOT NULL
                    AND (t.respostas ->> ssq.id::text)::int = ssq.gabarito)
           )::bigint AS corretas
    FROM public.simulado_semanal_tentativas t
    JOIN public.simulado_semanal_questoes ssq ON ssq.simulado_id = t.simulado_id
    JOIN public.simulados_semanais ss ON ss.id = t.simulado_id
    CROSS JOIN cfg
    WHERE t.user_id = p_user_id
      AND t.status = 'finished'
      AND (p_curso_id IS NULL OR ss.curso_id = p_curso_id OR (ss.curso_id IS NULL AND cfg.incluir_legado))
    GROUP BY ssq.disciplina
  ),
  unioned AS (
    SELECT disc, total, corretas FROM banco
    UNION ALL SELECT disc, total, corretas FROM sim_single
    UNION ALL SELECT disc, total, corretas FROM semanal
  )
  SELECT disc AS disciplina,
         sum(total)::bigint AS total,
         sum(corretas)::bigint AS corretas
  FROM unioned
  WHERE disc IS NOT NULL AND trim(disc) <> ''
  GROUP BY disc
  ORDER BY disc;
$function$;