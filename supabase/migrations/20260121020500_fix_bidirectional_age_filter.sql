-- Fix age filter to be bidirectional
-- Users should only see each other if BOTH match each other's age preferences

-- PART 1: Update get_active_users_with_avatars
CREATE OR REPLACE FUNCTION get_active_users_with_avatars(
  target_place_id uuid,
  requesting_user_id uuid DEFAULT NULL,
  max_avatars integer DEFAULT 5
)
RETURNS active_users_info
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result active_users_info;
  avatar_data user_avatar[];
  req_age_min integer;
  req_age_max integer;
  req_age integer;
BEGIN
  -- Get requesting user's age preferences AND their own age
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      age_range_min, 
      age_range_max,
      EXTRACT(YEAR FROM AGE(birthdate))::integer
    INTO req_age_min, req_age_max, req_age
    FROM profiles
    WHERE id = requesting_user_id;
  END IF;

  -- Get the count of eligible active users
  SELECT COUNT(*) INTO result.count
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
    -- Require matching gender preference
    AND (requesting_user_id IS NULL OR EXISTS (
      SELECT 1 FROM profile_connect_with pcw
      INNER JOIN profiles rp ON rp.id = requesting_user_id
      WHERE pcw.user_id = up.user_id
        AND pcw.gender_id = rp.gender_id
    ))
    -- BIDIRECTIONAL age filter: target user must be in MY age range
    AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.birthdate IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
        AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
    ))
    -- BIDIRECTIONAL age filter: I must be in TARGET user's age range
    AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
             OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
    ));

  -- Get avatar URLs with user_id for up to max_avatars eligible users
  SELECT ARRAY(
    SELECT ROW(up.user_id, pp.url)::user_avatar
    FROM user_presences up
    INNER JOIN profile_photos pp ON pp.user_id = up.user_id AND pp.position = 0
    WHERE up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND pp.url IS NOT NULL
      -- Same eligibility filters
      AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_blocks b 
        WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
           OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
      ))
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'dislike'
          AND (
            (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
            OR 
            (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
          )
      ))
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'like'
          AND ui.from_user_id = requesting_user_id 
          AND ui.to_user_id = up.user_id
      ))
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_matches um
        WHERE um.status = 'active'
          AND (
            (um.user_a = requesting_user_id AND um.user_b = up.user_id)
            OR 
            (um.user_a = up.user_id AND um.user_b = requesting_user_id)
          )
      ))
      AND (requesting_user_id IS NULL OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      ))
      -- BIDIRECTIONAL age filter
      AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.birthdate IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
      ))
      AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
               OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
      ))
    ORDER BY up.entered_at DESC
    LIMIT max_avatars
  ) INTO avatar_data;

  result.avatars := avatar_data;
  
  RETURN result;
END;
$$;

-- PART 2: Update get_eligible_active_users_count
CREATE OR REPLACE FUNCTION get_eligible_active_users_count(
  target_place_id uuid,
  requesting_user_id uuid
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req_age_min integer;
  req_age_max integer;
  req_age integer;
BEGIN
  -- Get requesting user's age preferences AND their own age
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      age_range_min, 
      age_range_max,
      EXTRACT(YEAR FROM AGE(birthdate))::integer
    INTO req_age_min, req_age_max, req_age
    FROM profiles
    WHERE id = requesting_user_id;
  END IF;

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
      -- Require matching gender preference
      AND (requesting_user_id IS NULL OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      ))
      -- BIDIRECTIONAL age filter: target user must be in MY age range
      AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.birthdate IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
      ))
      -- BIDIRECTIONAL age filter: I must be in TARGET user's age range
      AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
               OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
      ))
  );
END;
$$;

-- PART 3: Update get_available_users_at_place
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
  languages text[],
  entry_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  viewer_age_min integer;
  viewer_age_max integer;
  viewer_age integer;
BEGIN
  -- Get viewer's age preferences AND their own age
  SELECT 
    age_range_min, 
    age_range_max,
    EXTRACT(YEAR FROM AGE(birthdate))::integer
  INTO viewer_age_min, viewer_age_max, viewer_age
  FROM profiles
  WHERE id = viewer_id;

  RETURN QUERY
  WITH active_presences AS (
    -- Get active presences at this place
    SELECT 
      up.user_id AS u_id,
      up.entered_at AS u_entered_at,
      up.expires_at AS u_expires_at,
      up.entry_type AS u_entry_type
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
    -- BIDIRECTIONAL age filter: target user must be in MY age range
    AND (viewer_age_min IS NULL OR viewer_age_max IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_p
      WHERE target_p.id = ap.u_id
        AND target_p.birthdate IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(target_p.birthdate)) >= viewer_age_min
        AND EXTRACT(YEAR FROM AGE(target_p.birthdate)) <= viewer_age_max
    ))
    -- BIDIRECTIONAL age filter: I must be in TARGET user's age range
    AND (viewer_age IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_p
      WHERE target_p.id = ap.u_id
        AND (target_p.age_range_min IS NULL OR target_p.age_range_max IS NULL
             OR (viewer_age >= target_p.age_range_min AND viewer_age <= target_p.age_range_max))
    ))
  )
  SELECT
    eu.u_id AS user_id,
    p.name,
    date_part('year', age(p.birthdate))::int AS age,
    p.bio,
    COALESCE(intent.intentions, ARRAY[]::text[]) AS intentions,
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
    COALESCE(lang.langs, ARRAY[]::text[]) AS languages,
    COALESCE(eu.u_entry_type, 'physical')::text AS entry_type
  FROM eligible_users eu
  JOIN profiles p ON p.id = eu.u_id
  LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
  LEFT JOIN education_levels el ON el.id = p.education_id
  LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
  LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT io.key) AS intentions
    FROM profile_intentions pi
    JOIN intention_options io ON io.id = pi.option_id
    WHERE pi.user_id = eu.u_id
  ) intent ON true
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(pp.url ORDER BY pp.position ASC) AS photos
    FROM profile_photos pp
    WHERE pp.user_id = eu.u_id
  ) photo ON true
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT pfp.place_id::text) AS places
    FROM profile_favorite_places pfp
    WHERE pfp.user_id = eu.u_id
  ) fav ON true
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT l.key) AS langs
    FROM profile_languages pl
    JOIN languages l ON l.id = pl.language_id
    WHERE pl.user_id = eu.u_id
  ) lang ON true
  WHERE
    p.is_invisible = false
    OR EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = eu.u_id
        AND ui.to_user_id = viewer_id
        AND ui.action = 'like'
        AND ui.action_expires_at > NOW()
    )
  ORDER BY 
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
