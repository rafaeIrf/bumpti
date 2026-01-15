-- Function to find existing city by coordinates
-- Used by edge function to prevent duplicate city entries

CREATE OR REPLACE FUNCTION find_city_by_coordinates(
  search_lat DOUBLE PRECISION,
  search_lng DOUBLE PRECISION,
  tolerance_meters DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  city_name TEXT,
  status TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.city_name,
    cr.status,
    cr.lat,
    cr.lng
  FROM cities_registry cr
  WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(cr.lng, cr.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
    tolerance_meters
  )
  ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(cr.lng, cr.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
  ) ASC
  LIMIT 1;
END;
$$;
