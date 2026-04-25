-- Unicidade de email em profiles (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

-- Unicidade de CPF em trial_usage para reforçar anti-fraude
CREATE UNIQUE INDEX IF NOT EXISTS trial_usage_cpf_unique
  ON public.trial_usage (cpf)
  WHERE cpf IS NOT NULL;

-- Endurece has_used_trial para também considerar profiles
CREATE OR REPLACE FUNCTION public.has_used_trial(p_email text, p_cpf text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.trial_usage
    WHERE LOWER(email) = LOWER(p_email)
       OR (p_cpf IS NOT NULL AND cpf = p_cpf)
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email)
       OR (p_cpf IS NOT NULL AND cpf = p_cpf)
  );
$function$;