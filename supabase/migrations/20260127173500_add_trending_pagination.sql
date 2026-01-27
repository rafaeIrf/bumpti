-- =============================================================================
-- Migration: Add pagination and total_count to get_trending_places
-- =============================================================================
-- Extends the optimized get_trending_places from optimize_places_nearby_limit_first
-- Changes:
-- 1. Replaces max_results with page_offset + page_size for pagination
-- 2. Adds total_count output column for UI counter
-- 3. Preserves all existing logic (CTEs, reviews, avatars)
-- 4. OPTIMIZED: Uses single CTE to call get_eligible_active_users_count only once per place

-- Drop the existing signature
DROP FUNCTION IF EXISTS get_trending_places(double precision, double precision, double precision, integer, uuid);

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
  city text, 
  state text, 
  country text, 
  review_average double precision, 
  review_count bigint, 
  review_tags text[], 
  dist_meters double precision, 
  active_users bigint,
  preview_avatars jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  safe_offset int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
BEGIN
  RETURN QUERY
  -- Step 1: Compute active users count ONCE per place in radius (single call to get_eligible_active_users_count)
  WITH all_places_with_counts AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.city,
      p.state,
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users_count
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  -- Step 2: Filter to places with active users
  trending_places AS (
    SELECT *
    FROM all_places_with_counts
    WHERE active_users_count > 0
  ),
  -- Step 3: Compute total count from filtered results
  total AS (
    SELECT COUNT(*)::bigint as cnt FROM trending_places
  ),
  -- Step 4: Paginate
  limited_places AS (
    SELECT *
    FROM trending_places
    ORDER BY active_users_count DESC, dist_meters ASC
    LIMIT safe_page_size
    OFFSET safe_offset
  ),
  -- Step 5: Add reviews for limited results
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
  -- Step 6: Add avatars only for final results + total_count
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.city,
    wr.state,
    wr.country,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    wr.active_users_count as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars,
    (SELECT cnt FROM total) as total_count
  FROM with_reviews wr
  ORDER BY wr.active_users_count DESC, wr.dist_meters ASC;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_trending_places(double precision, double precision, double precision, uuid, integer, integer) TO authenticated, anon;

COMMENT ON FUNCTION get_trending_places IS 
'Returns places with active eligible users, sorted by active_users count.
Supports pagination via page_offset and page_size.
Returns total_count for UI counter display.
OPTIMIZED: Uses single CTE to call get_eligible_active_users_count once per place.';
