
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
  entry_type text,
  -- University fields
  university_id uuid,
  university_name text,
  university_name_custom text,
  graduation_year int,
  show_university_on_home boolean,
  -- Planning fields
  planned_for date,
  planned_period text,
  interests text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  viewer_age_min integer;
  viewer_age_max integer;
  viewer_age integer;
  viewer_filter_verified boolean;
  viewer_verification_status text;
BEGIN
  -- Get viewer's age preferences, age, AND verification settings
  SELECT age_range_min, age_range_max, EXTRACT(YEAR FROM AGE(birthdate))::integer,
         filter_only_verified, verification_status
  INTO viewer_age_min, viewer_age_max, viewer_age,
       viewer_filter_verified, viewer_verification_status
  FROM profiles
  WHERE id = viewer_id;

  RETURN QUERY
  WITH active_presences AS (
    -- Get active presences at this place
    SELECT 
      up.user_id AS u_id,
      up.entered_at AS u_entered_at,
      up.expires_at AS u_expires_at,
      up.entry_type AS u_entry_type,
      up.planned_for AS u_planned_for,
      up.planned_period AS u_planned_period
    FROM user_presences up
    WHERE up.place_id = p_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND up.user_id != viewer_id
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
    -- BIDIRECTIONAL gender preference RULE 1: Target user must want to connect with MY gender (NULL-safe)
    AND (
      NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.u_id)
      OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles vp ON vp.id = viewer_id
        WHERE pcw.user_id = ap.u_id
          AND pcw.gender_id = vp.gender_id
      )
    )
    -- BIDIRECTIONAL gender preference RULE 2: I must want to connect with TARGET user's gender (NULL-safe)
    AND (
      NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = viewer_id)
      OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles tp ON tp.id = ap.u_id
        WHERE pcw.user_id = viewer_id
          AND pcw.gender_id = tp.gender_id
      )
    )
    -- Age range filter: target must be in MY range
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
    -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified = true, only show verified profiles
    AND (viewer_filter_verified = false OR viewer_filter_verified IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_p
      WHERE target_p.id = ap.u_id
        AND target_p.verification_status = 'verified'
    ))
    -- TRUST CIRCLE FILTER RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
    AND NOT EXISTS (
      SELECT 1 FROM profiles target_p
      WHERE target_p.id = ap.u_id
        AND target_p.filter_only_verified = true
        AND (viewer_verification_status IS NULL OR viewer_verification_status != 'verified')
    )
  )
  SELECT
    eu.u_id AS user_id,
    p.name,
    date_part('year', age(p.birthdate))::int AS age,
    p.bio,
    -- Aggregate intentions from profile_intentions + intention_options
    COALESCE(intent.intentions, ARRAY[]::text[]) AS intentions,
    -- Aggregate photos from profile_photos ORDERED BY POSITION
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
    COALESCE(eu.u_entry_type, 'physical')::text AS entry_type,
    -- University fields
    p.university_id,
    COALESCE(univ_place.name, p.university_name_custom) AS university_name,
    p.university_name_custom,
    p.graduation_year,
    COALESCE(p.show_university_on_home, false) AS show_university_on_home,
    -- Planning fields
    eu.u_planned_for AS planned_for,
    eu.u_planned_period AS planned_period,
    -- Interests (vibes)
    COALESCE(interest.interests, ARRAY[]::text[]) AS interests
  FROM eligible_users eu
  JOIN profiles p ON p.id = eu.u_id
  LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
  LEFT JOIN education_levels el ON el.id = p.education_id
  LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
  LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id
  -- Join with places to get university name if university_id is set
  LEFT JOIN places univ_place ON univ_place.id = p.university_id
  -- Aggregate intentions
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT io.key) AS intentions
    FROM profile_intentions pi
    JOIN intention_options io ON io.id = pi.option_id
    WHERE pi.user_id = eu.u_id
  ) intent ON true
  -- Aggregate photos ORDERED BY POSITION
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(pp.url ORDER BY pp.position ASC) AS photos
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
  -- Aggregate interests (vibes)
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT i.key) AS interests
    FROM profile_interests pi2
    JOIN interests i ON i.id = pi2.interest_id
    WHERE pi2.profile_id = eu.u_id
  ) interest ON true
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
