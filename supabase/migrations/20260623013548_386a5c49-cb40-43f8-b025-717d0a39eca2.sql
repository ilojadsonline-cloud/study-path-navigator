CREATE OR REPLACE FUNCTION public.get_simulado_semanal_ranking(p_simulado_id uuid)
 RETURNS TABLE(user_id uuid, nome text, pontuacao numeric, acertos integer, total integer, finished_at timestamp with time zone, duracao_segundos integer, posicao bigint, situacao text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH total_q AS (
    SELECT count(*)::int AS n FROM public.simulado_semanal_questoes q WHERE q.simulado_id = p_simulado_id
  ),
  base AS (
    SELECT
      t.user_id,
      COALESCE(NULLIF(TRIM(p.nome), ''), 'Participante') AS nome,
      t.pontuacao,
      t.acertos,
      (SELECT n FROM total_q) AS total,
      t.finished_at,
      EXTRACT(EPOCH FROM (t.finished_at - t.started_at))::int AS duracao_segundos
    FROM public.simulado_semanal_tentativas t
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE t.simulado_id = p_simulado_id AND t.status = 'finished'
  ),
  ranked AS (
    SELECT *, RANK() OVER (ORDER BY pontuacao DESC, finished_at ASC) AS posicao
    FROM base
  )
  SELECT user_id, nome, pontuacao, acertos, total, finished_at, duracao_segundos, posicao,
    CASE
      WHEN pontuacao >= 60 AND posicao <= 50 THEN 'classificado'
      WHEN pontuacao >= 60 THEN 'aprovado_nao_classificado'
      ELSE 'reprovado'
    END AS situacao
  FROM ranked
  ORDER BY posicao, finished_at;
$function$;