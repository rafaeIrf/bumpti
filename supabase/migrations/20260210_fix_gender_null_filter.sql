-- =============================================================================
-- Migration: Fix NULL gender_id handling in discovery functions
-- =============================================================================
-- Problem: Users who skip gender selection have gender_id = NULL and no rows
-- in profile_connect_with. This makes them invisible in both directions.
--
-- Solution: Add NULL-safe bypass conditions to gender filter rules:
-- - When a user has no profile_connect_with rows → skip (open to everyone)
-- - Users with NULL gender_id will only match others with no connect_with prefs
-- - Users with specific gender preferences will NOT see genderless users
--
-- Functions updated (each copied from its latest migration):
-- 1. get_active_users_with_avatars  (from 20260204180000)
-- 2. get_eligible_active_users_count (from 20260204180000)
-- 3. get_available_users_at_place    (from 20260204180000)
-- 4. get_discover_feed               (from 20260207_global_dedup_priority)
-- 5. get_place_activity_candidates   (from 20260204200000)
-- =============================================================================

-- =============================================================================
-- PART 1: get_active_users_with_avatars
-- Source: 20260204180000_fix_bidirectional_gender_filter.sql
-- =============================================================================
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
  req_filter_verified boolean;
  req_verification_status text;
BEGIN
  -- Get requesting user's age preferences, age, AND verification settings
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      age_range_min, 
      age_range_max,
      EXTRACT(YEAR FROM AGE(birthdate))::integer,
      filter_only_verified,
      verification_status
    INTO req_age_min, req_age_max, req_age, req_filter_verified, req_verification_status
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
    -- BIDIRECTIONAL gender preference RULE 1: Target user must want to connect with MY gender (NULL-safe)
    AND (requesting_user_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = up.user_id)
      OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      )
    )
    -- BIDIRECTIONAL gender preference RULE 2: I must want to connect with TARGET user's gender (NULL-safe)
    AND (requesting_user_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = requesting_user_id)
      OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles tp ON tp.id = up.user_id
        WHERE pcw.user_id = requesting_user_id
          AND pcw.gender_id = tp.gender_id
      )
    )
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
    -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified = true, only count verified profiles
    AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.verification_status = 'verified'
    ))
    -- TRUST CIRCLE FILTER RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
    AND (requesting_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.filter_only_verified = true
        AND (req_verification_status IS NULL OR req_verification_status != 'verified')
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
      -- BIDIRECTIONAL gender preference RULE 1 (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = up.user_id)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles rp ON rp.id = requesting_user_id
          WHERE pcw.user_id = up.user_id
            AND pcw.gender_id = rp.gender_id
        )
      )
      -- BIDIRECTIONAL gender preference RULE 2 (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = requesting_user_id)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles tp ON tp.id = up.user_id
          WHERE pcw.user_id = requesting_user_id
            AND pcw.gender_id = tp.gender_id
        )
      )
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
      -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified = true, only show verified profiles
      AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.verification_status = 'verified'
      ))
      -- TRUST CIRCLE FILTER RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.filter_only_verified = true
          AND (req_verification_status IS NULL OR req_verification_status != 'verified')
      ))
    ORDER BY up.entered_at DESC
    LIMIT max_avatars
  ) INTO avatar_data;

  result.avatars := avatar_data;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_users_with_avatars(uuid, uuid, integer) TO authenticated, anon;

-- =============================================================================
-- PART 2: get_eligible_active_users_count
-- Source: 20260204180000_fix_bidirectional_gender_filter.sql
-- =============================================================================
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
  req_filter_verified boolean;
  req_verification_status text;
