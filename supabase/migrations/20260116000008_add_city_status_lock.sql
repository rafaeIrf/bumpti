-- ============================================================================
-- Add FOR UPDATE lock to check_city_by_coordinates RPC
-- ============================================================================
-- Consolidates lock logic into existing RPC instead of creating new one
-- Prevents race conditions when checking city status
-- ============================================================================

CREATE OR REPLACE FUNCTION check_city_by_coordinates(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION
)
RETURNS TABLE (
  id uuid,
  city_name text,
  country_code text,
  status text,
  last_hydrated_at timestamptz,
  bbox jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.city_name,
    c.country_code,
    c.status,
    c.last_hydrated_at,
    c.bbox
  FROM cities_registry c
  WHERE ST_Contains(
    ST_MakeEnvelope(
      (c.bbox->>'min_lng')::float,
      (c.bbox->>'min_lat')::float,
      (c.bbox->>'max_lng')::float,
      (c.bbox->>'max_lat')::float,
      4326
    ),
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
  )
  LIMIT 1
  FOR UPDATE;  -- Acquires exclusive row lock to prevent race conditions
END;
$$;

GRANT EXECUTE ON FUNCTION check_city_by_coordinates(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, anon, service_role;

COMMENT ON FUNCTION check_city_by_coordinates IS 
'Check if coordinates fall within any city bbox and acquire row lock.
Lock prevents concurrent hydration triggers for the same city.';
