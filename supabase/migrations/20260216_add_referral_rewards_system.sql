-- Migration: Referral rewards system
-- Track invite joins, define milestones, and award checkin+ credits to plan creators.

-- 1. Add accepted_count to plan_invites
ALTER TABLE public.plan_invites
  ADD COLUMN IF NOT EXISTS accepted_count integer DEFAULT 0 NOT NULL;

-- 2. Log each join event (prevents double-counting)
CREATE TABLE IF NOT EXISTS public.invite_join_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id   uuid NOT NULL REFERENCES public.plan_invites(id) ON DELETE CASCADE,
  joiner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invite_id, joiner_id)
);

ALTER TABLE public.invite_join_log ENABLE ROW LEVEL SECURITY;

-- 3. Milestones config table
CREATE TABLE IF NOT EXISTS public.referral_milestones (
  threshold   integer PRIMARY KEY,
  credits     integer NOT NULL
);

ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;

INSERT INTO public.referral_milestones (threshold, credits) VALUES
  (3, 1), (7, 2), (15, 3)
ON CONFLICT (threshold) DO NOTHING;

-- 4. Track which milestones a user already claimed
CREATE TABLE IF NOT EXISTS public.referral_milestone_claims (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold  integer NOT NULL REFERENCES public.referral_milestones(threshold),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, threshold)
);

ALTER TABLE public.referral_milestone_claims ENABLE ROW LEVEL SECURITY;

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_invite_join_log_invite ON public.invite_join_log(invite_id);
CREATE INDEX IF NOT EXISTS idx_invite_join_log_joiner ON public.invite_join_log(joiner_id);

-- 6. Grant service_role access (edge functions use service_role)
GRANT ALL ON TABLE public.invite_join_log TO service_role;
GRANT ALL ON TABLE public.referral_milestones TO service_role;
GRANT ALL ON TABLE public.referral_milestone_claims TO service_role;
GRANT SELECT ON TABLE public.referral_milestones TO authenticated;
