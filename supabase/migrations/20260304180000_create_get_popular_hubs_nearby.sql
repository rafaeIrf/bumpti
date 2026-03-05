-- =============================================================================
-- Migration: Create get_popular_hubs_nearby RPC
-- =============================================================================
-- Returns the most popular places from profile_social_hubs within a 50km
-- radius of the requesting user, ordered by how many users selected each place.
-- Excludes places the requesting user already has as their own social hubs.
-- Uses PostGIS ST_DWithin for efficient spatial filtering.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_popular_hubs_nearby(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  requesting_user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  street TEXT,
  city TEXT,
  user_count BIGINT,
  dist_km DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.category,
    p.lat,
    p.lng,
    p.street,
    p.city,
    COUNT(DISTINCT sh.user_id) AS user_count,
    ROUND(
      (ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) / 1000)::NUMERIC, 2
    )::DOUBLE PRECISION AS dist_km
  FROM profile_social_hubs sh
  INNER JOIN places p ON p.id = sh.place_id
  WHERE
    sh.user_id <> requesting_user_id
    AND p.active = TRUE
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      50000  -- 50km in meters
    )
  GROUP BY p.id, p.name, p.category, p.lat, p.lng, p.street, p.city
  ORDER BY user_count DESC, dist_km ASC
  LIMIT 20;
$$;
