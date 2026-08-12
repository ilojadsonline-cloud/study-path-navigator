ALTER FUNCTION public.enforce_cbmto_four_alternatives() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.enforce_cbmto_four_alternatives() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_cbmto_four_alternatives() TO service_role;