
-- Add show_in_ranking column to profiles (default false for privacy)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_in_ranking boolean NOT NULL DEFAULT false;

-- Create a security definer function to get top 10 ranking
-- Uses SECURITY DEFINER to bypass RLS and aggregate across all opted-in users
CREATE OR REPLACE FUNCTION public.get_top10_ranking()
RETURNS TABLE(
  user_id uuid,
  nome text,
  total_respondidas bigint,
  total_corretas bigint,
  taxa_acertos numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.nome,
    COUNT(r.id) AS total_respondidas,
    COUNT(r.id) FILTER (WHERE r.correta = true) AS total_corretas,
    ROUND(COUNT(r.id) FILTER (WHERE r.correta = true)::numeric / COUNT(r.id) * 100, 1) AS taxa_acertos
  FROM public.profiles p
  INNER JOIN public.respostas_usuario r ON r.user_id = p.user_id
  WHERE p.show_in_ranking = true
  GROUP BY p.user_id, p.nome
  HAVING COUNT(r.id) >= 10
  ORDER BY taxa_acertos DESC, total_respondidas DESC
  LIMIT 10;
$$;
