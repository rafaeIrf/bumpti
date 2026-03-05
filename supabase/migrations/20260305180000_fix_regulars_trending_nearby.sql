-- =============================================================================
-- Fix: Standardize regulars in get_trending_places & search_places_nearby
-- =============================================================================
-- Based on deployed 20260305011100_fix_inline_avatar_entry_type.sql
-- Changes:
--   1. Replace inline regulars logic with delegation to:
--      - get_regulars_count_at_place()
--      - get_regulars_avatars_at_place()
--      - get_eligible_active_users_count()
--      - get_active_users_with_avatars()
--   2. Regulars definition now comes from get_eligible_regulars_at_place
--      (single source of truth: no favorites, 30 days, social_hubs)
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
  WITH all_places_with_counts AS (
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
      p.country_code AS country,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_eligible_active_users_count(p.id, requesting_user_id) AS active_users_count,
      get_regulars_count_at_place(p.id, requesting_user_id) AS regulars_cnt
    FROM places p
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  trending_places AS (
    SELECT * FROM all_places_with_counts
    WHERE active_users_count > 0 OR regulars_cnt > 0
  ),
  total AS (
    SELECT COUNT(*)::bigint AS cnt FROM trending_places
  ),
  limited_places AS (
    SELECT * FROM trending_places
    ORDER BY active_users_count DESC, regulars_cnt DESC, dist_meters ASC
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
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country,
    wr.review_average, wr.review_count, wr.review_tags, wr.dist_meters,
    wr.active_users_count AS active_users,
    get_combined_place_avatars(wr.id, requesting_user_id, 4) AS preview_avatars,
    (SELECT cnt FROM total) AS total_count,
    wr.regulars_cnt AS regulars_count
  FROM with_reviews wr
  ORDER BY wr.active_users_count DESC, wr.regulars_cnt DESC, wr.dist_meters ASC;

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
  WITH limited_places AS (
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
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country,
    wr.relevance_score, wr.confidence, wr.socials,
    wr.review_average, wr.review_count, wr.review_tags,
    wr.total_checkins, wr.last_activity_at,
    get_eligible_active_users_count(wr.id, requesting_user_id) AS active_users,
    get_combined_place_avatars(wr.id, requesting_user_id, 4) AS preview_avatars,
    wr.dist_meters,
    get_regulars_count_at_place(wr.id, requesting_user_id) AS regulars_count
  FROM with_reviews wr
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


-- ── 3. Fix get_ranked_places ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_ranked_places(double precision, double precision, double precision, text, integer, uuid);

CREATE OR REPLACE FUNCTION public.get_ranked_places(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision,
  rank_by text DEFAULT 'total'::text,
  max_results integer DEFAULT 20,
  requesting_user_id uuid DEFAULT NULL::uuid
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
  total_checkins integer,
  monthly_checkins integer,
  total_matches integer,
  monthly_matches integer,
  review_average double precision,
  review_count bigint,
  review_tags text[],
  dist_meters double precision,
  rank_position integer,
  active_users bigint,
  preview_avatars jsonb,
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH
  all_in_radius AS (
    SELECT
      p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number, p.neighborhood,
      p.city, p.state, p.country_code AS p_country,
      p.total_checkins AS p_total_checkins, p.monthly_checkins AS p_monthly_checkins,
      p.total_matches AS p_total_matches, p.monthly_matches AS p_monthly_matches,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) AS p_dist_meters,
      GREATEST(MAX(p.total_matches)    OVER (), 1)::float AS mx_total_matches,
      GREATEST(MAX(p.total_checkins)   OVER (), 1)::float AS mx_total_checkins,
      GREATEST(MAX(p.monthly_matches)  OVER (), 1)::float AS mx_monthly_matches,
      GREATEST(MAX(p.monthly_checkins) OVER (), 1)::float AS mx_monthly_checkins
    FROM places p
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (p.total_matches > 0 OR p.total_checkins > 0 OR p.monthly_matches > 0 OR p.monthly_checkins > 0)
  ),
  ranked AS (
    SELECT *,
      CASE WHEN rank_by = 'monthly' THEN
        CASE WHEN rank_by = 'matches'  THEN p_monthly_matches::float
             WHEN rank_by = 'checkins' THEN p_monthly_checkins::float
             ELSE (0.6 * (p_monthly_matches::float / mx_monthly_matches)) + (0.4 * (p_monthly_checkins::float / mx_monthly_checkins))
        END
      ELSE
        CASE WHEN rank_by = 'matches'  THEN p_total_matches::float
             WHEN rank_by = 'checkins' THEN p_total_checkins::float
             ELSE (0.6 * (p_total_matches::float / mx_total_matches)) + (0.4 * (p_total_checkins::float / mx_total_checkins))
        END
      END AS composite_score
    FROM all_in_radius
  ),
  limited_places AS (
    SELECT * FROM ranked ORDER BY composite_score DESC, p_dist_meters ASC LIMIT max_results
  ),
  with_reviews AS (
    SELECT lp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT AVG(psr.stars)::double precision AS avg_stars, COUNT(*)::bigint AS review_count,
        ARRAY(SELECT t.key FROM place_review_tag_relations prtr
              JOIN place_review_tags t ON t.id = prtr.tag_id
              JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
              WHERE psr2.place_id = lp.id GROUP BY t.key ORDER BY COUNT(*) DESC LIMIT 3) AS top_tags
      FROM place_social_reviews psr WHERE psr.place_id = lp.id
    ) r ON true
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number, wr.neighborhood,
    wr.city, wr.state, wr.p_country,
    wr.p_total_checkins, wr.p_monthly_checkins, wr.p_total_matches, wr.p_monthly_matches,
    wr.review_average, wr.review_count, wr.review_tags, wr.p_dist_meters,
    DENSE_RANK() OVER (ORDER BY wr.composite_score DESC, wr.p_dist_meters ASC)::integer AS rank_position,
    get_eligible_active_users_count(wr.id, requesting_user_id) AS active_users,
    get_combined_place_avatars(wr.id, requesting_user_id, 4) AS preview_avatars,
    get_regulars_count_at_place(wr.id, requesting_user_id) AS regulars_count
  FROM with_reviews wr
  ORDER BY wr.composite_score DESC, wr.p_dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_ranked_places(double precision, double precision, double precision, text, integer, uuid)
  TO authenticated, anon;


-- ── 4. Fix get_user_favorite_places ────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_user_favorite_places(double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.get_user_favorite_places(
  user_lat double precision,
  user_lng double precision,
  requesting_user_id uuid
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
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH
  favorite_places AS (
    SELECT p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number,
           p.neighborhood, p.city, p.state, p.country_code AS country,
           ST_Distance(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                       ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS dist_meters
    FROM places p
    INNER JOIN profile_favorite_places pfp ON pfp.place_id = p.id
    WHERE pfp.user_id = requesting_user_id AND p.active = true
  ),
  with_reviews AS (
    SELECT fp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM favorite_places fp
    LEFT JOIN LATERAL (
      SELECT AVG(psr.stars)::double precision AS avg_stars, COUNT(*)::bigint AS review_count,
        ARRAY(SELECT t.key FROM place_review_tag_relations prtr
              JOIN place_review_tags t ON t.id = prtr.tag_id
              JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
              WHERE psr2.place_id = fp.id GROUP BY t.key ORDER BY COUNT(*) DESC LIMIT 3) AS top_tags
      FROM place_social_reviews psr WHERE psr.place_id = fp.id
    ) r ON true
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country,
    wr.review_average, wr.review_count, wr.review_tags, wr.dist_meters,
    get_eligible_active_users_count(wr.id, requesting_user_id) AS active_users,
    get_combined_place_avatars(wr.id, requesting_user_id, 4) AS preview_avatars,
    get_regulars_count_at_place(wr.id, requesting_user_id) AS regulars_count
  FROM with_reviews wr
  ORDER BY wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_user_favorite_places(double precision, double precision, uuid)
  TO authenticated, anon;


-- ── 5. Fix search_places_by_favorites (10-param overload) ──────────────────

DROP FUNCTION IF EXISTS public.search_places_by_favorites(double precision, double precision, double precision, text[], integer, uuid);

CREATE OR REPLACE FUNCTION public.search_places_by_favorites(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision,
  filter_categories text[] DEFAULT NULL::text[],
  max_results integer DEFAULT 50,
  requesting_user_id uuid DEFAULT NULL::uuid
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
  total_score integer,
  active_users bigint,
  preview_avatars jsonb,
  favorites_count bigint,
  dist_meters double precision,
  review_average double precision,
  review_count bigint,
  review_tags text[],
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH
  limited_places AS (
    SELECT p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number,
           p.neighborhood, p.city, p.state, p.country_code AS country, p.total_score,
      (SELECT count(*) FROM profile_favorite_places f
       WHERE f.place_id = p.id AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id)
      ) AS favorites_count,
      ST_Distance(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS dist_meters
    FROM places p
    WHERE p.active = true
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                     ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_meters)
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) AS c))
      AND EXISTS (SELECT 1 FROM profile_favorite_places f WHERE f.place_id = p.id
                    AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id))
    ORDER BY favorites_count DESC, dist_meters ASC
    LIMIT max_results
  ),
  with_reviews AS (
    SELECT lp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT AVG(psr.stars)::double precision AS avg_stars, COUNT(*)::bigint AS review_count,
        ARRAY(SELECT t.key FROM place_review_tag_relations prtr
              JOIN place_review_tags t ON t.id = prtr.tag_id
              JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
              WHERE psr2.place_id = lp.id GROUP BY t.key ORDER BY COUNT(*) DESC LIMIT 3) AS top_tags
      FROM place_social_reviews psr WHERE psr.place_id = lp.id
    ) r ON true
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country, wr.total_score,
    get_eligible_active_users_count(wr.id, requesting_user_id) AS active_users,
    get_combined_place_avatars(wr.id, requesting_user_id, 4) AS preview_avatars,
    wr.favorites_count, wr.dist_meters,
    wr.review_average, wr.review_count, wr.review_tags,
    get_regulars_count_at_place(wr.id, requesting_user_id) AS regulars_count
  FROM with_reviews wr
  ORDER BY wr.favorites_count DESC, wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION search_places_by_favorites(double precision, double precision, double precision, text[], integer, uuid)
  TO authenticated, anon;
