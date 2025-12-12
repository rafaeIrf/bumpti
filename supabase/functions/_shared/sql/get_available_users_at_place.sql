-- RPC function to get available (eligible) users at a specific place
-- Used by: get-active-users-at-place edge function
-- 
-- This function filters users based on:
-- - Excludes the viewer themselves
-- - Excludes users the viewer has disliked
-- - Excludes users the viewer has liked (but like hasn't expired yet)
-- - Excludes users who disliked the viewer
-- - Excludes users with active matches with the viewer
-- - Excludes users the viewer has blocked
-- - Excludes users who have blocked the viewer
-- - Does NOT exclude unmatched users (allows re-matching)
--
-- Returns: Full user data for eligible users at the specified place

DROP FUNCTION IF EXISTS get_available_users_at_place(text, uuid);

create or replace function get_available_users_at_place(
  p_place_id text,
  viewer_id uuid
)
returns table (
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
language sql
stable
as $$
  SELECT
    a.user_id,
    p.name,
    date_part('year', age(p.birthdate))::int AS age,
    p.bio,
    a.intentions,
    a.photos,
    a.entered_at,
    a.expires_at,
    p.job_title,
    p.company_name,
    p.height_cm,
    zs.key AS zodiac_sign,
    el.key AS education_level,
    rs.key AS relationship_status,
    sh.key AS smoking_habit,
    
    -- favorite places
    COALESCE(ARRAY(
      SELECT DISTINCT pfp.place_id
      FROM profile_favorite_places pfp
      WHERE pfp.user_id = p.id
      AND pfp.place_id IS NOT NULL
    ), '{}') AS favorite_places,

    -- languages
    COALESCE(ARRAY(
      SELECT DISTINCT l.key
      FROM profile_languages pl
      JOIN languages l ON l.id = pl.language_id
      WHERE pl.user_id = p.id
    ), '{}') AS languages

  FROM active_users_per_place a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
  LEFT JOIN education_levels el ON el.id = p.education_id
  LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
  LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id

  WHERE a.place_id = p_place_id
    AND a.user_id != viewer_id

    -- Exclude users I disliked or liked (and like hasn't expired)
    AND NOT EXISTS (
      SELECT 1
      FROM user_interactions ui
      WHERE ui.from_user_id = viewer_id
        AND ui.to_user_id = a.user_id
        AND (
          ui.action = 'dislike'
          OR (ui.action = 'like' AND ui.action_expires_at > now())
        )
    )

    -- Exclude users who disliked me
    AND NOT EXISTS (
      SELECT 1
      FROM user_interactions ui
      WHERE ui.from_user_id = a.user_id
        AND ui.to_user_id = viewer_id
        AND ui.action = 'dislike'
    )

    -- Exclude users with active matches (can see unmatched users)
    AND NOT EXISTS (
      SELECT 1
      FROM user_matches um
      WHERE um.status = 'active'
        AND (
          (um.user_a = viewer_id AND um.user_b = a.user_id)
          OR (um.user_b = viewer_id AND um.user_a = a.user_id)
        )
    )

    -- Exclude users blocked by viewer
    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks ub
      WHERE ub.blocker_id = viewer_id
        AND ub.blocked_id = a.user_id
    )

    -- Exclude users who blocked the viewer
    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks ub
      WHERE ub.blocker_id = a.user_id
        AND ub.blocked_id = viewer_id
    )

  ORDER BY 
    -- Prioritize users who liked me (like hasn't expired)
    CASE 
      WHEN EXISTS (
        SELECT 1
        FROM user_interactions ui
        WHERE ui.from_user_id = a.user_id
          AND ui.to_user_id = viewer_id
          AND ui.action = 'like'
          AND ui.action_expires_at > now()
      ) THEN 0
      ELSE 1
    END,
    -- Then order by most recent entry
    a.entered_at DESC;
$$;
