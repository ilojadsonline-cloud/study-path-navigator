ALTER TABLE public.simulados_semanais
  ADD COLUMN IF NOT EXISTS revisao_liberada boolean NOT NULL DEFAULT false;