BEGIN
  -- Get requesting user's age preferences, age, AND verification settings
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      age_range_min, 
      age_range_max,
      EXTRACT(YEAR FROM AGE(birthdate))::integer,
      filter_only_verified,
      verification_status
    INTO req_age_min, req_age_max, req_age, req_filter_verified, req_verification_status
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
      -- BIDIRECTIONAL gender preference RULE 1: Target user must want to connect with MY gender (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = up.user_id)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles rp ON rp.id = requesting_user_id
          WHERE pcw.user_id = up.user_id
            AND pcw.gender_id = rp.gender_id
        )
      )
      -- BIDIRECTIONAL gender preference RULE 2: I must want to connect with TARGET user's gender (NULL-safe)
      AND (requesting_user_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = requesting_user_id)
        OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles tp ON tp.id = up.user_id
          WHERE pcw.user_id = requesting_user_id
            AND pcw.gender_id = tp.gender_id
        )
      )
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
      -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified = true, only count verified profiles
      AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.verification_status = 'verified'
      ))
      -- TRUST CIRCLE FILTER RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.filter_only_verified = true
          AND (req_verification_status IS NULL OR req_verification_status != 'verified')
      ))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_eligible_active_users_count(uuid, uuid) TO authenticated, anon;

-- =============================================================================
-- PART 3: get_available_users_at_place
-- Source: 20260204180000_fix_bidirectional_gender_filter.sql
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
  -- Get viewer's age preferences AND current age
  SELECT age_range_min, age_range_max, EXTRACT(YEAR FROM AGE(birthdate))::integer
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
    COALESCE(eu.u_entry_type, 'physical')::text AS entry_type
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

