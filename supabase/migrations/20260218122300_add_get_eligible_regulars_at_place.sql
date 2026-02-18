-- =============================================================================
-- Migration: Add get_eligible_regulars_at_place RPC
-- =============================================================================
-- Returns "regulars" at a place: users with past check-ins (60 days) or who
-- have favorited the place, applying the same 8-filter eligibility matrix as
-- get_eligible_users_at_place. Active users are EXCLUDED (they show as active).
-- Priority: past_visitor > favorite (DISTINCT ON user_id, ordered by recency).
-- =============================================================================

CREATE OR REPLACE FUNCTION get_eligible_regulars_at_place(
  target_place_id uuid,
  requesting_user_id uuid
)
RETURNS TABLE(user_id uuid, entry_type text, entered_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  req_age_min integer;
  req_age_max integer;
  req_age integer;
  req_filter_verified boolean;
  req_verification_status text;
BEGIN
  -- Get requesting user's age preferences, age, AND verification settings
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      p.age_range_min, 
      p.age_range_max,
      EXTRACT(YEAR FROM AGE(p.birthdate))::integer,
      p.filter_only_verified,
      p.verification_status
    INTO req_age_min, req_age_max, req_age, req_filter_verified, req_verification_status
    FROM profiles p
    WHERE p.id = requesting_user_id;
  END IF;

  RETURN QUERY
    -- DISTINCT ON ensures each user appears only once, prioritized by source
    SELECT DISTINCT ON (candidates.uid)
      candidates.uid,
      candidates.etype,
      candidates.eat
    FROM (
      -- Source 1: Past check-ins (last 60 days, inactive presences)
      SELECT
        up.user_id AS uid,
        'past_visitor'::text AS etype,
        up.entered_at AS eat,
        1 AS priority  -- higher priority
      FROM user_presences up
      WHERE up.place_id = target_place_id
        AND up.active = false
        AND up.entered_at > NOW() - INTERVAL '60 days'
        -- Exclude users who are currently active at this place
        AND NOT EXISTS (
          SELECT 1 FROM user_presences active_up
          WHERE active_up.user_id = up.user_id
            AND active_up.place_id = target_place_id
            AND active_up.active = true
            AND active_up.ended_at IS NULL
            AND active_up.expires_at > NOW()
        )

      UNION ALL

      -- Source 2: Users who favorited this place
      SELECT
        pfp.user_id AS uid,
        'favorite'::text AS etype,
        pfp.created_at AS eat,
        2 AS priority  -- lower priority (past_visitor wins)
      FROM profile_favorite_places pfp
      WHERE pfp.place_id = target_place_id
        -- Exclude users who are currently active at this place
        AND NOT EXISTS (
          SELECT 1 FROM user_presences active_up
          WHERE active_up.user_id = pfp.user_id
            AND active_up.place_id = target_place_id
            AND active_up.active = true
            AND active_up.ended_at IS NULL
            AND active_up.expires_at > NOW()
        )
    ) candidates
    -- ── 8-filter eligibility matrix (same as get_eligible_users_at_place) ──
    WHERE
      -- Exclude self
      (requesting_user_id IS NULL OR candidates.uid != requesting_user_id)
      -- Exclude blocked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_blocks b 
        WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = candidates.uid) 
           OR (b.blocker_id = candidates.uid AND b.blocked_id = requesting_user_id)
      ))
      -- Exclude disliked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'dislike'
          AND (
            (ui.from_user_id = requesting_user_id AND ui.to_user_id = candidates.uid) 
            OR 
            (ui.from_user_id = candidates.uid AND ui.to_user_id = requesting_user_id)
          )
      ))
      -- Exclude users with pending likes
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'like'
          AND ui.from_user_id = requesting_user_id 
          AND ui.to_user_id = candidates.uid
      ))
      -- Exclude active matched users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_matches um
        WHERE um.status = 'active'
          AND (
            (um.user_a = requesting_user_id AND um.user_b = candidates.uid)
            OR 
            (um.user_a = candidates.uid AND um.user_b = requesting_user_id)
          )
      ))
      -- BIDIRECTIONAL gender preference RULE 1: Target must want MY gender (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE profile_connect_with.user_id = candidates.uid)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles rp ON rp.id = requesting_user_id
          WHERE pcw.user_id = candidates.uid
            AND pcw.gender_id = rp.gender_id
        )
      )
      -- BIDIRECTIONAL gender preference RULE 2: I must want TARGET's gender (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE profile_connect_with.user_id = requesting_user_id)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles tp ON tp.id = candidates.uid
          WHERE pcw.user_id = requesting_user_id
            AND pcw.gender_id = tp.gender_id
        )
      )
      -- BIDIRECTIONAL age filter: target must be in MY age range
      AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = candidates.uid
          AND target_profile.birthdate IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
      ))
      -- BIDIRECTIONAL age filter: I must be in TARGET's age range
      AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = candidates.uid
          AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
               OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
      ))
      -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified, only count verified
      AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = candidates.uid
          AND target_profile.verification_status = 'verified'
      ))
      -- TRUST CIRCLE FILTER RULE 2: If target has filter_only_verified, hide from unverified
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = candidates.uid
          AND target_profile.filter_only_verified = true
          AND (req_verification_status IS NULL OR req_verification_status != 'verified')
      ))
    ORDER BY candidates.uid, candidates.priority ASC, candidates.eat DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_eligible_regulars_at_place(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_eligible_regulars_at_place IS
'Returns regulars at a place: users with past check-ins (60 days) or who
favorited the place. Applies the full 8-filter eligibility matrix. Active users
are excluded (they appear via get_eligible_users_at_place). Priority order:
past_visitor > favorite. Uses SECURITY DEFINER to cross-query profile_favorite_places
despite user-scoped RLS.';


-- =============================================================================
-- Helper: get_regulars_count_at_place
-- =============================================================================
-- Lightweight count-only variant for places-nearby to avoid transferring full rows.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_regulars_count_at_place(
  target_place_id uuid,
  requesting_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM get_eligible_regulars_at_place(target_place_id, requesting_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_regulars_count_at_place(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_regulars_count_at_place IS
'Lightweight count wrapper around get_eligible_regulars_at_place for use in
places-nearby responses where only the count is needed.';
