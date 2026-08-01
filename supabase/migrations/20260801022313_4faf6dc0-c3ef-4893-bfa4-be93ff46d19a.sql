CREATE OR REPLACE FUNCTION public.get_simulado_semanal_ranking(p_simulado_id uuid)
 RETURNS TABLE(user_id uuid, nome text, pontuacao numeric, acertos integer, total integer, finished_at timestamp with time zone, duracao_segundos integer, posicao bigint, situacao text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH regras AS (
    SELECT
      CASE WHEN c.slug = 'cbmto' THEN 50 ELSE 60 END::numeric AS nota_minima,
      CASE WHEN c.slug = 'cbmto' THEN 15 ELSE 100 END::bigint AS vagas
    FROM public.simulados_semanais s
    LEFT JOIN public.cursos c ON c.id = s.curso_id
    WHERE s.id = p_simulado_id
  ),
  total_q AS (
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
  SELECT r.user_id, r.nome, r.pontuacao, r.acertos, r.total, r.finished_at, r.duracao_segundos, r.posicao,
    CASE
      WHEN r.pontuacao >= g.nota_minima AND r.posicao <= g.vagas THEN 'classificado'
      WHEN r.pontuacao >= g.nota_minima THEN 'aprovado_nao_classificado'
      ELSE 'reprovado'
    END AS situacao
  FROM ranked r
  CROSS JOIN (SELECT COALESCE((SELECT nota_minima FROM regras), 60) AS nota_minima,
                     COALESCE((SELECT vagas FROM regras), 100) AS vagas) g
  ORDER BY r.posicao, r.finished_at;
$function$;