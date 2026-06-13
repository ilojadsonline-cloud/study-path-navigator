ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

DROP POLICY IF EXISTS "Anyone authenticated can read notifications" ON public.notifications;
CREATE POLICY "Read global own or admin notifications" ON public.notifications
FOR SELECT TO authenticated
USING (user_id IS NULL OR user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;