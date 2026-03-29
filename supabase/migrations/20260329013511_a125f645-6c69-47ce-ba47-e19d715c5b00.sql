-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can read questoes" ON public.questoes;

-- Create a new policy restricting reads to authenticated users only
CREATE POLICY "Authenticated users can read questoes"
ON public.questoes
FOR SELECT
TO authenticated
USING (true);