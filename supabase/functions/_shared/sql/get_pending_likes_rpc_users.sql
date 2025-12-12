DROP FUNCTION IF EXISTS get_pending_likes_users(uuid);

CREATE OR REPLACE FUNCTION get_pending_likes_users(viewer_id uuid)
RETURNS TABLE (
  user_id uuid,
  name text,
  bio text,
  age integer,
  gender text,
  zodiac_sign text,
  education_level text,
  relationship_status text,
  height_cm integer,
  city_name text,
  state_name text,
  smoking_habit text,
  job_title text,
  company_name text,
  favorite_places text[],
  languages text[],
  photos text[],
  place_id text
)
LANGUAGE sql
STABLE
AS $$
WITH pending_users AS (
  SELECT DISTINCT ON (ui.from_user_id)
    ui.from_user_id AS user_id,
    ui.place_id,
    ui.created_at
  FROM user_interactions ui
  WHERE ui.to_user_id = viewer_id
    AND ui.action = 'like'
    AND (ui.action_expires_at IS NULL OR ui.action_expires_at > NOW())

    AND NOT EXISTS (
      SELECT 1
      FROM user_interactions ui2
      WHERE ui2.from_user_id = viewer_id
        AND ui2.to_user_id = ui.from_user_id
        AND ui2.action IN ('like', 'dislike')
        AND (ui2.action_expires_at IS NULL OR ui2.action_expires_at > NOW())
    )

    AND NOT EXISTS (
      SELECT 1
      FROM user_matches m
      WHERE (
        (m.user_a = viewer_id AND m.user_b = ui.from_user_id)
        OR
        (m.user_b = viewer_id AND m.user_a = ui.from_user_id)
      )
      AND m.status IN ('active', 'unmatched')
    )

    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks ub
      WHERE
        (ub.blocker_id = viewer_id AND ub.blocked_id = ui.from_user_id)
        OR
        (ub.blocker_id = ui.from_user_id AND ub.blocked_id = viewer_id)
    )
  ORDER BY ui.from_user_id, ui.created_at DESC
)

SELECT
  p.id AS user_id,
  p.name,
  p.bio,

  date_part('year', age(p.birthdate))::int AS age,

  go.key AS gender,
  zs.key AS zodiac_sign,
  el.key AS education_level,
  rs.key AS relationship_status,
  p.height_cm,

  p.city_name,
  p.city_state AS state_name,

  sh.key AS smoking_habit,
  p.job_title,
  p.company_name,

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
  ), '{}') AS languages,

  -- photos
  COALESCE(ARRAY(
    SELECT pp.url
    FROM profile_photos pp
    WHERE pp.user_id = p.id
    ORDER BY pp.position ASC
  ), '{}') AS photos,

  -- place_id (from CTE)
  pu.place_id

FROM pending_users pu
JOIN profiles p ON p.id = pu.user_id

LEFT JOIN gender_options go ON go.id = p.gender_id
LEFT JOIN education_levels el ON el.id = p.education_id
LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id

ORDER BY pu.created_at DESC;
$$;
