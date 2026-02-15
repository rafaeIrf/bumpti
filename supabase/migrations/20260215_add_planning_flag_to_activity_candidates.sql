-- =============================================================================
-- Migration: Add has_planning flag to place activity candidates
-- =============================================================================
-- Differentiates notification copy for planning vs check-in activity.
-- Adds `has_planning` boolean to the return set of get_place_activity_candidates.
-- When true, the edge function sends planning-specific notification copy.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_place_activity_candidates();

CREATE OR REPLACE FUNCTION "public"."get_place_activity_candidates"()
RETURNS TABLE(
  target_user_id uuid,
  notification_type text,
  target_place_id uuid,
  target_place_name text,
  active_count integer,
  has_planning boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  ttl_started INT := 24;  -- Hours before re-sending "started" notification
  ttl_heating INT := 6;   -- Hours before re-sending "heating" notification
  ttl_nearby INT := 12;   -- Hours before re-sending "nearby" notification
  distance_threshold FLOAT := 30000; -- 30km in meters
BEGIN
  RETURN QUERY

  -- CTE: Active users at places with their gender and entry type
  WITH active_presences AS (
    SELECT 
      up.place_id,
      up.user_id,
      p.name AS place_name,
      p.lat,
      p.lng,
      p.city,
      prof.gender_id,
      up.entry_type
    FROM user_presences up
    JOIN places p ON p.id = up.place_id
    JOIN profiles prof ON prof.id = up.user_id
    WHERE up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
  ),
  -- Count per place (raw) + planning flag
  active_counts AS (
    SELECT 
      ap.place_id,
      ap.place_name,
      ap.lat,
      ap.lng,
      ap.city,
      COUNT(*)::integer AS count,
      BOOL_OR(ap.entry_type = 'planning') AS has_planning
    FROM active_presences ap
    GROUP BY ap.place_id, ap.place_name, ap.lat, ap.lng, ap.city
  )

  -- 1. FAVORITE STARTED (Count 1-2, activity starting)
  SELECT 
    fav.user_id AS target_user_id,
    'favorite_activity_started'::text AS notification_type,
    ac.place_id AS target_place_id,
    ac.place_name AS target_place_name,
    ac.count AS active_count,
    ac.has_planning
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count = 1
  -- Exclude if target is currently at this place
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
  )
  -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
  AND (
    EXISTS (
      SELECT 1 FROM active_presences ap
      WHERE ap.place_id = ac.place_id
        AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
    )
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
      JOIN profiles target_prof ON target_prof.id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = target_prof.gender_id
    )
  )
  AND (
    NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = fav.user_id)
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = ap.gender_id
    )
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

  -- 2. FAVORITE HEATING (Count >= 2)
  SELECT 
    fav.user_id AS target_user_id,
    'favorite_activity_heating'::text AS notification_type,
    ac.place_id AS target_place_id,
    ac.place_name AS target_place_name,
    ac.count AS active_count,
    ac.has_planning
  FROM active_counts ac
  JOIN profile_favorite_places fav ON fav.place_id = ac.place_id
  WHERE ac.count >= 2
  -- Exclude if target is currently at this place
  AND NOT EXISTS (
    SELECT 1 FROM user_presences up_check 
    WHERE up_check.user_id = fav.user_id 
    AND up_check.place_id = ac.place_id 
    AND up_check.active = true
  )
  -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
  AND (
    EXISTS (
      SELECT 1 FROM active_presences ap
      WHERE ap.place_id = ac.place_id
        AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
    )
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
      JOIN profiles target_prof ON target_prof.id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = target_prof.gender_id
    )
  )
  AND (
    NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = fav.user_id)
    OR EXISTS (
      SELECT 1 
      FROM active_presences ap
      JOIN profile_connect_with pcw ON pcw.user_id = fav.user_id
      WHERE ap.place_id = ac.place_id
        AND pcw.gender_id = ap.gender_id
    )
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
    sub.active_count,
    sub.has_planning
  FROM (
    SELECT
      prof.id AS target_user_id,
      ac.place_id AS target_place_id,
      ac.place_name AS target_place_name,
      ac.count AS active_count,
      ac.has_planning,
      ROW_NUMBER() OVER (PARTITION BY prof.id ORDER BY ac.count DESC) AS rn
    FROM active_counts ac
    CROSS JOIN profiles prof
    WHERE ac.count = 1
    -- User must have recent location data
    AND prof.last_lat IS NOT NULL
    AND prof.last_lng IS NOT NULL
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
    -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
    AND (
      EXISTS (
        SELECT 1 FROM active_presences ap
        WHERE ap.place_id = ac.place_id
          AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
      )
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = prof.gender_id
      )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = prof.id)
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = prof.id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = ap.gender_id
      )
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
    sub.active_count,
    sub.has_planning
  FROM (
    SELECT
      prof.id AS target_user_id,
      ac.place_id AS target_place_id,
      ac.place_name AS target_place_name,
      ac.count AS active_count,
      ac.has_planning,
      ROW_NUMBER() OVER (PARTITION BY prof.id ORDER BY ac.count DESC) AS rn
    FROM active_counts ac
    CROSS JOIN profiles prof
    WHERE ac.count >= 2
    -- User must have recent location data
    AND prof.last_lat IS NOT NULL
    AND prof.last_lng IS NOT NULL
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
    -- BIDIRECTIONAL GENDER FILTER (NULL-safe)
    AND (
      EXISTS (
        SELECT 1 FROM active_presences ap
        WHERE ap.place_id = ac.place_id
          AND NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = ap.user_id)
      )
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = ap.user_id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = prof.gender_id
      )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = prof.id)
      OR EXISTS (
        SELECT 1 
        FROM active_presences ap
        JOIN profile_connect_with pcw ON pcw.user_id = prof.id
        WHERE ap.place_id = ac.place_id
          AND pcw.gender_id = ap.gender_id
      )
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
