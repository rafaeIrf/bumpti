-- =============================================================================
-- Migration: Refactor eligibility logic into shared helper
-- =============================================================================
-- Extracts the 8-filter eligibility matrix into a reusable table-returning
-- function `get_eligible_users_at_place`. Both `get_eligible_active_users_count`
-- and `get_vibe_check_data` now call this helper instead of duplicating filters.
-- =============================================================================

-- ── 1. Shared helper: returns eligible user rows ────────────────────────────
CREATE OR REPLACE FUNCTION get_eligible_users_at_place(
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
    SELECT up.user_id, up.entry_type::text, up.entered_at
    FROM user_presences up
    WHERE up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      -- Exclude self
      AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
      -- Exclude blocked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_blocks b 
        WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
           OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
      ))
      -- Exclude disliked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'dislike'
          AND (
            (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
            OR 
            (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
          )
      ))
      -- Exclude users with pending likes
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'like'
          AND ui.from_user_id = requesting_user_id 
          AND ui.to_user_id = up.user_id
      ))
      -- Exclude active matched users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_matches um
        WHERE um.status = 'active'
          AND (
            (um.user_a = requesting_user_id AND um.user_b = up.user_id)
            OR 
            (um.user_a = up.user_id AND um.user_b = requesting_user_id)
          )
      ))
      -- BIDIRECTIONAL gender preference RULE 1: Target must want MY gender (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE profile_connect_with.user_id = up.user_id)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles rp ON rp.id = requesting_user_id
          WHERE pcw.user_id = up.user_id
            AND pcw.gender_id = rp.gender_id
        )
      )
      -- BIDIRECTIONAL gender preference RULE 2: I must want TARGET's gender (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE profile_connect_with.user_id = requesting_user_id)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles tp ON tp.id = up.user_id
          WHERE pcw.user_id = requesting_user_id
            AND pcw.gender_id = tp.gender_id
        )
      )
      -- BIDIRECTIONAL age filter: target must be in MY age range
      AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.birthdate IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
      ))
      -- BIDIRECTIONAL age filter: I must be in TARGET's age range
      AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
               OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
      ))
      -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified, only count verified
      AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.verification_status = 'verified'
      ))
      -- TRUST CIRCLE FILTER RULE 2: If target has filter_only_verified, hide from unverified
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.filter_only_verified = true
          AND (req_verification_status IS NULL OR req_verification_status != 'verified')
      ));
END;
$$;

GRANT EXECUTE ON FUNCTION get_eligible_users_at_place(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_eligible_users_at_place IS
'Shared helper: returns eligible active users at a place applying the full
8-filter eligibility matrix (blocks, dislikes, likes, matches, bidirectional
gender, bidirectional age, trust circle). Used by get_eligible_active_users_count
and get_vibe_check_data.';


-- ── 2. Refactor get_eligible_active_users_count → thin wrapper ──────────────
CREATE OR REPLACE FUNCTION get_eligible_active_users_count(
  target_place_id uuid,
  requesting_user_id uuid
) RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) FROM get_eligible_users_at_place(target_place_id, requesting_user_id);
$$;


-- ── 3. get_vibe_check_data (with date filter) ──────────────────────────────
-- Drop old 2-param overload; vibe-check is always called with a date
DROP FUNCTION IF EXISTS get_vibe_check_data(uuid, uuid);

CREATE OR REPLACE FUNCTION get_vibe_check_data(
  target_place_id uuid,
  requesting_user_id uuid,
  target_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_planning_count bigint;
  v_total_day_planning_count bigint;
  v_planning_count bigint;
  v_recent_count bigint;
  v_matches_going bigint;
  v_common_interests jsonb;
BEGIN
  -- Total planning count (no date filter) — shows overall interest in the place (preference-filtered)
  SELECT COUNT(DISTINCT e.user_id) FILTER (WHERE e.entry_type = 'planning')
  INTO v_total_planning_count
  FROM get_eligible_users_at_place(target_place_id, requesting_user_id) e;

  -- Total day planning count (date-filtered but NO preference filter) — general activity
  SELECT COUNT(DISTINCT up.user_id)
  INTO v_total_day_planning_count
  FROM user_presences up
  WHERE up.place_id = target_place_id
    AND up.active = true
    AND up.ended_at IS NULL
    AND up.expires_at > NOW()
    AND up.entry_type = 'planning'
    AND up.planned_for = target_date
    AND up.user_id != requesting_user_id
    -- Exclude blocked users (bidirectional)
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id)
         OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
    );

  -- Date-filtered counts (preference-filtered via get_eligible_users_at_place)
  SELECT
    COUNT(DISTINCT e.user_id) FILTER (WHERE e.entry_type = 'planning'),
    COUNT(DISTINCT e.user_id) FILTER (WHERE e.entered_at >= NOW() - INTERVAL '3 hours'),
    COUNT(DISTINCT e.user_id) FILTER (WHERE EXISTS (
      SELECT 1 FROM user_matches um
      WHERE um.status = 'active'
        AND (
          (um.user_a = requesting_user_id AND um.user_b = e.user_id)
          OR
          (um.user_a = e.user_id AND um.user_b = requesting_user_id)
        )
    ))
  INTO v_planning_count, v_recent_count, v_matches_going
  FROM get_eligible_users_at_place(target_place_id, requesting_user_id) e
  WHERE EXISTS (
    SELECT 1 FROM user_presences up
    WHERE up.user_id = e.user_id
      AND up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND up.planned_for = target_date
  );

  -- Common interests (top 3), also date-filtered
  SELECT COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  INTO v_common_interests
  FROM (
    SELECT i.key, COUNT(*) AS count
    FROM (
      SELECT DISTINCT e2.user_id
      FROM get_eligible_users_at_place(target_place_id, requesting_user_id) e2
      WHERE EXISTS (
        SELECT 1 FROM user_presences up
        WHERE up.user_id = e2.user_id
          AND up.place_id = target_place_id
          AND up.active = true
          AND up.ended_at IS NULL
          AND up.expires_at > NOW()
          AND up.planned_for = target_date
      )
    ) du
    JOIN profile_interests pi_them ON pi_them.profile_id = du.user_id
    JOIN profile_interests pi_me   ON pi_me.interest_id = pi_them.interest_id
                                   AND pi_me.profile_id = requesting_user_id
    JOIN interests i ON i.id = pi_them.interest_id
    GROUP BY i.key
    ORDER BY count DESC
    LIMIT 3
  ) sub;

  RETURN jsonb_build_object(
    'total_planning_count', v_total_planning_count,
    'total_day_planning_count', v_total_day_planning_count,
    'planning_count', v_planning_count,
    'recent_count',   v_recent_count,
    'common_interests', v_common_interests,
    'matches_going',  v_matches_going
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_vibe_check_data(uuid, uuid, date) TO authenticated, anon;

COMMENT ON FUNCTION get_vibe_check_data(uuid, uuid, date) IS
'Returns social-proof data for the Vibe Check Dashboard, filtered by target_date.
total_planning_count is unfiltered (all dates, preference-filtered).
total_day_planning_count is date-filtered but NOT preference-filtered (general activity).
planning_count is date-filtered AND preference-filtered (compatible users).
Returns: total_planning_count, total_day_planning_count, planning_count, recent_count, common_interests (top 3), matches_going.';

