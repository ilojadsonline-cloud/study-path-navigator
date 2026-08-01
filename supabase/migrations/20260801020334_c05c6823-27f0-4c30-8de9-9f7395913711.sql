-- Garante que assinantes já ativos mantenham o acesso ao CHOA PMTO até o fim da vigência do plano
WITH fim AS (
  SELECT u.id AS user_id,
         GREATEST(
           COALESCE((u.raw_app_meta_data->>'access_expires_at')::timestamptz, '-infinity'::timestamptz),
           COALESCE((SELECT max(tu.trial_ends_at) FROM public.trial_usage tu
                     WHERE lower(tu.email) = lower(u.email) AND tu.converted_to_paid), '-infinity'::timestamptz)
         ) AS expira
  FROM auth.users u
)
UPDATE public.acessos_curso ac
SET expires_at = f.expira,
    ativo = true
FROM fim f
WHERE ac.user_id = f.user_id
  AND ac.curso_id = public.curso_pmto_id()
  AND ac.expires_at IS NULL
  AND f.expira > now();