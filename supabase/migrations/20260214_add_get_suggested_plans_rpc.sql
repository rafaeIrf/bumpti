-- =============================================================================
-- Migration: Add get_suggested_plans RPC
-- =============================================================================
-- Returns today's plan suggestions grouped by place within a 50km radius.
-- Also returns total_unique_users for social proof in PlanHero.
-- Uses ST_DWithin for efficient spatial filtering (same pattern as get_trending_places).

CREATE OR REPLACE FUNCTION get_suggested_plans(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision DEFAULT 50000,
  requesting_user_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  place_id uuid,
  name text,
  category text,
  lat double precision,
  lng double precision,
  plan_count bigint,
  dist_meters double precision,
  total_unique_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH today_plans AS (
    SELECT
      up.user_id,
      up.place_id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM user_presences up
    JOIN places p ON p.id = up.place_id
    WHERE
      up.entry_type = 'planning'
      AND up.active = true
      AND up.planned_for = CURRENT_DATE
      AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  unique_total AS (
    SELECT COUNT(DISTINCT tp.user_id)::bigint AS cnt FROM today_plans tp
  ),
  grouped AS (
    SELECT
      tp.place_id,
      tp.name,
      tp.category,
      tp.lat,
      tp.lng,
      COUNT(*)::bigint AS plan_count,
      MIN(tp.dist_meters) AS dist_meters
    FROM today_plans tp
    GROUP BY tp.place_id, tp.name, tp.category, tp.lat, tp.lng
  )
  SELECT
    g.place_id,
    g.name,
    g.category,
    g.lat,
    g.lng,
    g.plan_count,
    g.dist_meters,
    (SELECT cnt FROM unique_total) AS total_unique_users
  FROM grouped g
  ORDER BY g.plan_count DESC, g.dist_meters ASC
  LIMIT 10;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_suggested_plans(double precision, double precision, double precision, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_suggested_plans IS
'Returns today''s plan suggestions grouped by place within radius (default 50km).
Uses ST_DWithin for spatial filtering.
Returns total_unique_users count for social proof.';
