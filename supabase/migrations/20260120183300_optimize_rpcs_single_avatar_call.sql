-- Optimize all RPCs to call get_active_users_with_avatars only once
-- Instead of calling both get_eligible_active_users_count and get_active_users_with_avatars

-- 1. Optimize search_places_nearby
DROP FUNCTION IF EXISTS public.search_places_nearby(double precision,double precision,double precision,text[],integer,uuid,text,double precision,integer,integer);

CREATE OR REPLACE FUNCTION public.search_places_nearby(
  user_lat double precision, 
  user_lng double precision, 
  radius_meters double precision, 
  filter_categories text[] DEFAULT NULL::text[], 
  max_results integer DEFAULT 60, 
  requesting_user_id uuid DEFAULT NULL::uuid, 
  sort_by text DEFAULT 'relevance'::text, 
  min_rating double precision DEFAULT NULL::double precision, 
  page_offset integer DEFAULT 0, 
  page_size integer DEFAULT 20
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
  relevance_score integer, 
  confidence double precision, 
  socials jsonb, 
  review_average double precision, 
  review_count integer, 
  review_tags text[], 
  total_checkins integer, 
  last_activity_at timestamp with time zone, 
  active_users bigint, 
  preview_avatars text[],
  dist_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  safe_offset int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
  max_limit int := GREATEST(max_results, 0);
  remaining int := max_limit - safe_offset;
  limit_amount int := LEAST(safe_page_size, GREATEST(remaining, 0));
BEGIN
  RETURN QUERY
  WITH places_with_users AS (
    SELECT
      pv.id,
      pv.name,
      pv.category,
      pv.lat,
      pv.lng,
      pv.street,
      pv.house_number,
      pv.city,
      pv.state,
      pv.country_code as country,
      pv.relevance_score,
      pv.confidence,
      pv.socials,
      pv.review_average,
      pv.review_count::integer as review_count,
      pv.review_tags,
      pv.total_checkins,
      pv.last_activity_at,
      st_distance(
        st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_active_users_with_avatars(pv.id, requesting_user_id, 5) as users_info
    FROM places_view pv
    WHERE
      st_dwithin(
        st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (filter_categories IS NULL OR lower(pv.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
      AND (min_rating IS NULL OR pv.review_average >= min_rating)
  )
  SELECT
    pwu.id,
    pwu.name,
    pwu.category,
    pwu.lat,
    pwu.lng,
    pwu.street,
    pwu.house_number,
    pwu.city,
    pwu.state,
    pwu.country,
    pwu.relevance_score,
    pwu.confidence,
    pwu.socials,
    pwu.review_average,
    pwu.review_count,
    pwu.review_tags,
    pwu.total_checkins,
    pwu.last_activity_at,
    (pwu.users_info).count as active_users,
    (pwu.users_info).avatars as preview_avatars,
    pwu.dist_meters
  FROM places_with_users pwu
  ORDER BY
    CASE WHEN sort_by = 'distance' THEN pwu.dist_meters END ASC,
    CASE WHEN sort_by = 'rating' THEN pwu.review_average END DESC,
    CASE WHEN sort_by = 'rating' THEN pwu.review_count END DESC,
    CASE WHEN sort_by = 'popularity' THEN pwu.total_checkins END DESC,
    CASE WHEN sort_by = 'popularity' THEN pwu.last_activity_at END DESC,
    CASE WHEN sort_by = 'relevance' THEN (pwu.users_info).count END DESC,
    CASE WHEN sort_by = 'relevance' THEN pwu.last_activity_at END DESC,
    CASE WHEN sort_by = 'relevance' THEN pwu.relevance_score END DESC,
    CASE WHEN sort_by = 'relevance' THEN pwu.confidence END DESC,
    pwu.dist_meters ASC,
    pwu.relevance_score DESC
  LIMIT limit_amount
  OFFSET safe_offset;
END;
$function$;

-- 2. Optimize get_trending_places
DROP FUNCTION IF EXISTS public.get_trending_places(double precision, double precision, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.get_trending_places(
  user_lat double precision, 
  user_lng double precision, 
  radius_meters double precision DEFAULT 50000, 
  max_results integer DEFAULT 10, 
  requesting_user_id uuid DEFAULT NULL::uuid
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
  preview_avatars text[],
  dist_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH trending AS (
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
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  )
  SELECT 
    t.id,
    t.name,
    t.category,
    t.lat,
    t.lng,
    t.street,
    t.house_number,
    t.city,
    t.state,
    t.country,
    (t.users_info).count::integer as active_users,
    (t.users_info).avatars as preview_avatars,
    t.dist_meters
  FROM trending t
  WHERE (t.users_info).count > 0
  ORDER BY (t.users_info).count DESC, t.dist_meters ASC
  LIMIT max_results;
END;
$function$;

-- 3. Optimize get_favorite_places
DROP FUNCTION IF EXISTS public.get_favorite_places(double precision, double precision, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.get_favorite_places(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision DEFAULT 50000,
  max_results integer DEFAULT 20,
  requesting_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
  preview_avatars text[],
  dist_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF requesting_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH favorites AS (
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
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info
    FROM places p
    INNER JOIN user_favorite_places ufp ON ufp.place_id = p.id
    WHERE
      p.active = true
      AND ufp.user_id = requesting_user_id
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  )
  SELECT 
    f.id,
    f.name,
    f.category,
    f.lat,
    f.lng,
    f.street,
    f.house_number,
    f.city,
    f.state,
    f.country,
    (f.users_info).count::integer as active_users,
    (f.users_info).avatars as preview_avatars,
    f.dist_meters
  FROM favorites f
  ORDER BY (f.users_info).count DESC, f.dist_meters ASC
  LIMIT max_results;
END;
$function$;

-- 4. Optimize search_places_by_favorites
DROP FUNCTION IF EXISTS public.search_places_by_favorites(double precision, double precision, double precision, text, integer, uuid);

CREATE OR REPLACE FUNCTION public.search_places_by_favorites(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision DEFAULT 5000,
  place_category text DEFAULT NULL,
  max_results integer DEFAULT 20,
  requesting_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
  preview_avatars text[],
  dist_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH places_with_favorites AS (
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
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info,
      COALESCE((
        SELECT COUNT(*)
        FROM user_favorite_places ufp
        WHERE ufp.place_id = p.id
      ), 0) as favorite_count
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (place_category IS NULL OR p.category = place_category)
  )
  SELECT 
    pf.id,
    pf.name,
    pf.category,
    pf.lat,
    pf.lng,
    pf.street,
    pf.house_number,
    pf.city,
    pf.state,
    pf.country,
    (pf.users_info).count::integer as active_users,
    (pf.users_info).avatars as preview_avatars,
    pf.dist_meters
  FROM places_with_favorites pf
  ORDER BY pf.favorite_count DESC, pf.dist_meters ASC
  LIMIT max_results;
END;
$function$;

-- 5. Optimize search_places_autocomplete (GiST optimized, single active_users call)
-- Create GiST index for trigram distance ordering (better for top-N)
CREATE INDEX IF NOT EXISTS idx_places_name_trgm_gist 
ON places USING GiST (immutable_unaccent(name) gist_trgm_ops);

DROP FUNCTION IF EXISTS public.search_places_autocomplete(text, double precision, double precision, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.search_places_autocomplete(
  query_text text,
  user_lat double precision DEFAULT NULL,
  user_lng double precision DEFAULT NULL,
  radius_meters double precision DEFAULT 50000,
  max_results integer DEFAULT 10,
  requesting_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
  preview_avatars text[],
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
      ARRAY[]::text[] as preview_avatars,
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

-- 6. Optimize get_ranked_places
DROP FUNCTION IF EXISTS get_ranked_places(float, float, float, text, int, uuid);

CREATE OR REPLACE FUNCTION get_ranked_places(
  user_lat float,
  user_lng float,
  radius_meters float,
  rank_by text DEFAULT 'total',
  max_results int DEFAULT 20,
  requesting_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
  total_checkins integer,
  monthly_checkins integer,
  total_matches integer,
  monthly_matches integer,
  review_average double precision,
  review_count integer,
  review_tags text[],
  dist_meters float,
  rank_position integer,
  active_users integer,
  preview_avatars text[]
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  max_matches_val float;
  max_checkins_val float;
  use_monthly_data boolean;
BEGIN
  use_monthly_data := (rank_by = 'monthly');

  IF use_monthly_data THEN
    SELECT 
      GREATEST(MAX(p.monthly_matches), 1)::float,
      GREATEST(MAX(p.monthly_checkins), 1)::float
    INTO max_matches_val, max_checkins_val
    FROM places_view p
    WHERE st_dwithin(
      st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND (p.monthly_matches > 0 OR p.monthly_checkins > 0);
  ELSE
    SELECT 
      GREATEST(MAX(p.total_matches), 1)::float,
      GREATEST(MAX(p.total_checkins), 1)::float
    INTO max_matches_val, max_checkins_val
    FROM places_view p
    WHERE st_dwithin(
      st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND (p.total_matches > 0 OR p.total_checkins > 0);
  END IF;

  RETURN QUERY
  WITH ranked AS (
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
      p.total_checkins,
      p.monthly_checkins,
      p.total_matches,
      p.monthly_matches,
      p.review_average,
      p.review_count::integer as review_count,
      p.review_tags,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      CASE 
        WHEN use_monthly_data THEN
          CASE
            WHEN rank_by = 'matches' THEN p.monthly_matches::float
            WHEN rank_by = 'checkins' THEN p.monthly_checkins::float
            ELSE 
              (0.6 * (p.monthly_matches::float / max_matches_val)) + 
              (0.4 * (p.monthly_checkins::float / max_checkins_val))
          END
        ELSE
          CASE
            WHEN rank_by = 'matches' THEN p.total_matches::float
            WHEN rank_by = 'checkins' THEN p.total_checkins::float
            ELSE 
              (0.6 * (p.total_matches::float / max_matches_val)) + 
              (0.4 * (p.total_checkins::float / max_checkins_val))
          END
      END as composite_score,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info
    FROM places_view p
    WHERE
      st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (
        (use_monthly_data AND (p.monthly_matches > 0 OR p.monthly_checkins > 0))
        OR (NOT use_monthly_data AND (p.total_matches > 0 OR p.total_checkins > 0))
      )
  )
  SELECT
    r.id,
    r.name,
    r.category,
    r.lat,
    r.lng,
    r.street,
    r.house_number,
    r.city,
    r.state,
    r.country,
    r.total_checkins,
    r.monthly_checkins,
    r.total_matches,
    r.monthly_matches,
    r.review_average,
    r.review_count,
    r.review_tags,
    r.dist_meters,
    DENSE_RANK() OVER (ORDER BY r.composite_score DESC, r.dist_meters ASC)::integer as rank_position,
    (r.users_info).count::integer as active_users,
    (r.users_info).avatars as preview_avatars
  FROM ranked r
  ORDER BY r.composite_score DESC, r.dist_meters ASC
  LIMIT max_results;
END;
$$;
