-- Add telefone and last_seen_at columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;