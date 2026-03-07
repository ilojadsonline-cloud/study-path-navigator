-- Admin can read all profiles
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all respostas
CREATE POLICY "Admins can read all respostas"
ON public.respostas_usuario
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete respostas
CREATE POLICY "Admins can delete respostas"
ON public.respostas_usuario
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete questoes
CREATE POLICY "Admins can delete questoes"
ON public.questoes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all study_sessions
CREATE POLICY "Admins can read all study_sessions"
ON public.study_sessions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all simulados
CREATE POLICY "Admins can read all simulados"
ON public.simulados
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));