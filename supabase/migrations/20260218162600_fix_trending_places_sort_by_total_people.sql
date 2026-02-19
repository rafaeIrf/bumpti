-- =============================================================================
-- Fix: get_trending_places — order by total people (active + regulars)
-- =============================================================================
-- Problem: ORDER BY active_users_count DESC, regulars_cnt DESC sorts by each
--   column independently. A place with 0 active + 2 regulars can appear after
--   a place with 0 active + 1 regular only if regulars_cnt is correct, but
--   the visual result shows 1F, 1F, 2F, 2F — meaning the sort is not working
--   as expected. The fix: use (active_users_count + regulars_cnt) as the
--   primary sort key so total people count drives the ranking.
-- =============================================================================

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
  safe_offset int := GREATEST(page_offset, 0);
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
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users_count,
      get_regulars_count_at_place(p.id, requesting_user_id) as regulars_cnt
    FROM places p
    WHERE p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  -- Cold start fix: include places with active users OR regulars
  trending_places AS (
    SELECT * FROM all_places_with_counts
    WHERE active_users_count > 0 OR regulars_cnt > 0
  ),
  total AS (
    SELECT COUNT(*)::bigint as cnt FROM trending_places
  ),
  limited_places AS (
    SELECT * FROM trending_places
    -- Sort by total people (active + regulars) DESC, then distance ASC
    ORDER BY (active_users_count + regulars_cnt) DESC, active_users_count DESC, dist_meters ASC
    LIMIT safe_page_size OFFSET safe_offset
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
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    wr.active_users_count as active_users,
    -- Combined: active user avatars first, regulars as fallback
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url))
       FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a),
      get_regulars_avatars_at_place(wr.id, requesting_user_id, 5)
    ) as preview_avatars,
    (SELECT cnt FROM total) as total_count,
    wr.regulars_cnt as regulars_count
  FROM with_reviews wr
  -- Maintain same order in final output
  ORDER BY (wr.active_users_count + wr.regulars_cnt) DESC, wr.active_users_count DESC, wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_trending_places(double precision, double precision, double precision, uuid, integer, integer) TO authenticated, anon;
