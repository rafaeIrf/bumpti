-- ============================================================================
-- Create RPC function to get city status with row-level lock
-- ============================================================================
-- This prevents race conditions when multiple requests check the same city
-- Uses SELECT ... FOR UPDATE to acquire exclusive lock on the row
-- ============================================================================

CREATE OR REPLACE FUNCTION get_city_status_with_lock(city_id uuid)
RETURNS TABLE (
  id uuid,
  city_name text,
  country_code text,
  status text,
  last_hydrated_at timestamptz
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
    c.last_hydrated_at
  FROM cities_registry c
  WHERE c.id = city_id
  FOR UPDATE;  -- Acquires exclusive row lock
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_city_status_with_lock(uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_city_status_with_lock IS 
'Get city status with row-level lock to prevent concurrent hydration triggers. 
Lock is held until transaction commits or rolls back.';
