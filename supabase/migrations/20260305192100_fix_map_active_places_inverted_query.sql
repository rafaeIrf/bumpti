-- =============================================================================
-- Fix: get_map_active_places — inverted query strategy
-- =============================================================================
-- PROBLEM: The original implementation grabbed N random places within the radius
-- via an unordered LIMIT, then computed social-summary for each.
-- With 12k+ candidates and only a handful of socially active places, the LIMIT
-- almost never included the active ones → always returned empty.
--
-- FIX: Invert the approach — first find places that have any social signal
-- (active presences, plans, favorites, social hubs, past visitors),
-- then filter those by distance, then compute the full social summary
-- only for the filtered set.
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

  -- 1. Collect place IDs that have ANY social signal (union of all sources)
  socially_active_place_ids AS (
    -- Active presences (checked-in, detected, etc.)
    SELECT DISTINCT up.place_id AS pid
    FROM user_presences up
    WHERE up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()

    UNION

    -- Planned visits (next 7 days)
    SELECT DISTINCT up.place_id AS pid
    FROM user_presences up
    WHERE up.active = true
      AND up.entry_type IN ('planning', 'checkin_plus')
      AND up.planned_for BETWEEN CURRENT_DATE AND CURRENT_DATE + 6

    UNION

    -- Social hubs
    SELECT DISTINCT psh.place_id AS pid
    FROM profile_social_hubs psh
    WHERE psh.visible = true

    UNION

    -- Past visitors (last 30 days)
    SELECT DISTINCT up.place_id AS pid
    FROM user_presences up
    WHERE up.active = false
      AND up.entered_at > NOW() - INTERVAL '30 days'

    UNION

    -- University places
    SELECT DISTINCT p.university_id AS pid
    FROM profiles p
    WHERE p.university_id IS NOT NULL
  ),

  -- 2. Filter to only active places within the radius
  candidates AS (
    SELECT
      p.id, p.name, p.lat, p.lng, p.neighborhood, p.category
    FROM places p
    INNER JOIN socially_active_place_ids sa ON sa.pid = p.id
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),

  -- 3. Compute social summary per candidate (now a much smaller set)
  with_social AS (
    SELECT
      c.*,
      get_place_social_summary(c.id, requesting_user_id) AS social
    FROM candidates c
  )

  -- 4. Unpack, filter to only places with actual personalized activity, sort and cap
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

-- Permissions (same as before)
GRANT EXECUTE ON FUNCTION public.get_map_active_places(double precision, double precision, double precision, uuid, integer)
  TO authenticated, anon;

COMMENT ON FUNCTION public.get_map_active_places IS
'Returns places within radius_meters that have current social activity.
Inverted query strategy: first finds places with any social signal (presences,
plans, favorites, social hubs, past visitors, universities), then filters by
distance, then computes full social summary only for that reduced set.
Delegates counting/eligibility to get_place_social_summary().';
