-- =============================================================================
-- Migration: Add is_eligible_match helper + get_shared_favorite_users RPC
-- =============================================================================
-- 1. Shared helper: is_eligible_match(viewer_id, candidate_id) → boolean
--    Encapsulates the 8-filter eligibility matrix used across all discovery RPCs.
-- 2. New RPC: get_shared_favorite_users — returns users sharing ≥ N favorites.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Shared helper: is_eligible_match
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns TRUE if viewer↔candidate passes all 8 eligibility filters:
--   1. Not self
--   2. No blocks (bidirectional)
--   3. No dislikes (bidirectional)
--   4. No pending like (viewer → candidate)
--   5. No active match (bidirectional)
--   6. Gender preference (bidirectional)
--   7. Age range (bidirectional)
--   8. Verification trust circle (bidirectional)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_eligible_match(
  p_viewer_id    uuid,
  p_candidate_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_age_min integer;
  v_age_max integer;
  v_age integer;
  v_filter_verified boolean;
  v_verification_status text;
  v_gender_id integer;
  -- candidate vars
  c_age integer;
  c_age_min integer;
  c_age_max integer;
  c_filter_verified boolean;
  c_verification_status text;
  c_gender_id integer;
  c_birthdate date;
BEGIN
  -- Self check
  IF p_viewer_id = p_candidate_id THEN RETURN FALSE; END IF;

  -- Load viewer profile
  SELECT
    p.age_range_min,
    p.age_range_max,
    EXTRACT(YEAR FROM AGE(p.birthdate))::integer,
    p.filter_only_verified,
    p.verification_status,
    p.gender_id
  INTO v_age_min, v_age_max, v_age, v_filter_verified, v_verification_status, v_gender_id
  FROM profiles p WHERE p.id = p_viewer_id;

  -- Load candidate profile
  SELECT
    p.birthdate,
    EXTRACT(YEAR FROM AGE(p.birthdate))::integer,
    p.age_range_min,
    p.age_range_max,
    p.filter_only_verified,
    p.verification_status,
    p.gender_id
  INTO c_birthdate, c_age, c_age_min, c_age_max, c_filter_verified, c_verification_status, c_gender_id
  FROM profiles p WHERE p.id = p_candidate_id;

  -- 1. Blocks (bidirectional)
  IF EXISTS (
    SELECT 1 FROM user_blocks b
    WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p_candidate_id)
       OR (b.blocker_id = p_candidate_id AND b.blocked_id = p_viewer_id)
  ) THEN RETURN FALSE; END IF;

  -- 2. Dislikes (bidirectional)
  IF EXISTS (
    SELECT 1 FROM user_interactions ui
    WHERE ui.action = 'dislike'
      AND (
        (ui.from_user_id = p_viewer_id AND ui.to_user_id = p_candidate_id)
        OR (ui.from_user_id = p_candidate_id AND ui.to_user_id = p_viewer_id)
      )
  ) THEN RETURN FALSE; END IF;

  -- 3. Pending like (viewer → candidate)
  IF EXISTS (
    SELECT 1 FROM user_interactions ui
    WHERE ui.action = 'like'
      AND ui.from_user_id = p_viewer_id
      AND ui.to_user_id = p_candidate_id
  ) THEN RETURN FALSE; END IF;

  -- 4. Active match (bidirectional)
  IF EXISTS (
    SELECT 1 FROM user_matches um
    WHERE um.status = 'active'
      AND (
        (um.user_a = p_viewer_id AND um.user_b = p_candidate_id)
        OR (um.user_a = p_candidate_id AND um.user_b = p_viewer_id)
      )
  ) THEN RETURN FALSE; END IF;

  -- 5. Gender preference: candidate must want MY gender
  IF EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = p_candidate_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM profile_connect_with pcw
      WHERE pcw.user_id = p_candidate_id AND pcw.gender_id = v_gender_id
    ) THEN RETURN FALSE; END IF;
  END IF;

  -- 6. Gender preference: I must want CANDIDATE's gender
  IF EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = p_viewer_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM profile_connect_with pcw
      WHERE pcw.user_id = p_viewer_id AND pcw.gender_id = c_gender_id
    ) THEN RETURN FALSE; END IF;
  END IF;

  -- 7a. Age: candidate must be in MY range
  IF v_age_min IS NOT NULL AND v_age_max IS NOT NULL AND c_birthdate IS NOT NULL THEN
    IF c_age < v_age_min OR c_age > v_age_max THEN RETURN FALSE; END IF;
  END IF;

  -- 7b. Age: I must be in CANDIDATE's range
  IF c_age_min IS NOT NULL AND c_age_max IS NOT NULL AND v_age IS NOT NULL THEN
    IF v_age < c_age_min OR v_age > c_age_max THEN RETURN FALSE; END IF;
  END IF;

  -- 8a. Trust circle: if viewer filters verified-only, candidate must be verified
  IF (v_filter_verified = true) AND (c_verification_status IS NULL OR c_verification_status != 'verified') THEN
    RETURN FALSE;
  END IF;

  -- 8b. Trust circle: if candidate filters verified-only, viewer must be verified
  IF (c_filter_verified = true) AND (v_verification_status IS NULL OR v_verification_status != 'verified') THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION is_eligible_match(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION is_eligible_match IS
'Shared eligibility check: returns TRUE if viewer↔candidate passes all 8 filters
(self, blocks, dislikes, pending likes, matches, gender, age, verification).
Used by get_shared_favorite_users and can replace inline filters in other RPCs.';


-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_shared_favorite_users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_shared_favorite_users(
  p_viewer_id  uuid,
  p_min_shared integer DEFAULT 1,
  p_limit      integer DEFAULT 20,
  p_offset     integer DEFAULT 0
)
RETURNS TABLE (
  other_user_id               uuid,
  shared_count                integer,
  shared_place_ids            uuid[],
  shared_place_names          text[],
  other_name                  text,
  other_age                   integer,
  other_photos                text[],
  other_verification_status   text,
  other_bio                   text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
    SELECT
      shared.uid                                            AS other_user_id,
      shared.cnt                                            AS shared_count,
      shared.pids                                           AS shared_place_ids,
      shared.pnames                                         AS shared_place_names,
      tp.name                                               AS other_name,
      EXTRACT(YEAR FROM AGE(tp.birthdate))::integer         AS other_age,
      COALESCE(ARRAY(
        SELECT pp.url FROM profile_photos pp
        WHERE pp.user_id = shared.uid
        ORDER BY pp.position ASC
      ), '{}'::text[])                                      AS other_photos,
      tp.verification_status                                AS other_verification_status,
      tp.bio                                                AS other_bio
    FROM (
      SELECT
        pfp_other.user_id                                 AS uid,
        COUNT(*)::integer                                 AS cnt,
        ARRAY_AGG(pfp_other.place_id)                     AS pids,
        ARRAY_AGG(pl.name)                                AS pnames
      FROM profile_favorite_places pfp_me
      INNER JOIN profile_favorite_places pfp_other
        ON pfp_other.place_id = pfp_me.place_id
        AND pfp_other.user_id != p_viewer_id
      INNER JOIN places pl
        ON pl.id = pfp_me.place_id
      WHERE pfp_me.user_id = p_viewer_id
      GROUP BY pfp_other.user_id
      HAVING COUNT(*) >= p_min_shared
    ) shared
    INNER JOIN profiles tp ON tp.id = shared.uid
    WHERE is_eligible_match(p_viewer_id, shared.uid)
    ORDER BY shared.cnt DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_favorite_users(uuid, integer, integer, integer) TO authenticated, anon;

COMMENT ON FUNCTION get_shared_favorite_users IS
'Returns users who share at least p_min_shared favorite places with the viewer.
Includes full profile data for card rendering. Uses the shared is_eligible_match()
helper for the 8-filter eligibility matrix. Used by Discover feed "Mesmos Lugares".';
