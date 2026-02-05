-- =============================================================================
-- Migration: Add Bidirectional Gender Filter to Place Activity Notifications
-- =============================================================================
-- Purpose: Only send activity notifications when there are gender-compatible 
--          users at the location.
-- 
-- We only filter by gender compatibility, NOT by other interactions (blocks,
-- likes, dislikes, matches) because:
-- - User should know there's activity even if they've interacted with some users
-- - The full eligibility filter is applied when they view the place
-- 
-- Gender Filter Logic (Bidirectional):
-- RULE 1: At least one active user must want to connect with MY gender
-- RULE 2: I must want to connect with at least one active user's gender
-- =============================================================================

-- Drop existing function first because we're changing the logic
DROP FUNCTION IF EXISTS public.get_place_activity_candidates();

CREATE OR REPLACE FUNCTION "public"."get_place_activity_candidates"()
RETURNS TABLE(
  target_user_id uuid,
  notification_type text,
  target_place_id uuid,
  target_place_name text,
  active_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  ttl_started INT := 24;  -- Hours before re-sending "started" notification
  ttl_heating INT := 6;   -- Hours before re-sending "heating" notification
  ttl_nearby INT := 12;   -- Hours before re-sending "nearby" notification
  distance_threshold FLOAT := 30000; -- 30km in meters
  location_staleness_hours INT := 24; -- Location data must be fresher than 24h
BEGIN
  RETURN QUERY

  -- CTE: Active users at places with their gender
  WITH active_presences AS (
    SELECT 
      up.place_id,
      up.user_id,
      p.name AS place_name,
      p.lat,
      p.lng,
      p.city,
      prof.gender_id
    FROM user_presences up
    JOIN places p ON p.id = up.place_id
    JOIN profiles prof ON prof.id = up.user_id
    WHERE up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
  ),
  -- Count per place (raw)
  active_counts AS (
    SELECT 
      ap.place_id,
      ap.place_name,
      ap.lat,
      ap.lng,
      ap.city,
      COUNT(*)::integer AS count
    FROM active_presences ap
    GROUP BY ap.place_id, ap.place_name, ap.lat, ap.lng, ap.city
  )

  -- 1. FAVORITE STARTED (Count 1-2, activity starting)
  SELECT 
    fav.user_id AS target_user_id,
    'favorite_activity_started'::text AS notification_type,
    ac.place_id AS target_place_id,
    ac.place_name AS target_place_name,
    ac.count AS active_count
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count >= 1 AND ac.count < 3
  -- Exclude if target is currently at this place
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
  )
  -- BIDIRECTIONAL GENDER FILTER
  -- RULE 1: At least one active user wants to connect with MY gender
  AND EXISTS (
    SELECT 1 
    FROM active_presences ap
    JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
    JOIN profiles target_prof ON target_prof.id = fav.user_id
    WHERE ap.place_id = ac.place_id
      AND pcw.gender_id = target_prof.gender_id
  )
  -- RULE 2: I want to connect with at least one active user's gender
  AND EXISTS (
    SELECT 1 
    FROM active_presences ap
    JOIN profile_connect_with pcw ON pcw.user_id = fav.user_id
    WHERE ap.place_id = ac.place_id
      AND pcw.gender_id = ap.gender_id
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
    ac.place_name AS target_place_name,
    ac.count AS active_count
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count >= 3
  -- Exclude if target is currently at this place
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
  )
  -- BIDIRECTIONAL GENDER FILTER
  AND EXISTS (
    SELECT 1 
    FROM active_presences ap
    JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
    JOIN profiles target_prof ON target_prof.id = fav.user_id
    WHERE ap.place_id = ac.place_id
      AND pcw.gender_id = target_prof.gender_id
  )
  AND EXISTS (
    SELECT 1 
    FROM active_presences ap
    JOIN profile_connect_with pcw ON pcw.user_id = fav.user_id
    WHERE ap.place_id = ac.place_id
      AND pcw.gender_id = ap.gender_id
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

  -- 3. NEARBY STARTED (Max 1 per user, Count 1-2, Within 30km radius)
  SELECT
    sub.target_user_id,
    'nearby_activity_started'::text AS notification_type,
    sub.target_place_id,
    sub.target_place_name,
    sub.active_count
  FROM (
    SELECT
      prof.id AS target_user_id,
      ac.place_id AS target_place_id,
      ac.place_name AS target_place_name,
      ac.count AS active_count,
      ROW_NUMBER() OVER (PARTITION BY prof.id ORDER BY ac.count DESC) AS rn
    FROM active_counts ac
    CROSS JOIN profiles prof
    WHERE ac.count >= 1 AND ac.count < 3
    -- User must have recent location data
    AND prof.last_lat IS NOT NULL
    AND prof.last_lng IS NOT NULL
    AND prof.last_location_updated_at IS NOT NULL
    AND prof.last_location_updated_at > NOW() - (location_staleness_hours || ' hours')::interval
    -- Distance check: within 30km
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
    -- BIDIRECTIONAL GENDER FILTER
    AND EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = prof.gender_id
    )
    AND EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = prof.id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = ap.gender_id
    )
    -- TTL Check
    AND NOT EXISTS (
      SELECT 1 FROM notification_events ne
      WHERE ne.user_id = prof.id
      AND ne.place_id = ac.place_id
      AND ne.type = 'nearby_activity_started'
      AND ne.created_at > NOW() - (ttl_nearby || ' hours')::interval
    )
  ) sub
  WHERE sub.rn = 1

  UNION ALL

  -- 4. NEARBY HEATING (Max 1 per user, Count >= 3, Within 30km radius)
  SELECT
    sub.target_user_id,
    'nearby_activity_heating'::text AS notification_type,
    sub.target_place_id,
    sub.target_place_name,
    sub.active_count
  FROM (
    SELECT
      prof.id AS target_user_id,
      ac.place_id AS target_place_id,
      ac.place_name AS target_place_name,
      ac.count AS active_count,
      ROW_NUMBER() OVER (PARTITION BY prof.id ORDER BY ac.count DESC) AS rn
    FROM active_counts ac
    CROSS JOIN profiles prof
    WHERE ac.count >= 3
    -- User must have recent location data
    AND prof.last_lat IS NOT NULL
    AND prof.last_lng IS NOT NULL
    AND prof.last_location_updated_at IS NOT NULL
    AND prof.last_location_updated_at > NOW() - (location_staleness_hours || ' hours')::interval
    -- Distance check: within 30km
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
    -- BIDIRECTIONAL GENDER FILTER
    AND EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = prof.gender_id
    )
    AND EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = prof.id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = ap.gender_id
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
  'Returns candidates for place activity notifications with bidirectional gender filter.
   Only notifies users when there are gender-compatible users at the location.
   Does NOT filter by other interactions (blocks, likes, etc) - user should know
   about activity even if they have interacted with some users.';