-- =============================================================================
-- PART 4: get_discover_feed
-- Source: 20260207_global_dedup_priority.sql
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_discover_feed(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_discover_feed(
  p_viewer_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  encounter_id          uuid,
  other_user_id         uuid,
  place_id              uuid,
  encounter_type        text,
  affinity_score        integer,
  shared_interests_count bigint,
  metadata              jsonb,
  last_encountered_at   timestamptz,
  place_name            text,
  additional_encounters jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  viewer_gender_id     integer;
  viewer_verified_only boolean;
  viewer_age_min       integer;
  viewer_age_max       integer;
  viewer_age           integer;
BEGIN
  -- Fetch viewer preferences
  SELECT p.gender_id, p.filter_only_verified, p.age_range_min, p.age_range_max,
         EXTRACT(YEAR FROM AGE(p.birthdate))::integer
  INTO viewer_gender_id, viewer_verified_only, viewer_age_min, viewer_age_max, viewer_age
  FROM profiles p WHERE p.id = p_viewer_id;

  RETURN QUERY
  WITH per_type AS (
    -----------------------------------------------------------------------
    -- Pass 1: deduplicate per (other_user_id, encounter_type)
    -- Keeps the encounter with the highest affinity_score, then most recent.
    -----------------------------------------------------------------------
    SELECT DISTINCT ON (
      CASE WHEN e.user_a_id = p_viewer_id THEN e.user_b_id ELSE e.user_a_id END,
      e.encounter_type
    )
      e.id                                                                       AS encounter_id,
      CASE WHEN e.user_a_id = p_viewer_id THEN e.user_b_id ELSE e.user_a_id END AS other_user_id,
      e.place_id,
      e.encounter_type,
      e.affinity_score,
      e.metadata,
      e.last_encountered_at
    FROM public.user_encounters e
    WHERE e.user_a_id = p_viewer_id OR e.user_b_id = p_viewer_id
    ORDER BY
      CASE WHEN e.user_a_id = p_viewer_id THEN e.user_b_id ELSE e.user_a_id END,
      e.encounter_type,
      e.affinity_score DESC,
      e.last_encountered_at DESC
  ),
  prioritized AS (
    -----------------------------------------------------------------------
    -- Pass 2: ONE row per other_user_id — pick the highest-priority type.
    -- Hierarchy: direct_overlap (1) > vibe_match (2) > anything else (3)
    -- Also collect the "losing" encounter types as additional_encounters JSONB.
    -----------------------------------------------------------------------
    SELECT DISTINCT ON (pt.other_user_id)
      pt.*,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'type',           sub.encounter_type,
          'place_name',     pl_sub.name,
          'affinity_score', sub.affinity_score
        ) ORDER BY sub.affinity_score DESC)
        FROM per_type sub
        LEFT JOIN public.places pl_sub ON pl_sub.id = sub.place_id
        WHERE sub.other_user_id = pt.other_user_id
          AND sub.encounter_id  != pt.encounter_id        -- exclude the winner
      ) AS additional_encounters
    FROM per_type pt
    ORDER BY
      pt.other_user_id,
      CASE pt.encounter_type
        WHEN 'direct_overlap' THEN 1
        WHEN 'vibe_match'     THEN 2
        ELSE 3
      END,
      pt.affinity_score DESC,
      pt.last_encountered_at DESC
  )
  -----------------------------------------------------------------------
  -- Final SELECT: join profile + place + shared interests + 8-filter matrix
  -----------------------------------------------------------------------
  SELECT
    pr.encounter_id,
    pr.other_user_id,
    pr.place_id,
    pr.encounter_type,
    pr.affinity_score,
    COALESCE(si.cnt, 0)  AS shared_interests_count,
    pr.metadata,
    pr.last_encountered_at,
    pl.name              AS place_name,
    pr.additional_encounters
  FROM prioritized pr
  JOIN   public.profiles p  ON p.id  = pr.other_user_id
  LEFT JOIN public.places pl ON pl.id = pr.place_id
  -- Shared interests (live calculation)
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.profile_interests pi_a
    JOIN public.profile_interests pi_b ON pi_a.interest_id = pi_b.interest_id
    WHERE pi_a.profile_id = p_viewer_id AND pi_b.profile_id = pr.other_user_id
  ) si ON true
  WHERE
    -- 1. Hide invisible users
    p.is_invisible IS NOT TRUE
    -- 2. Hide users the viewer already liked/disliked (non-expired)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_interactions ui
      WHERE ui.from_user_id = p_viewer_id AND ui.to_user_id = pr.other_user_id
        AND ui.action IN ('like', 'dislike')
        AND (ui.action_expires_at IS NULL OR ui.action_expires_at > now())
    )
    -- 3. Hide users who disliked the viewer (bidirectional, non-expired)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_interactions ui
      WHERE ui.from_user_id = pr.other_user_id AND ui.to_user_id = p_viewer_id
        AND ui.action = 'dislike'
        AND (ui.action_expires_at IS NULL OR ui.action_expires_at > now())
    )
    -- 4. Hide blocked users (bidirectional)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = p_viewer_id AND ub.blocked_id = pr.other_user_id)
         OR (ub.blocker_id = pr.other_user_id AND ub.blocked_id = p_viewer_id)
    )
    -- 5. Hide existing matches
    AND NOT EXISTS (
      SELECT 1 FROM public.user_matches m
      WHERE (m.user_a = p_viewer_id AND m.user_b = pr.other_user_id)
         OR (m.user_a = pr.other_user_id AND m.user_b = p_viewer_id)
    )
    -- 6. Gender preference bidirectional (NULL-safe)
    -- RULE 1: I must want to connect with target's gender
    AND (
      NOT EXISTS (SELECT 1 FROM public.profile_connect_with WHERE user_id = p_viewer_id)
      OR EXISTS (
        SELECT 1 FROM public.profile_connect_with pcw
        WHERE pcw.user_id = p_viewer_id AND pcw.gender_id = p.gender_id
      )
    )
    -- RULE 2: Target must want to connect with my gender
    AND (
      NOT EXISTS (SELECT 1 FROM public.profile_connect_with WHERE user_id = pr.other_user_id)
      OR EXISTS (
        SELECT 1 FROM public.profile_connect_with pcw
        WHERE pcw.user_id = pr.other_user_id AND pcw.gender_id = viewer_gender_id
      )
    )
    -- 7. Age range bidirectional
    AND EXTRACT(YEAR FROM AGE(p.birthdate))::integer BETWEEN viewer_age_min AND viewer_age_max
    AND viewer_age BETWEEN p.age_range_min AND p.age_range_max
    -- 8. Verified-only filter (if viewer has it active)
    AND (
      viewer_verified_only = false
      OR p.verification_status = 'verified'
    )
  ORDER BY pr.affinity_score DESC, pr.last_encountered_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =============================================================================
-- PART 5: get_place_activity_candidates
-- Source: 20260204200000_add_gender_filter_to_activity_notifications.sql
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_place_activity_candidates();

