-- =============================================================================
-- Migration: Add optimized RPCs for trending and favorite places
-- =============================================================================
-- This migration:
-- 1. Creates get_trending_places RPC (replaces 3 DB calls with 1)
-- 2. Creates get_user_favorite_places RPC (replaces 3 DB calls with 1)
-- 3. Both use get_eligible_active_users_count helper for consistent filtering

-- =============================================================================
-- PART 1: Create get_trending_places RPC
-- =============================================================================
-- Returns places with active users, sorted by active_users count descending
-- Used by get-trending-places Edge Function

CREATE OR REPLACE FUNCTION get_trending_places(
  user_lat float,
  user_lng float,
  radius_meters float default 50000,
  max_results int default 10,
  requesting_user_id uuid default null
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  lat float,
  lng float,
  street text,
  house_number text,
  city text,
  state text,
  country text,
  review_average float,
  review_count bigint,
  review_tags text[],
  dist_meters float,
  active_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.id,
    pv.name,
    pv.category,
    pv.lat,
    pv.lng,
    pv.street,
    pv.house_number,
    pv.city,
    pv.state,
    pv.country_code as country,
    pv.review_average,
    pv.review_count,
    pv.review_tags,
    st_distance(
      st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) AS dist_meters,
    get_eligible_active_users_count(pv.id, requesting_user_id) as active_users
  FROM places_view pv
  WHERE
    st_dwithin(
      st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND get_eligible_active_users_count(pv.id, requesting_user_id) > 0
  ORDER BY active_users DESC, dist_meters ASC
  LIMIT max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION get_trending_places(float, float, float, int, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_trending_places IS 
'Returns places with active eligible users, sorted by active_users count.
Uses get_eligible_active_users_count helper for consistent user filtering.
Replaces legacy 3-query pattern in get-trending-places Edge Function.';

-- =============================================================================
-- PART 2: Create get_user_favorite_places RPC
-- =============================================================================
-- Returns user's favorited places with active users count
-- Used by get-favorite-places Edge Function

CREATE OR REPLACE FUNCTION get_user_favorite_places(
  user_lat float,
  user_lng float,
  requesting_user_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  lat float,
  lng float,
  street text,
  house_number text,
  city text,
  state text,
  country text,
  review_average float,
  review_count bigint,
  review_tags text[],
  dist_meters float,
  active_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.id,
    pv.name,
    pv.category,
    pv.lat,
    pv.lng,
    pv.street,
    pv.house_number,
    pv.city,
    pv.state,
    pv.country_code as country,
    pv.review_average,
    pv.review_count,
    pv.review_tags,
    st_distance(
      st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) AS dist_meters,
    get_eligible_active_users_count(pv.id, requesting_user_id) as active_users
  FROM places_view pv
  INNER JOIN profile_favorite_places pfp ON pfp.place_id = pv.id
  WHERE pfp.user_id = requesting_user_id
  ORDER BY dist_meters ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_favorite_places(float, float, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_user_favorite_places IS 
'Returns user favorited places with active users count.
Uses get_eligible_active_users_count helper for consistent user filtering.
Replaces legacy 3-query pattern in get-favorite-places Edge Function.';
