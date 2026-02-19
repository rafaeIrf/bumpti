-- =============================================================================
-- Migration: Enrich get_eligible_regulars_at_place + add regulars_count to nearby
-- =============================================================================
-- 1. Extends get_eligible_regulars_at_place to return full enriched profile data
--    (same shape as get_available_users_at_place) so the Edge Function doesn't
--    need to make 3 extra DB queries for manual enrichment.
-- 2. Adds regulars_count column to search_places_nearby.
-- =============================================================================

-- ============================================================================
-- PART 1: Enriched regulars RPC
-- ============================================================================

DROP FUNCTION IF EXISTS get_eligible_regulars_at_place(uuid, uuid);

CREATE OR REPLACE FUNCTION get_eligible_regulars_at_place(
  target_place_id uuid,
  requesting_user_id uuid
)
RETURNS TABLE(
  user_id uuid,
  entry_type text,
  entered_at timestamptz,
  -- Enriched profile fields (same as get_available_users_at_place)
  name text,
  age int,
  bio text,
  intentions text[],
  photos text[],
  job_title text,
  company_name text,
  height_cm int,
  zodiac_sign text,
  education_level text,
  relationship_status text,
  smoking_habit text,
  favorite_places text[],
  languages text[],
  interests text[],
  university_id uuid,
  university_name text,
  university_name_custom text,
  graduation_year int,
  show_university_on_home boolean,
  verification_status text,
  city_name text,
  city_state text
)
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
    WITH eligible_regulars AS (
      -- DISTINCT ON ensures each user appears only once, prioritized by source
      SELECT DISTINCT ON (candidates.uid)
        candidates.uid,
        candidates.etype,
        candidates.eat
      FROM (
        -- Source 1: Past check-ins (last 60 days, inactive presences)
        SELECT
          up.user_id AS uid,
          'past_visitor'::text AS etype,
          up.entered_at AS eat,
          1 AS priority
        FROM user_presences up
        WHERE up.place_id = target_place_id
          AND up.active = false
          AND up.entered_at > NOW() - INTERVAL '60 days'
          AND NOT EXISTS (
            SELECT 1 FROM user_presences active_up
            WHERE active_up.user_id = up.user_id
              AND active_up.place_id = target_place_id
              AND active_up.active = true
              AND active_up.ended_at IS NULL
              AND active_up.expires_at > NOW()
          )

        UNION ALL

        -- Source 2: Users who favorited this place
        SELECT
          pfp.user_id AS uid,
          'favorite'::text AS etype,
          pfp.created_at AS eat,
          2 AS priority
        FROM profile_favorite_places pfp
        WHERE pfp.place_id = target_place_id
          AND NOT EXISTS (
            SELECT 1 FROM user_presences active_up
            WHERE active_up.user_id = pfp.user_id
              AND active_up.place_id = target_place_id
              AND active_up.active = true
              AND active_up.ended_at IS NULL
              AND active_up.expires_at > NOW()
          )
      ) candidates
      -- ── 8-filter eligibility matrix ──
      WHERE
        (requesting_user_id IS NULL OR candidates.uid != requesting_user_id)
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_blocks b 
          WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = candidates.uid) 
             OR (b.blocker_id = candidates.uid AND b.blocked_id = requesting_user_id)
        ))
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_interactions ui 
          WHERE ui.action = 'dislike'
            AND (
              (ui.from_user_id = requesting_user_id AND ui.to_user_id = candidates.uid) 
              OR 
              (ui.from_user_id = candidates.uid AND ui.to_user_id = requesting_user_id)
            )
        ))
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_interactions ui 
          WHERE ui.action = 'like'
            AND ui.from_user_id = requesting_user_id 
            AND ui.to_user_id = candidates.uid
        ))
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_matches um
          WHERE um.status = 'active'
            AND (
              (um.user_a = requesting_user_id AND um.user_b = candidates.uid)
              OR 
              (um.user_a = candidates.uid AND um.user_b = requesting_user_id)
            )
        ))
        AND (requesting_user_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE profile_connect_with.user_id = candidates.uid)
          OR EXISTS (
            SELECT 1 FROM profile_connect_with pcw
            INNER JOIN profiles rp ON rp.id = requesting_user_id
            WHERE pcw.user_id = candidates.uid
              AND pcw.gender_id = rp.gender_id
          )
        )
        AND (requesting_user_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE profile_connect_with.user_id = requesting_user_id)
          OR EXISTS (
            SELECT 1 FROM profile_connect_with pcw
            INNER JOIN profiles tp ON tp.id = candidates.uid
            WHERE pcw.user_id = requesting_user_id
              AND pcw.gender_id = tp.gender_id
          )
        )
        AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
          SELECT 1 FROM profiles target_profile
          WHERE target_profile.id = candidates.uid
            AND target_profile.birthdate IS NOT NULL
            AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
            AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
        ))
        AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
          SELECT 1 FROM profiles target_profile
          WHERE target_profile.id = candidates.uid
            AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
                 OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
        ))
        AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
          SELECT 1 FROM profiles target_profile
          WHERE target_profile.id = candidates.uid
            AND target_profile.verification_status = 'verified'
        ))
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM profiles target_profile
          WHERE target_profile.id = candidates.uid
            AND target_profile.filter_only_verified = true
            AND (req_verification_status IS NULL OR req_verification_status != 'verified')
        ))
      ORDER BY candidates.uid, candidates.priority ASC, candidates.eat DESC
    )
    -- Now JOIN with profile data (same pattern as get_available_users_at_place)
    SELECT
      er.uid AS user_id,
      er.etype AS entry_type,
      er.eat AS entered_at,
      p.name,
      date_part('year', age(p.birthdate))::int AS age,
      p.bio,
      COALESCE(intent.intentions, ARRAY[]::text[]) AS intentions,
      COALESCE(photo.photos, ARRAY[]::text[]) AS photos,
      p.job_title,
      p.company_name,
      p.height_cm,
      zs.key AS zodiac_sign,
      el.key AS education_level,
      rs.key AS relationship_status,
      sh.key AS smoking_habit,
      COALESCE(fav.places, ARRAY[]::text[]) AS favorite_places,
      COALESCE(lang.langs, ARRAY[]::text[]) AS languages,
      COALESCE(interest.interests, ARRAY[]::text[]) AS interests,
      p.university_id,
      COALESCE(univ_place.name, p.university_name_custom) AS university_name,
      p.university_name_custom,
      p.graduation_year,
      COALESCE(p.show_university_on_home, false) AS show_university_on_home,
      p.verification_status,
      p.city_name,
      p.city_state
    FROM eligible_regulars er
    JOIN profiles p ON p.id = er.uid
    LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
    LEFT JOIN education_levels el ON el.id = p.education_id
    LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
    LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id
    LEFT JOIN places univ_place ON univ_place.id = p.university_id
    -- Aggregate intentions
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT io.key) AS intentions
      FROM profile_intentions pi
      JOIN intention_options io ON io.id = pi.option_id
      WHERE pi.user_id = er.uid
    ) intent ON true
    -- Aggregate photos ORDERED BY POSITION
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(pp.url ORDER BY pp.position ASC) AS photos
      FROM profile_photos pp
      WHERE pp.user_id = er.uid
    ) photo ON true
    -- Aggregate favorite places
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT pfp2.place_id::text) AS places
      FROM profile_favorite_places pfp2
      WHERE pfp2.user_id = er.uid
    ) fav ON true
    -- Aggregate languages
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT l.key) AS langs
      FROM profile_languages pl
      JOIN languages l ON l.id = pl.language_id
      WHERE pl.user_id = er.uid
    ) lang ON true
    -- Aggregate interests (vibes)
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT i.key) AS interests
      FROM profile_interests pi2
      JOIN interests i ON i.id = pi2.interest_id
      WHERE pi2.profile_id = er.uid
    ) interest ON true
    -- Invisible mode: only show if they liked me
    WHERE
      p.is_invisible = false
      OR EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = er.uid
          AND ui.to_user_id = requesting_user_id
          AND ui.action = 'like'
          AND ui.action_expires_at > NOW()
      );