CREATE OR REPLACE FUNCTION "public"."get_place_activity_candidates"()
RETURNS TABLE(
  target_user_id uuid,
  notification_type text,
  target_place_id uuid,
  target_place_name text,
  active_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  ttl_started INT := 24;  -- Hours before re-sending "started" notification
  ttl_heating INT := 6;   -- Hours before re-sending "heating" notification
  ttl_nearby INT := 12;   -- Hours before re-sending "nearby" notification
  distance_threshold FLOAT := 30000; -- 30km in meters
  location_staleness_hours INT := 24; -- Location data must be fresher than 24h
BEGIN
  RETURN QUERY

  -- CTE: Active users at places with their gender
  WITH active_presences AS (
    SELECT 
      up.place_id,
      up.user_id,
      p.name AS place_name,
      p.lat,
      p.lng,
      p.city,
      prof.gender_id
    FROM user_presences up
    JOIN places p ON p.id = up.place_id
    JOIN profiles prof ON prof.id = up.user_id
    WHERE up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
  ),
  -- Count per place (raw)
  active_counts AS (
    SELECT 
      ap.place_id,
      ap.place_name,
      ap.lat,
      ap.lng,
      ap.city,
      COUNT(*)::integer AS count
    FROM active_presences ap
    GROUP BY ap.place_id, ap.place_name, ap.lat, ap.lng, ap.city
  )

  -- 1. FAVORITE STARTED (Count 1-2, activity starting)
  SELECT 
    fav.user_id AS target_user_id,
    'favorite_activity_started'::text AS notification_type,
    ac.place_id AS target_place_id,
    ac.place_name AS target_place_name,
    ac.count AS active_count
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count >= 1 AND ac.count < 3
  -- Exclude if target is currently at this place
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
  )
  -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
  -- RULE 1: At least one active user wants to connect with MY gender
  AND (
    EXISTS (
      SELECT 1 FROM active_presences ap
      WHERE ap.place_id = ac.place_id
        AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
    )
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
      JOIN profiles target_prof ON target_prof.id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = target_prof.gender_id
    )
  )
  -- RULE 2: I want to connect with at least one active user's gender
  AND (
    NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = fav.user_id)
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = ap.gender_id
    )
  )
  -- TTL Check
  AND NOT EXISTS (
    SELECT 1 FROM notification_events ne
    WHERE ne.user_id = fav.user_id
    AND ne.place_id = ac.place_id
    AND ne.type = 'favorite_activity_started'
    AND ne.created_at > NOW() - (ttl_started || ' hours')::interval
  )

  UNION ALL

  -- 2. FAVORITE HEATING (Count >= 3)
  SELECT 
    fav.user_id AS target_user_id,
    'favorite_activity_heating'::text AS notification_type,
    ac.place_id AS target_place_id,
    ac.place_name AS target_place_name,
    ac.count AS active_count
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count >= 3
  -- Exclude if target is currently at this place
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
  )
  -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
  AND (
    EXISTS (
      SELECT 1 FROM active_presences ap
      WHERE ap.place_id = ac.place_id
        AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
    )
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
      JOIN profiles target_prof ON target_prof.id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = target_prof.gender_id
    )
  )
  AND (
    NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = fav.user_id)
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = ap.gender_id
    )
  )
  -- TTL Check
  AND NOT EXISTS (
    SELECT 1 FROM notification_events ne
    WHERE ne.user_id = fav.user_id
    AND ne.place_id = ac.place_id
    AND ne.type = 'favorite_activity_heating'
    AND ne.created_at > NOW() - (ttl_heating || ' hours')::interval
  )

  UNION ALL

  -- 3. NEARBY STARTED (Max 1 per user, Count 1-2, Within 30km radius)
  SELECT
    sub.target_user_id,
    'nearby_activity_started'::text AS notification_type,
    sub.target_place_id,
    sub.target_place_name,
    sub.active_count
  FROM (
    SELECT
      prof.id AS target_user_id,
      ac.place_id AS target_place_id,
      ac.place_name AS target_place_name,
      ac.count AS active_count,
      ROW_NUMBER() OVER (PARTITION BY prof.id ORDER BY ac.count DESC) AS rn
    FROM active_counts ac
    CROSS JOIN profiles prof
    WHERE ac.count >= 1 AND ac.count < 3
    -- User must have recent location data
    AND prof.last_lat IS NOT NULL
    AND prof.last_lng IS NOT NULL
    AND prof.last_location_updated_at IS NOT NULL
    AND prof.last_location_updated_at > NOW() - (location_staleness_hours || ' hours')::interval
    -- Distance check: within 30km
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(prof.last_lng, prof.last_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(ac.lng, ac.lat), 4326)::geography,
      distance_threshold
    )
    -- Exclude users currently active at this place
    AND NOT EXISTS (
      SELECT 1 FROM user_presences up_check
      WHERE up_check.user_id = prof.id
      AND up_check.place_id = ac.place_id
      AND up_check.active = true
    )
    -- Exclude if it's a favorite (handled by favorite rules)
    AND NOT EXISTS (
      SELECT 1 FROM profile_favorite_places fav_check
      WHERE fav_check.user_id = prof.id
      AND fav_check.place_id = ac.place_id
    )
    -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
    AND (
      EXISTS (
        SELECT 1 FROM active_presences ap
        WHERE ap.place_id = ac.place_id
          AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
      )
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = prof.gender_id
      )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = prof.id)
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = prof.id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = ap.gender_id
      )
    )
    -- TTL Check
    AND NOT EXISTS (
      SELECT 1 FROM notification_events ne
      WHERE ne.user_id = prof.id
      AND ne.place_id = ac.place_id
      AND ne.type = 'nearby_activity_started'
      AND ne.created_at > NOW() - (ttl_nearby || ' hours')::interval
    )
  ) sub
  WHERE sub.rn = 1

  UNION ALL

  -- 4. NEARBY HEATING (Max 1 per user, Count >= 3, Within 30km radius)
  SELECT
    sub.target_user_id,
    'nearby_activity_heating'::text AS notification_type,
    sub.target_place_id,
    sub.target_place_name,
    sub.active_count
  FROM (
    SELECT
      prof.id AS target_user_id,
      ac.place_id AS target_place_id,
      ac.place_name AS target_place_name,
      ac.count AS active_count,
      ROW_NUMBER() OVER (PARTITION BY prof.id ORDER BY ac.count DESC) AS rn
    FROM active_counts ac
    CROSS JOIN profiles prof
    WHERE ac.count >= 3
    -- User must have recent location data
    AND prof.last_lat IS NOT NULL
    AND prof.last_lng IS NOT NULL
    AND prof.last_location_updated_at IS NOT NULL
    AND prof.last_location_updated_at > NOW() - (location_staleness_hours || ' hours')::interval
    -- Distance check: within 30km
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(prof.last_lng, prof.last_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(ac.lng, ac.lat), 4326)::geography,
      distance_threshold
    )
    -- Exclude users currently active at this place
    AND NOT EXISTS (
      SELECT 1 FROM user_presences up_check
      WHERE up_check.user_id = prof.id
      AND up_check.place_id = ac.place_id
      AND up_check.active = true
    )
    -- Exclude if it's a favorite (handled by favorite rules)
    AND NOT EXISTS (
      SELECT 1 FROM profile_favorite_places fav_check
      WHERE fav_check.user_id = prof.id
      AND fav_check.place_id = ac.place_id
    )
    -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
    AND (
      EXISTS (
        SELECT 1 FROM active_presences ap
        WHERE ap.place_id = ac.place_id
          AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
      )
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = prof.gender_id
      )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = prof.id)
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = prof.id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = ap.gender_id
      )
    )
    -- TTL Check
    AND NOT EXISTS (
      SELECT 1 FROM notification_events ne
      WHERE ne.user_id = prof.id
      AND ne.place_id = ac.place_id
      AND ne.type = 'nearby_activity_heating'
      AND ne.created_at > NOW() - (ttl_nearby || ' hours')::interval
    )
  ) sub
  WHERE sub.rn = 1;
END;
$$;

ALTER FUNCTION "public"."get_place_activity_candidates"() OWNER TO "postgres";
