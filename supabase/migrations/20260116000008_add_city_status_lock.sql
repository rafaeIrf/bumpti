-- ============================================================================
-- Add FOR UPDATE lock to check_city_by_coordinates RPC
-- ============================================================================
-- Consolidates lock logic into existing RPC instead of creating new one
-- Atomically updates status to 'processing' when hydration should proceed
-- ============================================================================

CREATE OR REPLACE FUNCTION check_city_by_coordinates(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  should_update_status BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id uuid,
  city_name text,
  country_code text,
  status text,
  last_hydrated_at timestamptz,
  bbox jsonb,
  status_updated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  city_record RECORD;
  updated boolean := FALSE;
BEGIN
  -- Find city with lock
  SELECT 
    c.id,
    c.city_name,
    c.country_code,
    c.status,
    c.last_hydrated_at,
    c.bbox
  INTO city_record
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
  FOR UPDATE;  -- Acquires exclusive row lock
  
  -- If city found and should update status
  IF city_record.id IS NOT NULL AND should_update_status THEN
    -- Update status to processing if not already processing or completed+fresh
    IF city_record.status != 'processing' THEN
      UPDATE cities_registry
      SET status = 'processing',
          updated_at = NOW()
      WHERE cities_registry.id = city_record.id;
      
      updated := TRUE;
      city_record.status := 'processing';  -- Update local record
    END IF;
  END IF;
  
  -- Return city data
  IF city_record.id IS NOT NULL THEN
    RETURN QUERY SELECT 
      city_record.id,
      city_record.city_name,
      city_record.country_code,
      city_record.status,
      city_record.last_hydrated_at,
      city_record.bbox,
      updated;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_city_by_coordinates(DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN) TO authenticated, anon, service_role;

COMMENT ON FUNCTION check_city_by_coordinates IS 
'Check if coordinates fall within any city bbox and optionally update status to processing.
When should_update_status=true, atomically sets status to processing within locked transaction.
This prevents race conditions where multiple requests trigger hydration for same city.';
