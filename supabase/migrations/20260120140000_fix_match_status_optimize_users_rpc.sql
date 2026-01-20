-- =============================================================================
-- Migration: Fix match status and optimize get_available_users_at_place
-- =============================================================================
-- Fixes:
-- 1. get_eligible_active_users_count: status='matched' → status='active'
-- 2. get_available_users_at_place: Remove view dependency, optimize with CTE
-- =============================================================================

-- =============================================================================
-- PART 1: Fix get_eligible_active_users_count status check
-- =============================================================================
CREATE OR REPLACE FUNCTION get_eligible_active_users_count(
  target_place_id uuid,
  requesting_user_id uuid
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
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
      -- Exclude users with pending likes (unidirectional - only requesting user's likes)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'like'
          AND ui.from_user_id = requesting_user_id 
          AND ui.to_user_id = up.user_id
      ))
      -- Exclude active matched users (bidirectional) - FIXED: status='active'
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_matches um
        WHERE um.status = 'active'
          AND (
            (um.user_a = requesting_user_id AND um.user_b = up.user_id)
            OR 
            (um.user_a = up.user_id AND um.user_b = requesting_user_id)
          )
      ))
      -- Require matching gender preference
      AND (requesting_user_id IS NULL OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      ))
  );
END;
$$;

-- =============================================================================
-- PART 2: Optimized get_available_users_at_place (no view dependency)
-- =============================================================================
-- Performance optimizations:
-- 1. Replace view with direct user_presences query
-- 2. Use CTE for active users to reduce repeated scans
-- 3. Consolidate correlated ARRAY subqueries into lateral joins
-- 4. Use composite index hints via query structure

DROP FUNCTION IF EXISTS get_available_users_at_place(uuid, uuid);

CREATE OR REPLACE FUNCTION get_available_users_at_place(
  p_place_id uuid,
  viewer_id uuid
)
RETURNS TABLE (
  user_id uuid,
  name text,
  age int,
  bio text,
  intentions text[],
  photos text[],
  entered_at timestamptz,
  expires_at timestamptz,
  job_title text,
  company_name text,
  height_cm int,
  zodiac_sign text,
  education_level text,
  relationship_status text,
  smoking_habit text,
  favorite_places text[],
  languages text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH active_presences AS (
    -- Get active presences at this place (uses idx on place_id, active, expires_at)
    SELECT 
      up.user_id,
      up.intentions,
      up.photos,
      up.entered_at,
      up.expires_at
    FROM user_presences up
    WHERE up.place_id = p_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND up.user_id != viewer_id
  ),
  viewer_profile AS (
    -- Cache viewer's gender for preference matching
    SELECT gender_id FROM profiles WHERE id = viewer_id
  ),
  eligible_users AS (
    SELECT ap.*
    FROM active_presences ap
    -- Exclude blocked users (bidirectional)
    WHERE NOT EXISTS (
      SELECT 1 FROM user_blocks b 
      WHERE (b.blocker_id = viewer_id AND b.blocked_id = ap.user_id) 
         OR (b.blocker_id = ap.user_id AND b.blocked_id = viewer_id)
    )
    -- Exclude users I disliked or liked
    AND NOT EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = viewer_id
        AND ui.to_user_id = ap.user_id
        AND (ui.action = 'dislike' OR ui.action = 'like')
    )
    -- Exclude users who disliked me
    AND NOT EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = ap.user_id
        AND ui.to_user_id = viewer_id
        AND ui.action = 'dislike'
    )
    -- Exclude active matches - FIXED: status='active'
    AND NOT EXISTS (
      SELECT 1 FROM user_matches um
      WHERE um.status = 'active'
        AND (
          (um.user_a = viewer_id AND um.user_b = ap.user_id)
          OR (um.user_a = ap.user_id AND um.user_b = viewer_id)
        )
    )
    -- Gender preference filter
    AND EXISTS (
      SELECT 1 FROM profile_connect_with pcw, viewer_profile vp
      WHERE pcw.user_id = ap.user_id
        AND pcw.gender_id = vp.gender_id
    )
  )
  SELECT
    eu.user_id,
    p.name,
    date_part('year', age(p.birthdate))::int AS age,
    p.bio,
    eu.intentions,
    eu.photos,
    eu.entered_at,
    eu.expires_at,
    p.job_title,
    p.company_name,
    p.height_cm,
    zs.key AS zodiac_sign,
    el.key AS education_level,
    rs.key AS relationship_status,
    sh.key AS smoking_habit,
    COALESCE(fav.places, ARRAY[]::text[]) AS favorite_places,
    COALESCE(lang.languages, ARRAY[]::text[]) AS languages
  FROM eligible_users eu
  JOIN profiles p ON p.id = eu.user_id
  LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
  LEFT JOIN education_levels el ON el.id = p.education_id
  LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
  LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id
  -- Aggregate favorite places
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT pfp.place_id::text) AS places
    FROM profile_favorite_places pfp
    WHERE pfp.user_id = p.id
  ) fav ON true
  -- Aggregate languages
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT l.key) AS languages
    FROM profile_languages pl
    JOIN languages l ON l.id = pl.language_id
    WHERE pl.user_id = p.id
  ) lang ON true
  WHERE
    -- Invisible mode check (show if they liked me)
    p.is_invisible = false
    OR EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = eu.user_id
        AND ui.to_user_id = viewer_id
        AND ui.action = 'like'
        AND ui.action_expires_at > NOW()
    )
  ORDER BY 
    -- Prioritize users who liked me
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = eu.user_id
          AND ui.to_user_id = viewer_id
          AND ui.action = 'like'
          AND ui.action_expires_at > NOW()
      ) THEN 0
      ELSE 1
    END,
    eu.entered_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_users_at_place(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_available_users_at_place IS 
'Returns eligible users at a place for the viewer.
Filters: blocks, dislikes, likes, active matches, gender preferences, invisible mode.
Optimized with CTEs to avoid view dependency and reduce repeated scans.';

-- =============================================================================
-- PART 3: Drop the now-unused view (optional cleanup)
-- =============================================================================
-- DROP VIEW IF EXISTS active_users_per_place;
