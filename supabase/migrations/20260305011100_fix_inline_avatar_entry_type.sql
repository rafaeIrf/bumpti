-- =============================================================================
-- Fix: Add entry_type to inline avatar construction in set-based RPCs
-- =============================================================================
-- The set-based rewrites of get_trending_places and search_places_nearby
-- build avatars inline via CTEs instead of calling get_combined_place_avatars.
-- These inline constructions missed the entry_type field.
--
-- Fix: Add entry_type to all jsonb_build_object calls for avatars.
--   - Active avatars: join user_presences to get the actual entry_type
--   - Regular avatars: tag favorites as 'favorite', past visitors as 'past_visitor',
--     and university members as 'university_member'
-- =============================================================================


-- ── 1. Fix get_trending_places ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_trending_places(double precision, double precision, double precision, uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_trending_places(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision DEFAULT 50000,
  requesting_user_id uuid DEFAULT NULL::uuid,
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
  review_average double precision,
  review_count bigint,
  review_tags text[],
  dist_meters double precision,
  active_users bigint,
  preview_avatars jsonb,
  total_count bigint,
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  safe_offset    int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
BEGIN
  RETURN QUERY
  WITH

  eligible_active AS (
    SELECT DISTINCT
      up.place_id,
      up.user_id,
      up.entry_type::text AS entry_type
    FROM user_presences up
    WHERE up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),

  eligible_favorites AS (
    SELECT pfp.place_id, pfp.user_id, 'favorite'::text AS entry_type
    FROM profile_favorite_places pfp
    WHERE (requesting_user_id IS NULL OR pfp.user_id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = pfp.user_id AND ea.place_id = pfp.place_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, pfp.user_id))
  ),

  eligible_past_visitors AS (
    SELECT DISTINCT up.place_id, up.user_id, 'past_visitor'::text AS entry_type
    FROM user_presences up
    WHERE up.active = false
      AND up.entered_at > NOW() - INTERVAL '60 days'
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = up.user_id AND ea.place_id = up.place_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),

  eligible_university_members AS (
    SELECT p.university_id AS place_id, p.id AS user_id, 'university_member'::text AS entry_type
    FROM profiles p
    WHERE p.university_id IS NOT NULL
      AND (requesting_user_id IS NULL OR p.id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = p.id AND ea.place_id = p.university_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, p.id))
  ),

  eligible_regulars AS (
    SELECT place_id, user_id, entry_type FROM eligible_favorites
    UNION
    SELECT place_id, user_id, entry_type FROM eligible_past_visitors
    UNION
    SELECT place_id, user_id, entry_type FROM eligible_university_members
  ),

  candidate_place_ids AS (
    SELECT place_id FROM eligible_active
    UNION
    SELECT place_id FROM eligible_regulars
  ),

  places_with_distance AS (
    SELECT
      p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number,
      p.neighborhood, p.city, p.state, p.country_code AS country,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    INNER JOIN candidate_place_ids cp ON cp.place_id = p.id
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),

  active_counts AS (
    SELECT ea.place_id, COUNT(*)::bigint AS active_users_count
    FROM eligible_active ea
    INNER JOIN places_with_distance pwd ON pwd.id = ea.place_id
    GROUP BY ea.place_id
  ),
  regulars_counts AS (
    SELECT er.place_id, COUNT(*)::integer AS regulars_cnt
    FROM eligible_regulars er
    INNER JOIN places_with_distance pwd ON pwd.id = er.place_id
    GROUP BY er.place_id
  ),

  place_activity AS (
    SELECT
      pwd.*,
      COALESCE(ac.active_users_count, 0) AS active_users_count,
      COALESCE(rc.regulars_cnt, 0)       AS regulars_cnt
    FROM places_with_distance pwd
    LEFT JOIN active_counts ac   ON ac.place_id = pwd.id
    LEFT JOIN regulars_counts rc ON rc.place_id = pwd.id
  ),

  total AS (
    SELECT COUNT(*)::bigint AS cnt FROM place_activity
  ),

  limited_places AS (
    SELECT * FROM place_activity
    ORDER BY (active_users_count + regulars_cnt) DESC,
             active_users_count DESC,
             dist_meters ASC
    LIMIT safe_page_size OFFSET safe_offset
  ),

  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision AS avg_stars,
        COUNT(*)::bigint                 AS review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t       ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) AS top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  ),

  -- ACTIVE AVATARS — now includes entry_type
  active_avatars_raw AS (
    SELECT
      ea.place_id, ea.user_id, ea.entry_type, pp.url,
      ROW_NUMBER() OVER (PARTITION BY ea.place_id ORDER BY ea.user_id, pp.position ASC) AS rn
    FROM eligible_active ea
    INNER JOIN limited_places lp ON lp.id = ea.place_id
    INNER JOIN LATERAL (
      SELECT url, position FROM profile_photos
      WHERE user_id = ea.user_id AND url IS NOT NULL
      ORDER BY position ASC LIMIT 1
    ) pp ON true
  ),
  active_avatars AS (
    SELECT place_id,
      jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url, 'entry_type', entry_type) ORDER BY rn) AS avatars
    FROM active_avatars_raw WHERE rn <= 5
    GROUP BY place_id
  ),

  -- REGULAR AVATARS — now includes entry_type
  regular_avatars_raw AS (
    SELECT
      er.place_id, er.user_id, er.entry_type, pp.url,
      ROW_NUMBER() OVER (PARTITION BY er.place_id ORDER BY er.user_id, pp.position ASC) AS rn
    FROM eligible_regulars er
    INNER JOIN limited_places lp ON lp.id = er.place_id
    INNER JOIN LATERAL (
      SELECT url, position FROM profile_photos
      WHERE user_id = er.user_id AND url IS NOT NULL
      ORDER BY position ASC LIMIT 1
    ) pp ON true
  ),
  regular_avatars AS (
    SELECT place_id,
      jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url, 'entry_type', entry_type) ORDER BY rn) AS avatars
    FROM regular_avatars_raw WHERE rn <= 5
    GROUP BY place_id
  )

  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country,
    wr.review_average, wr.review_count, wr.review_tags, wr.dist_meters,
    wr.active_users_count                    AS active_users,
    COALESCE(aa.avatars, ra.avatars)         AS preview_avatars,
    (SELECT cnt FROM total)                   AS total_count,
    wr.regulars_cnt                          AS regulars_count
  FROM with_reviews wr
  LEFT JOIN active_avatars  aa ON aa.place_id = wr.id
  LEFT JOIN regular_avatars ra ON ra.place_id = wr.id
  ORDER BY (wr.active_users_count + wr.regulars_cnt) DESC,
           wr.active_users_count DESC,
           wr.dist_meters ASC;

