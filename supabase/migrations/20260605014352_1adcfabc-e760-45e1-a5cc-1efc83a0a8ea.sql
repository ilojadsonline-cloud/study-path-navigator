
CREATE OR REPLACE FUNCTION public.get_ranking(p_period text DEFAULT 'all')
RETURNS TABLE(user_id uuid, nome text, total_respondidas bigint, total_corretas bigint, taxa_acertos numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    p.nome,
    COUNT(r.id) AS total_respondidas,
    COUNT(r.id) FILTER (WHERE r.correta = true) AS total_corretas,
    ROUND(COUNT(r.id) FILTER (WHERE r.correta = true)::numeric / COUNT(r.id) * 100, 1) AS taxa_acertos
  FROM public.profiles p
  INNER JOIN public.respostas_usuario r ON r.user_id = p.user_id
  WHERE p.show_in_ranking = true
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

CREATE OR REPLACE FUNCTION public.get_my_ranking_position(p_period text DEFAULT 'all')
RETURNS TABLE(rank bigint, total_respondidas bigint, total_corretas bigint, taxa_acertos numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH stats AS (
    SELECT
      p.user_id,
      COUNT(r.id) AS total_respondidas,
      COUNT(r.id) FILTER (WHERE r.correta = true) AS total_corretas,
      ROUND(COUNT(r.id) FILTER (WHERE r.correta = true)::numeric / COUNT(r.id) * 100, 1) AS taxa_acertos
    FROM public.profiles p
    INNER JOIN public.respostas_usuario r ON r.user_id = p.user_id
    WHERE (
      p_period = 'all'
      OR (p_period = 'week' AND r.created_at >= now() - interval '7 days')
      OR (p_period = 'month' AND r.created_at >= date_trunc('month', now()))
    )
    GROUP BY p.user_id
    HAVING COUNT(r.id) >= 10
  ),
  ranked AS (
    SELECT
      user_id, total_respondidas, total_corretas, taxa_acertos,
      RANK() OVER (ORDER BY taxa_acertos DESC, total_respondidas DESC) AS rank
    FROM stats
  )
  SELECT rank, total_respondidas, total_corretas, taxa_acertos
  FROM ranked
  WHERE user_id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.get_ranking(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_ranking_position(text) TO authenticated;
