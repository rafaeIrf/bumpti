-- =============================================================================
-- Migration: Add Trust Circle filter to get_available_users_at_place
-- =============================================================================
-- Adds filter_only_verified support for bidirectional verified-only matching:
-- - If viewer has filter enabled, only show verified profiles
-- - If target has filter enabled, hide from unverified viewers
-- =============================================================================

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
    -- Cache viewer's profile for preference matching and Trust Circle filter
    SELECT 
      gender_id,
      filter_only_verified,
      verification_status
    FROM profiles 
    WHERE id = viewer_id
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
    -- Exclude active matches
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
  CROSS JOIN viewer_profile vp
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
    (
      p.is_invisible = false
      OR EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = eu.user_id
          AND ui.to_user_id = viewer_id
          AND ui.action = 'like'
          AND ui.action_expires_at > NOW()
      )
    )
    -- TRUST CIRCLE FILTER: Bidirectional verified-only filtering
    -- RULE 1: If viewer has filter_only_verified = true, only show verified profiles
    AND (
      vp.filter_only_verified = false
      OR vp.filter_only_verified IS NULL
      OR p.verification_status = 'verified'
    )
    -- RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
    AND (
      p.filter_only_verified = false
      OR p.filter_only_verified IS NULL
      OR vp.verification_status = 'verified'
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
Filters: blocks, dislikes, likes, active matches, gender preferences, invisible mode, Trust Circle.
Optimized with CTEs to avoid view dependency and reduce repeated scans.';
