-- Add last_source column to track what last modified credits
ALTER TABLE public.user_checkin_credits
  ADD COLUMN IF NOT EXISTS last_source text;
