
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  payment_id text,
  amount numeric,
  payment_type text,
  gateway text NOT NULL DEFAULT 'mercadopago',
  status text,
  action_taken text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_email ON public.payment_events (lower(email));
CREATE INDEX IF NOT EXISTS idx_payment_events_processed_at ON public.payment_events (processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events (payment_id);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payment_events" ON public.payment_events;
CREATE POLICY "Admins manage payment_events"
  ON public.payment_events
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
