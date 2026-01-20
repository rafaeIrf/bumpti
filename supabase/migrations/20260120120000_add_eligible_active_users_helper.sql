-- =============================================================================
-- Migration: Add shared helper function for eligible active users filtering
-- =============================================================================
-- This migration:
-- 1. Creates a shared helper function to centralize active users filtering logic
-- 2. Updates all 4 RPCs to use the helper function
-- 3. Adds missing 'like' filter to exclude users who have pending likes

-- =============================================================================
-- PART 1: Create shared helper function
-- =============================================================================
CREATE OR REPLACE FUNCTION get_eligible_active_users_count(
  target_place_id uuid,
  requesting_user_id uuid
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM user_presences up
    WHERE up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      -- Exclude self
      AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
      -- Exclude blocked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_blocks b 
        WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
           OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
      ))
      -- Exclude disliked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'dislike'
          AND (
            (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
            OR 
            (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
          )
      ))
      -- NEW: Exclude users with pending likes (unidirectional - only requesting user's likes)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'like'
          AND ui.from_user_id = requesting_user_id 
          AND ui.to_user_id = up.user_id
      ))
      -- Exclude matched users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_matches um
        WHERE um.status = 'matched'
          AND (
            (um.user_a = requesting_user_id AND um.user_b = up.user_id)
            OR 
            (um.user_a = up.user_id AND um.user_b = requesting_user_id)
          )
      ))
      -- Require matching gender preference
      AND (requesting_user_id IS NULL OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      ))
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_eligible_active_users_count(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_eligible_active_users_count IS 
'Returns count of eligible active users at a place for a requesting user.
Excludes: self, blocked, disliked, liked (pending), matched users.
Filters by gender preference compatibility.';

-- =============================================================================
-- PART 2: Update search_places_nearby to use helper
-- =============================================================================
DROP FUNCTION IF EXISTS search_places_nearby(float, float, float, text[], int, uuid, text, double precision, integer, integer);

CREATE OR REPLACE FUNCTION search_places_nearby(
  user_lat float,
  user_lng float,
  radius_meters float,
  filter_categories text[] default null,
  max_results int default 60,
  requesting_user_id uuid default null,
  sort_by text default 'relevance',
  min_rating float default null,
  page_offset int default 0,
  page_size int default 20
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
  relevance_score int,
  confidence float,
  socials jsonb,
  review_average float,
  review_count bigint,
  review_tags text[],
  total_checkins int,
  last_activity_at timestamptz,
  active_users bigint,
  dist_meters float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  safe_offset int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
  max_limit int := GREATEST(max_results, 0);
  remaining int := max_limit - safe_offset;
  limit_amount int := LEAST(safe_page_size, GREATEST(remaining, 0));
BEGIN
  RETURN QUERY
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
    pv.review_count,
    pv.review_tags,
    pv.total_checkins,
    pv.last_activity_at,
    get_eligible_active_users_count(pv.id, requesting_user_id) as active_users,
    st_distance(
      st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) AS dist_meters
  FROM places_view pv
  WHERE
    st_dwithin(
      st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND (filter_categories IS NULL OR lower(pv.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
    AND (min_rating IS NULL OR pv.review_average >= min_rating)
  ORDER BY
    CASE WHEN sort_by = 'distance' THEN dist_meters END ASC,
    CASE WHEN sort_by = 'rating' THEN pv.review_average END DESC,
    CASE WHEN sort_by = 'rating' THEN pv.review_count END DESC,
    CASE WHEN sort_by = 'popularity' THEN pv.total_checkins END DESC,
    CASE WHEN sort_by = 'popularity' THEN pv.last_activity_at END DESC,
    CASE WHEN sort_by = 'relevance' THEN get_eligible_active_users_count(pv.id, requesting_user_id) END DESC,
    CASE WHEN sort_by = 'relevance' THEN pv.last_activity_at END DESC,
    CASE WHEN sort_by = 'relevance' THEN pv.relevance_score END DESC,
    CASE WHEN sort_by = 'relevance' THEN pv.confidence END DESC,
    dist_meters ASC,
    pv.relevance_score DESC
  LIMIT limit_amount
  OFFSET safe_offset;
END;
$$;

-- =============================================================================
-- PART 3: Update get_ranked_places to use helper
-- =============================================================================
DROP FUNCTION IF EXISTS get_ranked_places(float, float, float, text, int, uuid);

CREATE OR REPLACE FUNCTION get_ranked_places(
  user_lat float,
  user_lng float,
  radius_meters float default 50000,
  rank_by text default 'composite',
  max_results int default 20,
  requesting_user_id uuid default null
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
  total_checkins int,
  monthly_checkins int,
  total_matches int,
  monthly_matches int,
  review_average float,
  review_count bigint,
  review_tags text[],
  dist_meters float,
  rank_position bigint,
  active_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      END as composite_score,
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users
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
    DENSE_RANK() OVER (ORDER BY r.composite_score DESC, r.dist_meters ASC) as rank_position,
    r.active_users
  FROM ranked r
  ORDER BY r.composite_score DESC, r.dist_meters ASC
  LIMIT max_results;
END;
$$;

-- =============================================================================
-- PART 4: Update search_places_by_favorites to use helper
-- =============================================================================
DROP FUNCTION IF EXISTS search_places_by_favorites(float, float, float, text[], int, uuid);

CREATE OR REPLACE FUNCTION search_places_by_favorites(
  user_lat float,
  user_lng float,
  radius_meters float,
  filter_categories text[] default null,
  max_results int default 50,
  requesting_user_id uuid default null
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
  total_score int,
  active_users bigint,
  favorites_count bigint,
  dist_meters float,
  review_average float,
  review_count bigint,
  review_tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
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
    get_eligible_active_users_count(p.id, requesting_user_id) as active_users,
    (
        SELECT count(*)
        FROM profile_favorite_places f
        WHERE f.place_id = p.id
          AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id)
    ) AS favorites_count,
    st_distance(
      st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) AS dist_meters,
    COALESCE(reviews.avg_stars, 0) as review_average,
    COALESCE(reviews.total_reviews, 0) as review_count,
    COALESCE(reviews.top_tags, ARRAY[]::text[]) as review_tags
  FROM places p
  LEFT JOIN LATERAL (
    SELECT 
        AVG(psr.stars)::float as avg_stars,
        COUNT(psr.id) as total_reviews,
        ARRAY(
            SELECT t.key
            FROM place_review_tag_relations prtr
            JOIN place_review_tags t ON t.id = prtr.tag_id
            JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
            WHERE psr2.place_id = p.id
            GROUP BY t.key
            ORDER BY COUNT(*) DESC
            LIMIT 3
        ) as top_tags
    FROM place_social_reviews psr
    WHERE psr.place_id = p.id
  ) reviews ON true
  WHERE st_dwithin(
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
  LIMIT max_results;
END;
$$;

-- =============================================================================
-- PART 5: Update search_places_autocomplete to use helper
-- =============================================================================
DROP FUNCTION IF EXISTS search_places_autocomplete(text, float, float, float, int, uuid);

CREATE OR REPLACE FUNCTION search_places_autocomplete(
  query_text text,
  user_lat float default null,
  user_lng float default null,
  radius_meters float default 50000,
  max_results int default 10,
  requesting_user_id uuid default null
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
  active_users bigint,
  dist_meters float,
  relevance_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query text;
BEGIN
  normalized_query := trim(regexp_replace(immutable_unaccent(query_text), '\s+', ' ', 'g'));
  
  RETURN QUERY
  WITH ranked_places AS (
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
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users,
      case 
        when user_lat is not null and user_lng is not null then
          st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          )
        else
          null::float
      end as dist_meters,
      (
        (word_similarity(normalized_query, immutable_unaccent(p.name)) * 100.0)
        +
        (CASE 
          WHEN immutable_unaccent(p.name) ILIKE immutable_unaccent(query_text) || '%' 
          THEN 50.0 
          ELSE 0.0 
        END)
        +
        (CASE 
          WHEN lower(immutable_unaccent(p.name)) = lower(normalized_query)
          THEN 100.0
          ELSE 0.0
        END)
        +
        (LEAST(p.total_score / 100.0, 1.0) * 20.0)
      ) as relevance_score
    FROM places p
    WHERE 
      p.active = true
      AND (
        immutable_unaccent(query_text) <% immutable_unaccent(p.name)
        OR 
        word_similarity(normalized_query, immutable_unaccent(p.name)) > 0.3
      )
      AND (
        user_lat is null 
        or user_lng is null 
        or st_dwithin(
          st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
          st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
          radius_meters
        )
      )
  )
  SELECT 
    rp.id,
    rp.name,
    rp.category,
    rp.lat,
    rp.lng,
    rp.street,
    rp.house_number,
    rp.city,
    rp.state,
    rp.country,
    rp.active_users,
    rp.dist_meters,
    rp.relevance_score
  FROM ranked_places rp
  ORDER BY 
    rp.relevance_score DESC,
    rp.active_users DESC,
    CASE WHEN rp.dist_meters IS NOT NULL THEN rp.dist_meters ELSE 999999999 END ASC
  LIMIT max_results;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_places_autocomplete(text, float, float, float, int, uuid) TO authenticated, anon;

COMMENT ON FUNCTION search_places_autocomplete IS 
'Fuzzy autocomplete search using pg_trgm with composite relevance scoring. 
Scores combine: word_similarity (100pts), prefix match (50pts), exact match (100pts), popularity (20pts). 
Uses get_eligible_active_users_count helper for consistent user filtering.';
