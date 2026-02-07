-- 1. Table
CREATE TABLE public.user_encounters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id      uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  encounter_type text NOT NULL DEFAULT 'direct_overlap'
    CHECK (encounter_type IN ('direct_overlap', 'routine_match', 'vibe_match')),
  affinity_score integer NOT NULL DEFAULT 0,
  metadata      jsonb DEFAULT '{}'::jsonb,
  last_encountered_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Canonical pair ordering: always user_a_id < user_b_id
  CONSTRAINT user_encounters_pair_order CHECK (user_a_id < user_b_id),
  -- One encounter per pair per place
  CONSTRAINT user_encounters_unique_pair UNIQUE (user_a_id, user_b_id, place_id)
);

-- 2. Indexes for feed queries
CREATE INDEX idx_encounters_user_a ON public.user_encounters(user_a_id, affinity_score DESC, last_encountered_at DESC);
CREATE INDEX idx_encounters_user_b ON public.user_encounters(user_b_id, affinity_score DESC, last_encountered_at DESC);
CREATE INDEX idx_encounters_place  ON public.user_encounters(place_id);

-- 3. RLS
ALTER TABLE public.user_encounters ENABLE ROW LEVEL SECURITY;

-- Users can read encounters they are part of
CREATE POLICY "Users can view own encounters"
  ON public.user_encounters FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Only service_role can insert/update/delete (via Edge Functions)
CREATE POLICY "Service role manages encounters"
  ON public.user_encounters FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. RPC: get_discover_feed
CREATE OR REPLACE FUNCTION public.get_discover_feed(
  p_viewer_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  encounter_id         uuid,
  other_user_id        uuid,
  place_id             uuid,
  encounter_type       text,
  affinity_score       integer,
  shared_interests_count bigint,
  metadata             jsonb,
  last_encountered_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  viewer_gender_id     integer;
  viewer_verified_only boolean;
  viewer_age_min       integer;
  viewer_age_max       integer;
  viewer_age           integer;
BEGIN
  -- Fetch viewer preferences
  SELECT p.gender_id, p.filter_only_verified, p.age_range_min, p.age_range_max,
         EXTRACT(YEAR FROM AGE(p.birthdate))::integer
  INTO viewer_gender_id, viewer_verified_only, viewer_age_min, viewer_age_max, viewer_age
  FROM profiles p WHERE p.id = p_viewer_id;

  RETURN QUERY
  WITH viewer_encounters AS (
    SELECT
      e.id AS encounter_id,
      CASE WHEN e.user_a_id = p_viewer_id THEN e.user_b_id ELSE e.user_a_id END AS other_user_id,
      e.place_id,
      e.encounter_type,
      e.affinity_score,
      e.metadata,
      e.last_encountered_at
    FROM public.user_encounters e
    WHERE e.user_a_id = p_viewer_id OR e.user_b_id = p_viewer_id
  )
  SELECT
    ve.encounter_id,
    ve.other_user_id,
    ve.place_id,
    ve.encounter_type,
    ve.affinity_score,
    COALESCE(si.cnt, 0) AS shared_interests_count,
    ve.metadata,
    ve.last_encountered_at
  FROM viewer_encounters ve
  JOIN public.profiles p ON p.id = ve.other_user_id
  -- Shared interests (live calculation)
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.profile_interests pi_a
    JOIN public.profile_interests pi_b ON pi_a.interest_id = pi_b.interest_id
    WHERE pi_a.profile_id = p_viewer_id AND pi_b.profile_id = ve.other_user_id
  ) si ON true
  WHERE
    -- 1. Hide invisible users
    p.is_invisible IS NOT TRUE
    -- 2. Hide users the viewer already liked or disliked (non-expired)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_interactions ui
      WHERE ui.from_user_id = p_viewer_id AND ui.to_user_id = ve.other_user_id
        AND ui.action IN ('like', 'dislike')
        AND (ui.action_expires_at IS NULL OR ui.action_expires_at > now())
    )
    -- 3. Hide users who disliked the viewer (bidirectional, non-expired)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_interactions ui
      WHERE ui.from_user_id = ve.other_user_id AND ui.to_user_id = p_viewer_id
        AND ui.action = 'dislike'
        AND (ui.action_expires_at IS NULL OR ui.action_expires_at > now())
    )
    -- 4. Hide blocked users (bidirectional)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = p_viewer_id AND ub.blocked_id = ve.other_user_id)
         OR (ub.blocker_id = ve.other_user_id AND ub.blocked_id = p_viewer_id)
    )
    -- 5. Hide existing matches
    AND NOT EXISTS (
      SELECT 1 FROM public.user_matches m
      WHERE (m.user_a = p_viewer_id AND m.user_b = ve.other_user_id)
         OR (m.user_a = ve.other_user_id AND m.user_b = p_viewer_id)
    )
    -- 6. Gender preference bidirectional
    AND EXISTS (
      SELECT 1 FROM public.profile_connect_with pcw
      WHERE pcw.user_id = p_viewer_id AND pcw.gender_id = p.gender_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profile_connect_with pcw
      WHERE pcw.user_id = ve.other_user_id AND pcw.gender_id = viewer_gender_id
    )
    -- 7. Age range bidirectional
    AND EXTRACT(YEAR FROM AGE(p.birthdate))::integer BETWEEN viewer_age_min AND viewer_age_max
    AND viewer_age BETWEEN p.age_range_min AND p.age_range_max
    -- 8. Verified-only filter (if viewer has it active)
    AND (
      viewer_verified_only = false
      OR p.verification_status = 'verified'
    )
  ORDER BY ve.affinity_score DESC, ve.last_encountered_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
