-- =============================================================================
-- Migration: Add target_date parameter to get_suggested_plans
-- =============================================================================
-- Replaces CURRENT_DATE with a client-provided target_date parameter
-- to fix timezone issues (CURRENT_DATE uses UTC in Postgres).

-- Drop old overload (without target_date) to avoid ambiguity
DROP FUNCTION IF EXISTS get_suggested_plans(double precision, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION get_suggested_plans(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision DEFAULT 50000,
  requesting_user_id uuid DEFAULT NULL::uuid,
  target_date date DEFAULT CURRENT_DATE
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
      AND up.planned_for = target_date
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  unique_places AS (
    SELECT DISTINCT place_id FROM today_plans
  ),
  places_with_eligible_count AS (
    SELECT
      tp.place_id,
      tp.name,
      tp.category,
      tp.lat,
      tp.lng,
      MIN(tp.dist_meters) as dist_meters,
      get_eligible_active_users_count(tp.place_id, requesting_user_id) as plan_count
    FROM today_plans tp
    GROUP BY tp.place_id, tp.name, tp.category, tp.lat, tp.lng
  ),
  unique_total AS (
    SELECT SUM(pwec.plan_count)::bigint AS cnt 
    FROM places_with_eligible_count pwec
    WHERE pwec.plan_count > 0
  )
  SELECT
    pwec.place_id,
    pwec.name,
    pwec.category,
    pwec.lat,
    pwec.lng,
    pwec.plan_count,
    pwec.dist_meters,
    (SELECT cnt FROM unique_total) AS total_unique_users
  FROM places_with_eligible_count pwec
  WHERE pwec.plan_count > 0
  ORDER BY pwec.plan_count DESC, pwec.dist_meters ASC
  LIMIT 10;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_suggested_plans(double precision, double precision, double precision, uuid, date) TO authenticated, anon;
