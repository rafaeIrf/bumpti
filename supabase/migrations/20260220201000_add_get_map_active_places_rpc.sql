-- =============================================================================
-- Migration: get_map_active_places — places with activity for the map view
-- =============================================================================
-- Delegates all counting/eligibility logic to get_place_social_summary(),
-- which internally calls:
--   • get_eligible_active_users_count()  (personalized active users)
--   • get_regulars_count_at_place()       (personalized regulars)
--   • get_planning_count_at_place()       (raw planning social-proof)
--   • get_combined_place_avatars()        (active + regular avatars, deduped)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_map_active_places(
  user_lat           double precision,
  user_lng           double precision,
  radius_meters      double precision DEFAULT 50000,
  requesting_user_id uuid             DEFAULT NULL::uuid,
  max_places         integer          DEFAULT 100
)
RETURNS TABLE(
  id              uuid,
  name            text,
  lat             double precision,
  lng             double precision,
  neighborhood    text,
  category        text,
  active_users    bigint,
  planning_count  integer,
  regulars_count  integer,
  preview_avatars jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $function$
BEGIN
  RETURN QUERY
  WITH

  -- 1. Candidate places within radius (over-fetch to allow activity filtering)
  candidates AS (
    SELECT
      p.id, p.name, p.lat, p.lng, p.neighborhood, p.category
    FROM places p
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
    LIMIT max_places * 3
  ),

  -- 2. Fetch social summary per place (delegates to existing helpers)
  with_social AS (
    SELECT
      c.*,
      get_place_social_summary(c.id, requesting_user_id) AS social
    FROM candidates c
  )

  -- 3. Unpack JSONB, filter to only places with activity, sort and cap
  SELECT
    ws.id,
    ws.name,
    ws.lat,
    ws.lng,
    ws.neighborhood,
    ws.category,
    COALESCE((ws.social->>'active_count')::bigint,   0) AS active_users,
    COALESCE((ws.social->>'planning_count')::integer, 0) AS planning_count,
    COALESCE((ws.social->>'regulars_count')::integer, 0) AS regulars_count,
    COALESCE(ws.social->'avatars', '[]'::jsonb)          AS preview_avatars
  FROM with_social ws
  WHERE
    COALESCE((ws.social->>'active_count')::int,   0) > 0
    OR COALESCE((ws.social->>'planning_count')::int, 0) > 0
    OR COALESCE((ws.social->>'regulars_count')::int, 0) > 0
  ORDER BY
    COALESCE((ws.social->>'active_count')::int,   0) DESC,
    COALESCE((ws.social->>'planning_count')::int, 0) DESC,
    COALESCE((ws.social->>'regulars_count')::int, 0) DESC
  LIMIT max_places;

END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_map_active_places(double precision, double precision, double precision, uuid, integer)
  TO authenticated, anon;

COMMENT ON FUNCTION public.get_map_active_places IS
'Returns places within radius_meters that have current activity. Delegates all
eligibility/counting logic to get_place_social_summary(), which in turn calls
get_eligible_active_users_count(), get_regulars_count_at_place(),
get_planning_count_at_place(), and get_combined_place_avatars().';
