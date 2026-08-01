REVOKE EXECUTE ON FUNCTION public.curso_pmto_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_curso_access(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curso_pmto_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_curso_access(text, uuid) TO authenticated, service_role;