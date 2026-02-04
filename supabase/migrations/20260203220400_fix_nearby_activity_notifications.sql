-- =============================================================================
-- Migration: Update Nearby Activity to Use Last Known Location
-- =============================================================================
-- Purpose: Use profiles.last_lat/last_lng instead of check-in history
-- Benefits: Simpler query, works for all users, real-time location
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."get_place_activity_candidates"() 
RETURNS TABLE("target_user_id" "uuid", "notification_type" "text", "target_place_id" "uuid", "target_place_name" "text")
LANGUAGE "plpgsql" 
SECURITY DEFINER
AS $$
DECLARE
  -- TTL Definitions (Hours)
  ttl_started int := 3;
  ttl_heating int := 3;
  ttl_nearby int := 3;
  -- Distance threshold in meters (30km)
  distance_threshold numeric := 30000;
  -- Location staleness threshold (hours) - ignore locations older than this
  location_staleness_hours int := 24;
BEGIN
  RETURN QUERY
  WITH active_counts AS (
    SELECT 
      up.place_id, 
      p.name AS place_name, 
      p.lat, 
      p.lng,
      p.city,
      COUNT(*) AS count 
    FROM user_presences up
    JOIN places p ON p.id = up.place_id
    WHERE up.active = true
    GROUP BY up.place_id, p.name, p.lat, p.lng, p.city
  )
  -- 1. FAVORITE STARTED (Count >= 1)
  SELECT 
    fav.user_id AS target_user_id,
    'favorite_activity_started'::text AS notification_type,
    ac.place_id AS target_place_id,
    ac.place_name AS target_place_name
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count >= 1
  -- User must NOT be currently active at this place
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
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
    ac.place_name AS target_place_name
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count >= 3
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
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

  -- 3. NEARBY HEATING (Max 1 per user, Count >= 1, Within 30km radius)
  -- Uses last known location from profiles (updated by mobile app)
  SELECT
    sub.target_user_id,
    'nearby_activity_heating'::text AS notification_type,
    sub.target_place_id,
    sub.target_place_name
  FROM (
    SELECT
      prof.id AS target_user_id,
      ac.place_id AS target_place_id,
      ac.place_name AS target_place_name,
      -- Calculate distance in meters using PostGIS
      ST_Distance(
        ST_SetSRID(ST_MakePoint(prof.last_lng, prof.last_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(ac.lng, ac.lat), 4326)::geography
      ) AS distance_meters,
      ROW_NUMBER() OVER (PARTITION BY prof.id ORDER BY ac.count DESC) AS rn
    FROM active_counts ac
    CROSS JOIN profiles prof
    WHERE ac.count >= 1
    -- User must have recent location data
    AND prof.last_lat IS NOT NULL 
    AND prof.last_lng IS NOT NULL
    AND prof.last_location_updated_at IS NOT NULL
    AND prof.last_location_updated_at > NOW() - (location_staleness_hours || ' hours')::interval
    -- Distance check: within 30km using spatial index
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

COMMENT ON FUNCTION "public"."get_place_activity_candidates"() IS 
  'Returns candidates for place activity notifications. Nearby heating uses last known location from profiles (within 30km, updated in last 24h).';
