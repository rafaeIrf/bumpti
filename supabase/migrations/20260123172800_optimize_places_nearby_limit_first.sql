-- Optimize search_places_nearby: Use places table directly + LIMIT before avatars
-- Avoids expensive LEFT JOIN LATERAL from places_view

DROP FUNCTION IF EXISTS public.search_places_nearby(double precision, double precision, double precision, text[], integer, uuid, text, double precision, integer, integer);

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
  review_count bigint, 
  review_tags text[], 
  total_checkins integer, 
  last_activity_at timestamp with time zone, 
  active_users bigint, 
  preview_avatars jsonb,
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
  -- Step 1: Get LIMITED places from base table (fast - no joins)
  WITH limited_places AS (
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
      p.relevance_score,
      p.confidence,
      p.socials,
      p.total_checkins,
      p.last_activity_at,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
    ORDER BY
      CASE WHEN sort_by = 'distance' THEN st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) END ASC,
      CASE WHEN sort_by = 'popularity' THEN p.total_checkins END DESC,
      CASE WHEN sort_by = 'popularity' THEN p.last_activity_at END DESC,
      CASE WHEN sort_by = 'relevance' THEN p.relevance_score END DESC,
      CASE WHEN sort_by = 'relevance' THEN p.confidence END DESC,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) ASC
    LIMIT limit_amount
    OFFSET safe_offset
  ),
  -- Step 2: Add reviews only for limited results
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  -- Step 3: Add avatars and active users only for final results
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.city,
    wr.state,
    wr.country,
    wr.relevance_score,
    wr.confidence,
    wr.socials,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.total_checkins,
    wr.last_activity_at,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars,
    wr.dist_meters
  FROM with_reviews wr;
END;
$function$;

-- Optimize get_trending_places: Use places table + LIMIT before avatars
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
  review_average double precision, 
  review_count bigint, 
  review_tags text[], 
  dist_meters double precision, 
  active_users bigint,
  preview_avatars jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  -- Step 1: Get places with active users count only (fast)
  WITH places_with_counts AS (
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
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users_count
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  -- Step 2: Filter to places with active users and LIMIT
  limited_places AS (
    SELECT *
    FROM places_with_counts pc
    WHERE pc.active_users_count > 0
    ORDER BY pc.active_users_count DESC, pc.dist_meters ASC
    LIMIT max_results
  ),
  -- Step 3: Add reviews for limited results
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  -- Step 4: Add avatars only for final results
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.city,
    wr.state,
    wr.country,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    wr.active_users_count as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars
  FROM with_reviews wr
  ORDER BY wr.active_users_count DESC, wr.dist_meters ASC;
END;
$function$;

-- Optimize get_user_favorite_places: Use places table + avatars only for final results
DROP FUNCTION IF EXISTS public.get_user_favorite_places(double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.get_user_favorite_places(
  user_lat double precision, 
  user_lng double precision, 
  requesting_user_id uuid
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
  review_average double precision, 
  review_count bigint, 
  review_tags text[], 
  dist_meters double precision, 
  active_users bigint,
  preview_avatars jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  -- Step 1: Get favorite places from base table (fast - no avatar calculation)
  WITH favorite_places AS (
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
      ) AS dist_meters
    FROM places p
    INNER JOIN profile_favorite_places pfp ON pfp.place_id = p.id
    WHERE 
      pfp.user_id = requesting_user_id
      AND p.active = true
  ),
  -- Step 2: Add reviews for favorite places
  with_reviews AS (
    SELECT
      fp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM favorite_places fp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = fp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = fp.id
    ) r ON true
  )
  -- Step 3: Add avatars and active users for final results
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.city,
    wr.state,
    wr.country,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars
  FROM with_reviews wr
  ORDER BY wr.dist_meters ASC;
END;
$function$;

-- Optimize search_places_by_favorites: LIMIT before avatars
DROP FUNCTION IF EXISTS public.search_places_by_favorites(double precision, double precision, double precision, text[], integer, uuid);

CREATE OR REPLACE FUNCTION public.search_places_by_favorites(
  user_lat double precision, 
  user_lng double precision, 
  radius_meters double precision, 
  filter_categories text[] DEFAULT NULL::text[], 
  max_results integer DEFAULT 50, 
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
  total_score integer, 
  active_users bigint, 
  preview_avatars jsonb,
  favorites_count bigint, 
  dist_meters double precision, 
  review_average double precision, 
  review_count bigint, 
  review_tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  -- Step 1: Get places with favorites count, LIMIT first (no avatars yet)
  WITH limited_places AS (
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
      p.total_score,
      (
        SELECT count(*)
        FROM profile_favorite_places f
        WHERE f.place_id = p.id
          AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id)
      ) AS favorites_count,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    WHERE 
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) AS c))
      AND EXISTS (
        SELECT 1 FROM profile_favorite_places f 
        WHERE f.place_id = p.id 
          AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id)
      )
    ORDER BY favorites_count DESC, dist_meters ASC
    LIMIT max_results
  ),
  -- Step 2: Add reviews for limited results
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  -- Step 3: Add avatars only for final limited results
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.city,
    wr.state,
    wr.country,
    wr.total_score,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars,
    wr.favorites_count,
    wr.dist_meters,
    wr.review_average,
    wr.review_count,
    wr.review_tags
  FROM with_reviews wr
  ORDER BY wr.favorites_count DESC, wr.dist_meters ASC;
END;
$function$;
