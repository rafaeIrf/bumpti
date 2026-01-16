-- ============================================================================
-- Atomic check and update with skip logic in SQL
-- ============================================================================
-- Single RPC that handles all logic:
-- 1. Check if city exists and lock
-- 2. Evaluate if should skip (processing, fresh)
-- 3. Update status if should proceed
-- All in one atomic transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_lock_city_for_hydration(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION
)
RETURNS TABLE (
  id uuid,
  city_name text,
  country_code text,
  status text,
  last_hydrated_at timestamptz,
  bbox jsonb,
  should_hydrate boolean,
  skip_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  city_record RECORD;
  should_proceed boolean := FALSE;
  reason text := NULL;
  days_since_hydration integer;
  revalidation_days constant integer := 60;
BEGIN
  -- Find city with lock (lock held until transaction commits)
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
  FOR UPDATE;  -- Lock acquired here
  
  -- If no city found, return null
  IF city_record.id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if already processing
  IF city_record.status = 'processing' THEN
    reason := 'already_processing';
    should_proceed := FALSE;
  
  -- Check if completed and fresh
  ELSIF city_record.status = 'completed' AND city_record.last_hydrated_at IS NOT NULL THEN
    days_since_hydration := EXTRACT(DAY FROM (NOW() - city_record.last_hydrated_at));
    
    IF days_since_hydration <= revalidation_days THEN
      reason := 'fresh';
      should_proceed := FALSE;
    ELSE
      -- Stale, needs refresh
      reason := 'stale';
      should_proceed := TRUE;
    END IF;
  
  -- Failed, pending, or other status - needs hydration
  ELSE
    reason := 'needs_hydration';
    should_proceed := TRUE;
  END IF;
  
  -- Update status to processing if should proceed
  IF should_proceed THEN
    UPDATE cities_registry
    SET status = 'processing',
        updated_at = NOW()
    WHERE cities_registry.id = city_record.id;
    
    city_record.status := 'processing';
  END IF;
  
  -- Return city data with flags
  RETURN QUERY SELECT 
    city_record.id,
    city_record.city_name,
    city_record.country_code,
    city_record.status,
    city_record.last_hydrated_at,
    city_record.bbox,
    should_proceed,
    reason;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_lock_city_for_hydration(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, anon, service_role;

COMMENT ON FUNCTION check_and_lock_city_for_hydration IS 
'Atomically check city, evaluate skip logic, and update status.
All logic in single transaction with lock held throughout.
Returns should_hydrate=true only if city needs hydration.
Skip reasons: already_processing, fresh, stale, needs_hydration.';
