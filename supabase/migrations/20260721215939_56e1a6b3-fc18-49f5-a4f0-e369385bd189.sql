UPDATE auth.users u
SET banned_until = NULL,
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('trial_blocked', false, 'reactivated_at', now()::text)
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = u.id AND ur.role = 'admin'
);