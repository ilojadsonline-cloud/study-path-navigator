
-- ============ SIMULADO SEMANAL (weekly exam with ranking) ============

-- 1) Weekly exam meta
CREATE TABLE public.simulados_semanais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  duracao_minutos integer NOT NULL DEFAULT 240,
  valor_questao numeric NOT NULL DEFAULT 2.0,
  total_questoes integer NOT NULL DEFAULT 50,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.simulados_semanais TO authenticated;
GRANT ALL ON public.simulados_semanais TO service_role;
ALTER TABLE public.simulados_semanais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view weekly exams"
  ON public.simulados_semanais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage weekly exams"
  ON public.simulados_semanais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Weekly exam questions (gabarito hidden from regular users; only admins read directly)
CREATE TABLE public.simulado_semanal_questoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulado_id uuid NOT NULL REFERENCES public.simulados_semanais(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  disciplina text NOT NULL,
  assunto text,
  dificuldade text NOT NULL DEFAULT 'Médio',
  enunciado text NOT NULL,
  alt_a text NOT NULL,
  alt_b text NOT NULL,
  alt_c text NOT NULL,
  alt_d text NOT NULL,
  alt_e text NOT NULL,
  gabarito integer NOT NULL,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ssq_simulado ON public.simulado_semanal_questoes(simulado_id, ordem);
GRANT ALL ON public.simulado_semanal_questoes TO service_role;
ALTER TABLE public.simulado_semanal_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage weekly exam questions"
  ON public.simulado_semanal_questoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Attempts (1 per user per exam). Writes happen via edge function (service role).
CREATE TABLE public.simulado_semanal_tentativas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulado_id uuid NOT NULL REFERENCES public.simulados_semanais(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  acertos integer NOT NULL DEFAULT 0,
  pontuacao numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (simulado_id, user_id)
);
CREATE INDEX idx_sst_simulado ON public.simulado_semanal_tentativas(simulado_id);
GRANT SELECT ON public.simulado_semanal_tentativas TO authenticated;
GRANT ALL ON public.simulado_semanal_tentativas TO service_role;
ALTER TABLE public.simulado_semanal_tentativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attempts"
  ON public.simulado_semanal_tentativas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all attempts"
  ON public.simulado_semanal_tentativas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Ranking function (respects show_in_ranking privacy; always returns user_id for self-highlight)
CREATE OR REPLACE FUNCTION public.get_simulado_semanal_ranking(p_simulado_id uuid)
RETURNS TABLE(
  user_id uuid,
  nome text,
  pontuacao numeric,
  acertos integer,
  total integer,
  finished_at timestamptz,
  duracao_segundos integer,
  posicao bigint,
  situacao text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH total_q AS (
    SELECT count(*)::int AS n FROM public.simulado_semanal_questoes q WHERE q.simulado_id = p_simulado_id
  ),
  base AS (
    SELECT
      t.user_id,
      CASE WHEN COALESCE(p.show_in_ranking, false) THEN COALESCE(p.nome, 'Participante')
           ELSE 'Participante anônimo' END AS nome,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_simulado_semanal_ranking(uuid) TO authenticated;
