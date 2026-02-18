-- =============================================================================
-- Fix: preview_avatars should show BOTH active users AND regulars avatars
-- =============================================================================
-- Problem: COALESCE(active_avatars, regulars_avatars) returns one OR the other.
--   When a place has 1 active + 1 regular, only the active avatar is shown.
--   Fix: Combine both sets, deduplicating by user_id, up to max 5 avatars.
-- =============================================================================

-- Helper: combine active + regular avatars into one jsonb array (up to max_avatars)
CREATE OR REPLACE FUNCTION get_combined_place_avatars(
  target_place_id uuid,
  requesting_user_id uuid DEFAULT NULL,
  max_avatars integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  active_avatars jsonb;
  regular_avatars jsonb;
  combined jsonb;
BEGIN
  -- Get active user avatars
  SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url))
  INTO active_avatars
  FROM unnest((get_active_users_with_avatars(target_place_id, requesting_user_id, max_avatars)).avatars) a;

  -- Get regular avatars (only if we still have room)
  SELECT get_regulars_avatars_at_place(target_place_id, requesting_user_id, max_avatars)
  INTO regular_avatars;

  -- Combine: active first, then regulars, dedup by user_id, limit to max_avatars
  SELECT jsonb_agg(item ORDER BY idx)
  INTO combined
  FROM (
    SELECT item, row_number() OVER () as idx
    FROM (
      -- Active avatars first
      SELECT item
      FROM jsonb_array_elements(COALESCE(active_avatars, '[]'::jsonb)) item
      UNION ALL
      -- Regular avatars, excluding any already in active
      SELECT item
      FROM jsonb_array_elements(COALESCE(regular_avatars, '[]'::jsonb)) item
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(active_avatars, '[]'::jsonb)) a
        WHERE a->>'user_id' = item->>'user_id'
      )
    ) all_avatars
    LIMIT max_avatars
  ) limited;

  RETURN combined;
END;
$$;

GRANT EXECUTE ON FUNCTION get_combined_place_avatars(uuid, uuid, integer) TO authenticated, anon;

COMMENT ON FUNCTION get_combined_place_avatars IS
'Returns combined avatar list: active users first, then regulars (deduped by user_id), up to max_avatars.
Used in place listing RPCs to show all relevant people at a place.';


-- ============================================================================
-- Update get_trending_places to use combined avatars
-- ============================================================================
DROP FUNCTION IF EXISTS get_trending_places(double precision, double precision, double precision, uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_trending_places(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision DEFAULT 50000,
  requesting_user_id uuid DEFAULT NULL::uuid,
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
  neighborhood text,
  city text,
  state text,
  country text,
  review_average double precision,
  review_count bigint,
  review_tags text[],
  dist_meters double precision,
  active_users bigint,
  preview_avatars jsonb,
  total_count bigint,
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  safe_offset int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
BEGIN
  RETURN QUERY
  WITH all_places_with_counts AS (
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
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users_count,
      get_regulars_count_at_place(p.id, requesting_user_id) as regulars_cnt
    FROM places p
    WHERE p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  trending_places AS (
    SELECT * FROM all_places_with_counts
    WHERE active_users_count > 0 OR regulars_cnt > 0
  ),
  total AS (
    SELECT COUNT(*)::bigint as cnt FROM trending_places
  ),
  limited_places AS (
    SELECT * FROM trending_places
    ORDER BY (active_users_count + regulars_cnt) DESC, active_users_count DESC, dist_meters ASC
    LIMIT safe_page_size OFFSET safe_offset
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
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    wr.active_users_count as active_users,
    -- Combined: active avatars + regular avatars (deduped, up to 5)
    get_combined_place_avatars(wr.id, requesting_user_id, 5) as preview_avatars,
    (SELECT cnt FROM total) as total_count,
    wr.regulars_cnt as regulars_count
  FROM with_reviews wr
  ORDER BY (wr.active_users_count + wr.regulars_cnt) DESC, wr.active_users_count DESC, wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_trending_places(double precision, double precision, double precision, uuid, integer, integer) TO authenticated, anon;


-- ============================================================================
-- Update search_places_nearby to use combined avatars
-- ============================================================================
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
  neighborhood text,
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
  dist_meters double precision,
  regulars_count integer
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
    wr.relevance_score,
    wr.confidence,
    wr.socials,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.total_checkins,
    wr.last_activity_at,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    -- Combined: active avatars + regular avatars (deduped, up to 5)
    get_combined_place_avatars(wr.id, requesting_user_id, 5) as preview_avatars,
    wr.dist_meters,
    get_regulars_count_at_place(wr.id, requesting_user_id) as regulars_count
  FROM with_reviews wr;
END;
$function$;

GRANT EXECUTE ON FUNCTION search_places_nearby(double precision, double precision, double precision, text[], integer, uuid, text, double precision, integer, integer) TO authenticated, anon;


-- ============================================================================
-- Update get_user_favorite_places to use combined avatars
-- ============================================================================
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
  neighborhood text,
  city text,
  state text,
  country text,
  review_average double precision,
  review_count bigint,
  review_tags text[],
  dist_meters double precision,
  active_users bigint,
  preview_avatars jsonb,
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH favorite_places AS (
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
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    -- Combined: active avatars + regular avatars (deduped, up to 5)
    get_combined_place_avatars(wr.id, requesting_user_id, 5) as preview_avatars,
    get_regulars_count_at_place(wr.id, requesting_user_id) as regulars_count
  FROM with_reviews wr
  ORDER BY wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_user_favorite_places(double precision, double precision, uuid) TO authenticated, anon;
