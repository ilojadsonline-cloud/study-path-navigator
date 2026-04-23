-- Tabela permanente de uso de trial — sobrevive à exclusão de auth.users
CREATE TABLE public.trial_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  cpf TEXT,
  user_id UUID,
  provider TEXT NOT NULL DEFAULT 'stripe',
  stripe_customer_id TEXT,
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ,
  converted_to_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para lookup rápido
CREATE UNIQUE INDEX idx_trial_usage_email_lower ON public.trial_usage (LOWER(email));
CREATE INDEX idx_trial_usage_cpf ON public.trial_usage (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_trial_usage_user_id ON public.trial_usage (user_id) WHERE user_id IS NOT NULL;

-- RLS
ALTER TABLE public.trial_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read trial_usage"
ON public.trial_usage FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage trial_usage"
ON public.trial_usage FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC pública (security definer) para checar se CPF/email já usou trial
CREATE OR REPLACE FUNCTION public.has_used_trial(p_email TEXT, p_cpf TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trial_usage
    WHERE LOWER(email) = LOWER(p_email)
       OR (p_cpf IS NOT NULL AND cpf = p_cpf)
  );
$$;

-- RPC para usuário autenticado verificar próprio status de trial
CREATE OR REPLACE FUNCTION public.get_my_trial_status()
RETURNS TABLE (
  has_trial BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  converted_to_paid BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    true AS has_trial,
    tu.trial_ends_at,
    tu.converted_to_paid
  FROM public.trial_usage tu
  JOIN auth.users u ON LOWER(u.email) = LOWER(tu.email)
  WHERE u.id = auth.uid()
  ORDER BY tu.trial_started_at DESC
  LIMIT 1;
$$;