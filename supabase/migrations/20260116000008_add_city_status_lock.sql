-- ============================================================================
-- Simplify check_city_by_coordinates - just check, don't update
-- ============================================================================
-- Separate concerns: checking vs updating
-- Add dedicated update_city_status_to_processing function
-- ============================================================================

-- 1. Simplify check to just return city data with lock
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
  FOR UPDATE;  -- Lock to prevent race conditions
END;
$$;

-- 2. Add dedicated function to update status to processing
CREATE OR REPLACE FUNCTION update_city_status_to_processing(
  city_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_status text;
BEGIN
  -- Get current status with lock
  SELECT status INTO current_status
  FROM cities_registry
  WHERE id = city_id
  FOR UPDATE;
  
  -- Only update if not already processing
  IF current_status != 'processing' THEN
    UPDATE cities_registry
    SET status = 'processing',
        updated_at = NOW()
    WHERE cities_registry.id = city_id;
    
    RETURN TRUE;  -- Status was updated
  END IF;
  
  RETURN FALSE;  -- Status was already processing
END;
$$;

GRANT EXECUTE ON FUNCTION check_city_by_coordinates(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_city_status_to_processing(uuid) TO authenticated, anon, service_role;

COMMENT ON FUNCTION check_city_by_coordinates IS 
'Check if coordinates fall within any city bbox and acquire row lock.
Returns city data. Lock prevents concurrent operations on same city.';

COMMENT ON FUNCTION update_city_status_to_processing IS 
'Atomically update city status to processing if not already processing.
Returns true if updated, false if already processing.
Must be called after check_city_by_coordinates to maintain lock.';