END;
$$;

GRANT EXECUTE ON FUNCTION get_eligible_regulars_at_place(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_eligible_regulars_at_place IS
'Returns enriched regulars at a place: users with past check-ins (60 days) or who
favorited the place. Returns full profile data (same shape as get_available_users_at_place).
Applies the full 8-filter eligibility matrix. Active users are excluded.';


-- ============================================================================
-- PART 2: Update get_regulars_count_at_place (signature changed)
-- ============================================================================

DROP FUNCTION IF EXISTS get_regulars_count_at_place(uuid, uuid);

CREATE OR REPLACE FUNCTION get_regulars_count_at_place(
  target_place_id uuid,
  requesting_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM get_eligible_regulars_at_place(target_place_id, requesting_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_regulars_count_at_place(uuid, uuid) TO authenticated, anon;


-- ============================================================================
-- PART 3: Add regulars_count to search_places_nearby
-- ============================================================================

DROP FUNCTION IF EXISTS public.search_places_nearby(double precision, double precision, double precision, text[], integer, uuid, text, double precision, integer, integer);

CREATE OR REPLACE FUNCTION public.search_places_nearby(
  user_lat double precision, 
  user_lng double precision, 
  radius_meters double precision, 
  filter_categories text[] DEFAULT NULL::text[], 
  max_results integer DEFAULT 60, 
  requesting_user_id uuid DEFAULT NULL::uuid, 
  sort_by text DEFAULT 'relevance'::text, 
  min_rating double precision DEFAULT NULL::double precision, 
  page_offset integer DEFAULT 0, 
  page_size integer DEFAULT 20
)
RETURNS TABLE(
  id uuid, 
  name text, 
  category text, 
  lat double precision, 
  lng double precision, 
  street text, 
  house_number text, 
  neighborhood text,
  city text, 
  state text, 
  country text, 
  relevance_score integer, 
  confidence double precision, 
  socials jsonb, 
  review_average double precision, 
  review_count bigint, 
  review_tags text[], 
  total_checkins integer, 
  last_activity_at timestamp with time zone, 
  active_users bigint, 
  preview_avatars jsonb,
  dist_meters double precision,
  regulars_count integer  -- NEW
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  safe_offset int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
  max_limit int := GREATEST(max_results, 0);
  remaining int := max_limit - safe_offset;
  limit_amount int := LEAST(safe_page_size, GREATEST(remaining, 0));
BEGIN
  RETURN QUERY
  WITH limited_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,
      p.city,
      p.state,
      p.country_code as country,
      p.relevance_score,
      p.confidence,
      p.socials,
      p.total_checkins,
      p.last_activity_at,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
    ORDER BY
      CASE WHEN sort_by = 'distance' THEN st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) END ASC,
      CASE WHEN sort_by = 'popularity' THEN p.total_checkins END DESC,
      CASE WHEN sort_by = 'popularity' THEN p.last_activity_at END DESC,
      CASE WHEN sort_by = 'relevance' THEN p.relevance_score END DESC,
      CASE WHEN sort_by = 'relevance' THEN p.confidence END DESC,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) ASC
    LIMIT limit_amount
    OFFSET safe_offset
  ),
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.neighborhood,
    wr.city,
    wr.state,
    wr.country,
    wr.relevance_score,
    wr.confidence,
    wr.socials,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.total_checkins,
    wr.last_activity_at,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars,
    wr.dist_meters,
    get_regulars_count_at_place(wr.id, requesting_user_id) as regulars_count  -- NEW
  FROM with_reviews wr;
END;
$function$;
