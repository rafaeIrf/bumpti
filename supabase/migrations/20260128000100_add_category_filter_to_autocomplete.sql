-- Add category filter to search_places_autocomplete RPC
-- This enables filtering autocomplete results by category (e.g., 'university' for Meu Campus feature)

-- Drop the existing function to recreate with new signature
DROP FUNCTION IF EXISTS public.search_places_autocomplete(text, double precision, double precision, double precision, integer, uuid);

-- Recreate with optional filter_categories parameter
CREATE OR REPLACE FUNCTION public.search_places_autocomplete(
  query_text text, 
  user_lat double precision DEFAULT NULL::double precision, 
  user_lng double precision DEFAULT NULL::double precision, 
  radius_meters double precision DEFAULT 50000, 
  max_results integer DEFAULT 10, 
  requesting_user_id uuid DEFAULT NULL::uuid,
  filter_categories text[] DEFAULT NULL::text[]  -- NEW: Optional category filter
)
RETURNS TABLE(
  id uuid, 
  name text, 
  category text, 
  lat double precision, 
  lng double precision, 
  street text, 
  house_number text, 
  city text, 
  state text, 
  country text, 
  active_users integer, 
  preview_avatars jsonb,
  dist_meters double precision, 
  relevance_score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  normalized_query text;
BEGIN
  normalized_query := immutable_unaccent(query_text);
  
  RETURN QUERY
  WITH matched_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.city,
      p.state,
      p.country_code as country,
      get_eligible_active_users_count(p.id, requesting_user_id)::integer as active_users,
      NULL::jsonb as preview_avatars,
      CASE
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
          st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          )
        ELSE NULL
      END AS dist_meters,
      (1.0 - (normalized_query <<-> immutable_unaccent(p.name))) * 100.0 as relevance_score
    FROM places p
    WHERE 
      p.active = true
      AND normalized_query <% immutable_unaccent(p.name)
      -- NEW: Filter by category if provided
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
      AND (
        user_lat IS NULL 
        OR user_lng IS NULL 
        OR st_dwithin(
          st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
          st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
          radius_meters
        )
      )
  )
  SELECT * FROM matched_places mp
  ORDER BY 
    mp.relevance_score DESC,
    mp.active_users DESC
  LIMIT max_results;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_places_autocomplete(text, double precision, double precision, double precision, integer, uuid, text[]) TO authenticated, anon;

COMMENT ON FUNCTION search_places_autocomplete IS 'Full text search for places with fuzzy matching, distance calculation, active users count, and optional category filter';
