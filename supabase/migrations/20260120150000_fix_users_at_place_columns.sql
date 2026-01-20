-- =============================================================================
-- Migration: Fix get_available_users_at_place with correct JOINs
-- =============================================================================
-- intentions comes from profile_intentions + intention_options
-- photos comes from profile_photos

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
    -- Get active presences at this place
    SELECT 
      up.user_id AS u_id,
      up.entered_at AS u_entered_at,
      up.expires_at AS u_expires_at
    FROM user_presences up
    WHERE up.place_id = p_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND up.user_id != viewer_id
  ),
  viewer_profile AS (
    SELECT gender_id FROM profiles WHERE id = viewer_id
  ),
  eligible_users AS (
    SELECT ap.*
    FROM active_presences ap
    -- Exclude blocked users (bidirectional)
    WHERE NOT EXISTS (
      SELECT 1 FROM user_blocks b 
      WHERE (b.blocker_id = viewer_id AND b.blocked_id = ap.u_id) 
         OR (b.blocker_id = ap.u_id AND b.blocked_id = viewer_id)
    )
    -- Exclude users I disliked or liked
    AND NOT EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = viewer_id
        AND ui.to_user_id = ap.u_id
        AND (ui.action = 'dislike' OR ui.action = 'like')
    )
    -- Exclude users who disliked me
    AND NOT EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = ap.u_id
        AND ui.to_user_id = viewer_id
        AND ui.action = 'dislike'
    )
    -- Exclude active matches
    AND NOT EXISTS (
      SELECT 1 FROM user_matches um
      WHERE um.status = 'active'
        AND (
          (um.user_a = viewer_id AND um.user_b = ap.u_id)
          OR (um.user_a = ap.u_id AND um.user_b = viewer_id)
        )
    )
    -- Gender preference filter
    AND EXISTS (
      SELECT 1 FROM profile_connect_with pcw, viewer_profile vp
      WHERE pcw.user_id = ap.u_id
        AND pcw.gender_id = vp.gender_id
    )
  )
  SELECT
    eu.u_id AS user_id,
    p.name,
    date_part('year', age(p.birthdate))::int AS age,
    p.bio,
    -- Aggregate intentions from profile_intentions + intention_options
    COALESCE(intent.intentions, ARRAY[]::text[]) AS intentions,
    -- Aggregate photos from profile_photos
    COALESCE(photo.photos, ARRAY[]::text[]) AS photos,
    eu.u_entered_at AS entered_at,
    eu.u_expires_at AS expires_at,
    p.job_title,
    p.company_name,
    p.height_cm,
    zs.key AS zodiac_sign,
    el.key AS education_level,
    rs.key AS relationship_status,
    sh.key AS smoking_habit,
    COALESCE(fav.places, ARRAY[]::text[]) AS favorite_places,
    COALESCE(lang.langs, ARRAY[]::text[]) AS languages
  FROM eligible_users eu
  JOIN profiles p ON p.id = eu.u_id
  LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
  LEFT JOIN education_levels el ON el.id = p.education_id
  LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
  LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id
  -- Aggregate intentions
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT io.key) AS intentions
    FROM profile_intentions pi
    JOIN intention_options io ON io.id = pi.option_id
    WHERE pi.user_id = eu.u_id
  ) intent ON true
  -- Aggregate photos
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT pp.url) AS photos
    FROM profile_photos pp
    WHERE pp.user_id = eu.u_id
  ) photo ON true
  -- Aggregate favorite places
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT pfp.place_id::text) AS places
    FROM profile_favorite_places pfp
    WHERE pfp.user_id = eu.u_id
  ) fav ON true
  -- Aggregate languages
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT l.key) AS langs
    FROM profile_languages pl
    JOIN languages l ON l.id = pl.language_id
    WHERE pl.user_id = eu.u_id
  ) lang ON true
  WHERE
    -- Invisible mode check (show if they liked me)
    p.is_invisible = false
    OR EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = eu.u_id
        AND ui.to_user_id = viewer_id
        AND ui.action = 'like'
        AND ui.action_expires_at > NOW()
    )
  ORDER BY 
    -- Prioritize users who liked me
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = eu.u_id
          AND ui.to_user_id = viewer_id
          AND ui.action = 'like'
          AND ui.action_expires_at > NOW()
      ) THEN 0
      ELSE 1
    END,
    eu.u_entered_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_users_at_place(uuid, uuid) TO authenticated, anon;
