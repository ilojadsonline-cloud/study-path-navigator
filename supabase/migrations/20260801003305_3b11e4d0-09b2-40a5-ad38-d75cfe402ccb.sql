-- Rankings separados por curso (mantendo histórico legado sem curso)
DROP FUNCTION IF EXISTS public.get_ranking(text);
DROP FUNCTION IF EXISTS public.get_top10_ranking();
DROP FUNCTION IF EXISTS public.get_my_ranking_position(text);
DROP FUNCTION IF EXISTS public.get_desempenho_disciplinas(uuid);

CREATE OR REPLACE FUNCTION public.get_ranking(p_period text DEFAULT 'all', p_curso_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, nome text, total_respondidas bigint, total_corretas bigint, taxa_acertos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    p.nome,
    COUNT(r.id) AS total_respondidas,
    COUNT(r.id) FILTER (WHERE r.correta = true) AS total_corretas,
    ROUND(COUNT(r.id) FILTER (WHERE r.correta = true)::numeric / COUNT(r.id) * 100, 1) AS taxa_acertos
  FROM public.profiles p
  INNER JOIN public.respostas_usuario r ON r.user_id = p.user_id
  INNER JOIN public.questoes q ON q.id = r.questao_id
  WHERE p.show_in_ranking = true
    AND (p_curso_id IS NULL OR q.curso_id = p_curso_id OR q.curso_id IS NULL)
    AND (
      p_period = 'all'
      OR (p_period = 'week' AND r.created_at >= now() - interval '7 days')
      OR (p_period = 'month' AND r.created_at >= date_trunc('month', now()))
    )
  GROUP BY p.user_id, p.nome
  HAVING COUNT(r.id) >= 10
  ORDER BY taxa_acertos DESC, total_respondidas DESC
  LIMIT 50;
$function$;

CREATE OR REPLACE FUNCTION public.get_top10_ranking(p_curso_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, nome text, total_respondidas bigint, total_corretas bigint, taxa_acertos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    p.nome,
    COUNT(r.id) AS total_respondidas,
    COUNT(r.id) FILTER (WHERE r.correta = true) AS total_corretas,
    ROUND(COUNT(r.id) FILTER (WHERE r.correta = true)::numeric / COUNT(r.id) * 100, 1) AS taxa_acertos
  FROM public.profiles p
  INNER JOIN public.respostas_usuario r ON r.user_id = p.user_id
  INNER JOIN public.questoes q ON q.id = r.questao_id
  WHERE p.show_in_ranking = true
    AND (p_curso_id IS NULL OR q.curso_id = p_curso_id OR q.curso_id IS NULL)
  GROUP BY p.user_id, p.nome
  HAVING COUNT(r.id) >= 10
  ORDER BY taxa_acertos DESC, total_respondidas DESC
  LIMIT 10;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_ranking_position(p_period text DEFAULT 'all', p_curso_id uuid DEFAULT NULL)
RETURNS TABLE(rank bigint, total_respondidas bigint, total_corretas bigint, taxa_acertos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH stats AS (
    SELECT
      p.user_id,
      COUNT(r.id) AS total_respondidas,
      COUNT(r.id) FILTER (WHERE r.correta = true) AS total_corretas,
      ROUND(COUNT(r.id) FILTER (WHERE r.correta = true)::numeric / COUNT(r.id) * 100, 1) AS taxa_acertos
    FROM public.profiles p
    INNER JOIN public.respostas_usuario r ON r.user_id = p.user_id
    INNER JOIN public.questoes q ON q.id = r.questao_id
    WHERE (p_curso_id IS NULL OR q.curso_id = p_curso_id OR q.curso_id IS NULL)
      AND (
        p_period = 'all'
        OR (p_period = 'week' AND r.created_at >= now() - interval '7 days')
        OR (p_period = 'month' AND r.created_at >= date_trunc('month', now()))
      )
    GROUP BY p.user_id
    HAVING COUNT(r.id) >= 10
  ),
  ranked AS (
    SELECT user_id, total_respondidas, total_corretas, taxa_acertos,
           RANK() OVER (ORDER BY taxa_acertos DESC, total_respondidas DESC) AS rank
    FROM stats
  )
  SELECT rank, total_respondidas, total_corretas, taxa_acertos
  FROM ranked
  WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_desempenho_disciplinas(p_user_id uuid DEFAULT auth.uid(), p_curso_id uuid DEFAULT NULL)
RETURNS TABLE(disciplina text, total bigint, corretas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH banco AS (
    SELECT q.disciplina AS disc,
           count(*)::bigint AS total,
           count(*) FILTER (WHERE r.correta)::bigint AS corretas
    FROM public.respostas_usuario r
    JOIN public.questoes q ON q.id = r.questao_id
    WHERE r.user_id = p_user_id
      AND (p_curso_id IS NULL OR q.curso_id = p_curso_id OR q.curso_id IS NULL)
    GROUP BY q.disciplina
  ),
  sim_single AS (
    SELECT s.disciplina AS disc,
           sum(s.total)::bigint AS total,
           sum(s.acertos)::bigint AS corretas
    FROM public.simulados s
    WHERE s.user_id = p_user_id
      AND s.finalizado = true
      AND s.disciplina IS NOT NULL
      AND position('|' IN s.disciplina) = 0
      AND lower(trim(s.disciplina)) <> 'todas as disciplinas'
      AND (p_curso_id IS NULL OR s.curso_id = p_curso_id OR s.curso_id IS NULL)
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
    WHERE t.user_id = p_user_id
      AND t.status = 'finished'
      AND (p_curso_id IS NULL OR ss.curso_id = p_curso_id OR ss.curso_id IS NULL)
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

REVOKE ALL ON FUNCTION public.get_ranking(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top10_ranking(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_ranking_position(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_desempenho_disciplinas(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top10_ranking(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_ranking_position(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_desempenho_disciplinas(uuid, uuid) TO authenticated, service_role;