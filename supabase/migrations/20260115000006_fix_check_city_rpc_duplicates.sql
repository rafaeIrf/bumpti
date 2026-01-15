-- Fix check_city_by_coordinates to prevent duplicate workflows
-- Include 'processing' status to catch cities currently being hydrated

CREATE OR REPLACE FUNCTION check_city_by_coordinates(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  city_name TEXT,
  country_code CHAR(2),
  geom GEOMETRY(MultiPolygon, 4326),
  bbox DOUBLE PRECISION[],
  status TEXT,
  last_hydrated_at TIMESTAMPTZ,
  priority_score INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.city_name,
    cr.country_code,
    cr.geom,
    cr.bbox,
    cr.status,
    cr.last_hydrated_at,
    cr.priority_score,
    cr.error_message,
    cr.created_at,
    cr.updated_at
  FROM cities_registry cr
  WHERE cr.status IN ('completed', 'processing')  -- Prevent duplicate workflows
    AND ST_Contains(cr.geom, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326))
  LIMIT 1;
END;
$$;