END;
$function$;

GRANT EXECUTE ON FUNCTION get_trending_places(double precision, double precision, double precision, uuid, integer, integer)
  TO authenticated, anon;


-- ── 2. Fix search_places_nearby ────────────────────────────────────────────

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
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  safe_offset  int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
  max_limit    int := GREATEST(max_results, 0);
  remaining    int := max_limit - safe_offset;
  limit_amount int := LEAST(safe_page_size, GREATEST(remaining, 0));
BEGIN
  RETURN QUERY
  WITH

  limited_places AS (
    SELECT
      p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number,
      p.neighborhood, p.city, p.state, p.country_code AS country,
      p.relevance_score, p.confidence, p.socials, p.total_checkins, p.last_activity_at,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
    ORDER BY
      CASE WHEN sort_by = 'distance'   THEN ST_Distance(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) END ASC,
      CASE WHEN sort_by = 'popularity' THEN p.total_checkins END DESC,
      CASE WHEN sort_by = 'popularity' THEN p.last_activity_at END DESC,
      CASE WHEN sort_by = 'relevance'  THEN p.relevance_score END DESC,
      CASE WHEN sort_by = 'relevance'  THEN p.confidence END DESC,
      ST_Distance(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) ASC
    LIMIT limit_amount OFFSET safe_offset
  ),

  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision AS avg_stars,
        COUNT(*)::bigint                 AS review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t       ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) AS top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  ),

  eligible_active AS (
    SELECT DISTINCT up.place_id, up.user_id, up.entry_type::text AS entry_type
    FROM user_presences up
    INNER JOIN limited_places lp ON lp.id = up.place_id
    WHERE up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),

  active_counts AS (
    SELECT place_id, COUNT(*)::bigint AS active_users_count
    FROM eligible_active
    GROUP BY place_id
  ),

  active_avatars_raw AS (
    SELECT
      ea.place_id, ea.user_id, ea.entry_type, pp.url,
      ROW_NUMBER() OVER (PARTITION BY ea.place_id ORDER BY ea.user_id, pp.position ASC) AS rn
    FROM eligible_active ea
    INNER JOIN LATERAL (
      SELECT url, position FROM profile_photos
      WHERE user_id = ea.user_id AND url IS NOT NULL
      ORDER BY position ASC LIMIT 1
    ) pp ON true
  ),
  active_avatars AS (
    SELECT place_id,
      jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url, 'entry_type', entry_type) ORDER BY rn) AS avatars
    FROM active_avatars_raw WHERE rn <= 5
    GROUP BY place_id
  ),

  eligible_favorites AS (
    SELECT pfp.place_id, pfp.user_id, 'favorite'::text AS entry_type
    FROM profile_favorite_places pfp
    INNER JOIN limited_places lp ON lp.id = pfp.place_id
    WHERE (requesting_user_id IS NULL OR pfp.user_id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = pfp.user_id AND ea.place_id = pfp.place_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, pfp.user_id))
  ),

  eligible_past_visitors AS (
    SELECT DISTINCT up.place_id, up.user_id, 'past_visitor'::text AS entry_type
    FROM user_presences up
    INNER JOIN limited_places lp ON lp.id = up.place_id
    WHERE up.active = false
      AND up.entered_at > NOW() - INTERVAL '60 days'
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = up.user_id AND ea.place_id = up.place_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),

  eligible_regulars AS (
    SELECT place_id, user_id, entry_type FROM eligible_favorites
    UNION
    SELECT place_id, user_id, entry_type FROM eligible_past_visitors
  ),

  regulars_counts AS (
    SELECT place_id, COUNT(*)::integer AS regulars_cnt
    FROM eligible_regulars
    GROUP BY place_id
  ),

  regular_avatars_raw AS (
    SELECT
      er.place_id, er.user_id, er.entry_type, pp.url,
      ROW_NUMBER() OVER (PARTITION BY er.place_id ORDER BY er.user_id, pp.position ASC) AS rn
    FROM eligible_regulars er
    INNER JOIN LATERAL (
      SELECT url, position FROM profile_photos
      WHERE user_id = er.user_id AND url IS NOT NULL
      ORDER BY position ASC LIMIT 1
    ) pp ON true
  ),
  regular_avatars AS (
    SELECT place_id,
      jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url, 'entry_type', entry_type) ORDER BY rn) AS avatars
    FROM regular_avatars_raw WHERE rn <= 5
    GROUP BY place_id
  )

  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country,
    wr.relevance_score, wr.confidence, wr.socials,
    wr.review_average, wr.review_count, wr.review_tags,
    wr.total_checkins, wr.last_activity_at,
    COALESCE(ac.active_users_count, 0)   AS active_users,
    COALESCE(aa.avatars, ra.avatars)     AS preview_avatars,
    wr.dist_meters,
    COALESCE(rc.regulars_cnt, 0)         AS regulars_count
  FROM with_reviews wr
  LEFT JOIN active_counts   ac ON ac.place_id = wr.id
  LEFT JOIN active_avatars  aa ON aa.place_id = wr.id
  LEFT JOIN regulars_counts rc ON rc.place_id = wr.id
  LEFT JOIN regular_avatars ra ON ra.place_id = wr.id
  ORDER BY
    CASE WHEN sort_by = 'distance'   THEN wr.dist_meters END ASC,
    CASE WHEN sort_by = 'popularity' THEN wr.total_checkins END DESC,
    CASE WHEN sort_by = 'popularity' THEN wr.last_activity_at END DESC,
    CASE WHEN sort_by = 'relevance'  THEN wr.relevance_score END DESC,
    CASE WHEN sort_by = 'relevance'  THEN wr.confidence END DESC,
    wr.dist_meters ASC;

END;
$function$;

GRANT EXECUTE ON FUNCTION search_places_nearby(double precision, double precision, double precision, text[], integer, uuid, text, double precision, integer, integer)
  TO authenticated, anon;
