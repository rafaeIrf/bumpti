-- Create plan_invites table for plan sharing via invite links
-- This migration was applied remotely and is being retroactively tracked locally.

CREATE TABLE IF NOT EXISTS public.plan_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  presence_id uuid        NOT NULL REFERENCES public.user_presences(id) ON DELETE CASCADE,
  creator_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_plan_invites_token ON public.plan_invites USING btree (token);

-- Enable RLS
ALTER TABLE public.plan_invites ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can create own invites"
  ON public.plan_invites
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can read own invites"
  ON public.plan_invites
  FOR SELECT
  USING (auth.uid() = creator_id);
