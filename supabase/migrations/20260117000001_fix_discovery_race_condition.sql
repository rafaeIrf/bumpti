-- ============================================================================
-- Fix race condition: Discovery locks for non-existent cities
-- ============================================================================
-- PROBLEM: When city doesn't exist, check_and_lock_city returns NULL
--          Multiple requests dispatch hydration workflows simultaneously
-- SOLUTION: Create pending city record to acquire lock
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
  bbox double precision[],
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
      c.bbox[1],  -- min_lng
      c.bbox[2],  -- min_lat
      c.bbox[3],  -- max_lng
      c.bbox[4],  -- max_lat
      4326
    ),
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
  )
  LIMIT 1
  FOR UPDATE;  -- Lock acquired here
  
  -- ========================================================================
  -- FIX: If no city found, create pending record to acquire lock
  -- ========================================================================
  IF city_record.id IS NULL THEN
    -- Create temporary pending city record
    -- This prevents race condition for discovery
    INSERT INTO cities_registry (
      city_name,
      country_code,
      status,
      bbox,
      lat,
      lng
    ) VALUES (
      'Pending Discovery',  -- Placeholder name
      'XX',                 -- Placeholder country
      'discovering',        -- Special status
      ARRAY[user_lng - 0.5, user_lat - 0.5, user_lng + 0.5, user_lat + 0.5],  -- Wide bbox
      user_lat,
      user_lng
    )
    ON CONFLICT DO NOTHING  -- If another request created it, skip
    RETURNING id, city_name, country_code, status, last_hydrated_at, bbox
    INTO city_record;
    
    -- If INSERT was successful, we won the race
    IF city_record.id IS NOT NULL THEN
      should_proceed := TRUE;
      reason := 'new_territory';
    ELSE
      -- Another request created it, retry lock
      SELECT 
        c.id,
        c.city_name,
        c.country_code,
        c.status,
        c.last_hydrated_at,
        c.bbox
      INTO city_record
      FROM cities_registry c
      WHERE c.status = 'discovering'
        AND ST_Distance(
          ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) < 50000  -- 50km radius
      LIMIT 1
      FOR UPDATE;
      
      IF city_record.id IS NOT NULL THEN
        should_proceed := FALSE;
        reason := 'already_processing';  -- Unified with line 112
      END IF;
    END IF;
  
  -- Check if already processing
  ELSIF city_record.status = 'processing' OR city_record.status = 'discovering' THEN
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
    should_proceed := TRUE;
    reason := 'needs_hydration';
  END IF;
  
  -- If should proceed, update status to processing
  IF should_proceed THEN
    UPDATE cities_registry
    SET 
      status = 'processing',
      updated_at = NOW()
    WHERE id = city_record.id;
  END IF;
  
  -- Return result
  RETURN QUERY SELECT
    city_record.id,
    city_record.city_name,
    city_record.country_code,
    city_record.status,
    city_record.last_hydrated_at,
    city_record.bbox,
    should_proceed as should_hydrate,
    reason as skip_reason;
END;
$$;

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON FUNCTION check_and_lock_city_for_hydration IS
'Atomic check and lock for city hydration.
FIX: Creates pending discovery record if city not found to prevent race condition.
Only first request for new territory gets should_hydrate=true.';
