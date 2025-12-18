-- RPC for Autocomplete finding places by text and location
-- Supports partial matching on name and distance filtering
DROP FUNCTION IF EXISTS search_places_autocomplete(text, float, float, float, int);

-- Enable unaccent extension if not exists
CREATE EXTENSION IF NOT EXISTS unaccent;

create or replace function search_places_autocomplete(
  query_text text,
  user_lat float default null,
  user_lng float default null,
  radius_meters float default 50000, -- Default 50km
  max_results int default 10
)
returns table (
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
  dist_meters float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.category,
    p.lat,
    p.lng,
    p.street,
    p.house_number,
    p.city,
    p.state,
    p.country_code as country, -- mapping country_code to country for consistency
    case 
      when user_lat is not null and user_lng is not null then
        st_distance(
          st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
          st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
        )
      else
        null::float
    end as dist_meters
  from places p
  where 
    -- Accent-insensitive text search using unaccent()
    unaccent(p.name) ilike '%' || unaccent(query_text) || '%'
    
    -- Location filter if coordinates provided
    and (
      user_lat is null or user_lng is null or
      st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
    )
  order by p.total_score desc
  limit max_results;
end;
$$;
