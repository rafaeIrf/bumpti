-- =============================================================================
-- Fix: get_ranked_places and search_places_by_favorites (new version)
-- Use get_combined_place_avatars instead of COALESCE(active, regulars)
-- =============================================================================

-- ============================================================================
-- 1. get_ranked_places
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_ranked_places(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision,
  rank_by text DEFAULT 'total'::text,
  max_results integer DEFAULT 20,
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
  neighborhood text,
  city text,
  state text,
  country text,
  total_checkins integer,
  monthly_checkins integer,
  total_matches integer,
  monthly_matches integer,
  review_average double precision,
  review_count bigint,
  review_tags text[],
  dist_meters double precision,
  rank_position integer,
  active_users bigint,
  preview_avatars jsonb,
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
      p.neighborhood,
      p.city,
      p.state,
      p.country_code as country,
      p.total_checkins,
      p.monthly_checkins,
      p.total_matches,
      p.monthly_matches,
      p.review_average,
      p.review_count,
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
      END as composite_score
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
    r.neighborhood,
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
    get_eligible_active_users_count(r.id, requesting_user_id) as active_users,
    -- Combined: active avatars + regular avatars (deduped, up to 3)
    get_combined_place_avatars(r.id, requesting_user_id, 3) as preview_avatars,
    get_regulars_count_at_place(r.id, requesting_user_id) as regulars_count
  FROM ranked r
  ORDER BY r.composite_score DESC, r.dist_meters ASC
  LIMIT max_results;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_ranked_places(double precision, double precision, double precision, text, integer, uuid) TO authenticated, anon;


-- ============================================================================
-- 2. search_places_by_favorites (new version with filter_categories text[])
-- ============================================================================
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
  neighborhood text,
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
  review_tags text[],
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH limited_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,
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
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.neighborhood,
    wr.city,
    wr.state,
    wr.country,
    wr.total_score,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    -- Combined: active avatars + regular avatars (deduped, up to 5)
    get_combined_place_avatars(wr.id, requesting_user_id, 5) as preview_avatars,
    wr.favorites_count,
    wr.dist_meters,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    get_regulars_count_at_place(wr.id, requesting_user_id) as regulars_count
  FROM with_reviews wr
  ORDER BY wr.favorites_count DESC, wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION search_places_by_favorites(double precision, double precision, double precision, text[], integer, uuid) TO authenticated, anon;
