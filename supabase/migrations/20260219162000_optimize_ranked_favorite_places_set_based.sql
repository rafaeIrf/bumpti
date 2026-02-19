-- =============================================================================
-- Optimize: get_ranked_places, get_user_favorite_places, search_places_by_favorites
-- =============================================================================
-- Problem: All 3 functions call 3 per-row functions in the FINAL SELECT:
--   - get_eligible_active_users_count()
--   - get_combined_place_avatars()
--   - get_regulars_count_at_place()
--
-- Fix: collect candidate users via set-based joins on limited_places, then
--   filter with is_eligible_match() (single source of truth for eligibility).
--   Avatars and counts computed once for all places, not per-row.
--
-- Also fixes get_ranked_places:
--   - Single ST_DWithin scan using MAX() OVER() window functions for all 4 normalizers
--     (was 2 separate full scans: one DECLARE aggregate + one ranked CTE scan)
--   - Uses places directly (not places_view) + reviews only after LIMIT
--
-- Behavior preserved from 20260218164000_fix_remaining_rpcs_combined_avatars.sql
-- =============================================================================


-- ============================================================================
-- 1. get_ranked_places — single scan via window MAX + is_eligible_match
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
  id uuid, name text, category text, lat double precision, lng double precision,
  street text, house_number text, neighborhood text, city text, state text, country text,
  total_checkins integer, monthly_checkins integer, total_matches integer, monthly_matches integer,
  review_average double precision, review_count bigint, review_tags text[],
  dist_meters double precision, rank_position integer, active_users bigint,
  preview_avatars jsonb, regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH
  -- Single ST_DWithin scan: fetch data + compute MAX values via window functions
  -- Avoids the extra DECLARE-section aggregate scan (was 2 full index scans)
  all_in_radius AS (
    SELECT
      p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number, p.neighborhood,
      p.city, p.state, p.country_code AS p_country,
      p.total_checkins AS p_total_checkins, p.monthly_checkins AS p_monthly_checkins,
      p.total_matches AS p_total_matches, p.monthly_matches AS p_monthly_matches,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) AS p_dist_meters,
      GREATEST(MAX(p.total_matches)    OVER (), 1)::float AS mx_total_matches,
      GREATEST(MAX(p.total_checkins)   OVER (), 1)::float AS mx_total_checkins,
      GREATEST(MAX(p.monthly_matches)  OVER (), 1)::float AS mx_monthly_matches,
      GREATEST(MAX(p.monthly_checkins) OVER (), 1)::float AS mx_monthly_checkins
    FROM places p
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (p.total_matches > 0 OR p.total_checkins > 0 OR p.monthly_matches > 0 OR p.monthly_checkins > 0)
  ),
  ranked AS (
    SELECT *,
      CASE WHEN rank_by = 'monthly' THEN
        CASE WHEN rank_by = 'matches'  THEN p_monthly_matches::float
             WHEN rank_by = 'checkins' THEN p_monthly_checkins::float
             ELSE (0.6 * (p_monthly_matches::float / mx_monthly_matches)) + (0.4 * (p_monthly_checkins::float / mx_monthly_checkins))
        END
      ELSE
        CASE WHEN rank_by = 'matches'  THEN p_total_matches::float
             WHEN rank_by = 'checkins' THEN p_total_checkins::float
             ELSE (0.6 * (p_total_matches::float / mx_total_matches)) + (0.4 * (p_total_checkins::float / mx_total_checkins))
        END
      END AS composite_score
    FROM all_in_radius
  ),
  limited_places AS (
    SELECT * FROM ranked ORDER BY composite_score DESC, p_dist_meters ASC LIMIT max_results
  ),
  -- Reviews only for the <=20 limited places (not the full 65k)
  with_reviews AS (
    SELECT lp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT AVG(psr.stars)::double precision AS avg_stars, COUNT(*)::bigint AS review_count,
        ARRAY(SELECT t.key FROM place_review_tag_relations prtr
              JOIN place_review_tags t ON t.id = prtr.tag_id
              JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
              WHERE psr2.place_id = lp.id GROUP BY t.key ORDER BY COUNT(*) DESC LIMIT 3) AS top_tags
      FROM place_social_reviews psr WHERE psr.place_id = lp.id
    ) r ON true
  ),
  eligible_active AS (
    SELECT DISTINCT up.place_id, up.user_id
    FROM user_presences up
    INNER JOIN limited_places lp ON lp.id = up.place_id
    WHERE up.active = true AND up.ended_at IS NULL AND up.expires_at > NOW()
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),
  eligible_favorites AS (
    SELECT pfp.place_id, pfp.user_id
    FROM profile_favorite_places pfp
    INNER JOIN limited_places lp ON lp.id = pfp.place_id
    WHERE (requesting_user_id IS NULL OR pfp.user_id <> requesting_user_id)
      AND NOT EXISTS (SELECT 1 FROM eligible_active ea WHERE ea.user_id = pfp.user_id AND ea.place_id = pfp.place_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, pfp.user_id))
  ),
  eligible_past AS (
    SELECT DISTINCT up.place_id, up.user_id
    FROM user_presences up
    INNER JOIN limited_places lp ON lp.id = up.place_id
    WHERE up.active = false AND up.entered_at > NOW() - INTERVAL '60 days'
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND NOT EXISTS (SELECT 1 FROM eligible_active ea WHERE ea.user_id = up.user_id AND ea.place_id = up.place_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),
  eligible_regulars AS (
    SELECT place_id, user_id FROM eligible_favorites
    UNION
    SELECT place_id, user_id FROM eligible_past
  ),
  active_counts   AS (SELECT place_id, COUNT(*)::bigint  AS cnt FROM eligible_active   GROUP BY place_id),
  regulars_counts AS (SELECT place_id, COUNT(*)::integer AS cnt FROM eligible_regulars GROUP BY place_id),
  active_avatars_raw AS (
    SELECT ea.place_id, ea.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY ea.place_id ORDER BY ea.user_id, pp.position ASC) AS rn
    FROM eligible_active ea
    INNER JOIN LATERAL (SELECT url, position FROM profile_photos WHERE user_id = ea.user_id AND url IS NOT NULL ORDER BY position ASC LIMIT 1) pp ON true
  ),
  active_avatars AS (
    SELECT place_id, jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM active_avatars_raw WHERE rn <= 3 GROUP BY place_id
  ),
  regular_avatars_raw AS (
    SELECT er.place_id, er.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY er.place_id ORDER BY er.user_id, pp.position ASC) AS rn
    FROM eligible_regulars er
    INNER JOIN LATERAL (SELECT url, position FROM profile_photos WHERE user_id = er.user_id AND url IS NOT NULL ORDER BY position ASC LIMIT 1) pp ON true
  ),
  regular_avatars AS (
    SELECT place_id, jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM regular_avatars_raw WHERE rn <= 3 GROUP BY place_id
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number, wr.neighborhood,
    wr.city, wr.state, wr.p_country,
    wr.p_total_checkins, wr.p_monthly_checkins, wr.p_total_matches, wr.p_monthly_matches,
    wr.review_average, wr.review_count, wr.review_tags, wr.p_dist_meters,
    DENSE_RANK() OVER (ORDER BY wr.composite_score DESC, wr.p_dist_meters ASC)::integer AS rank_position,
    COALESCE(ac.cnt, 0)              AS active_users,
    COALESCE(aa.avatars, ra.avatars) AS preview_avatars,
    COALESCE(rc.cnt, 0)              AS regulars_count
  FROM with_reviews wr
  LEFT JOIN active_counts   ac ON ac.place_id = wr.id
  LEFT JOIN active_avatars  aa ON aa.place_id = wr.id
  LEFT JOIN regulars_counts rc ON rc.place_id = wr.id
  LEFT JOIN regular_avatars ra ON ra.place_id = wr.id
  ORDER BY wr.composite_score DESC, wr.p_dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_ranked_places(double precision, double precision, double precision, text, integer, uuid) TO authenticated, anon;


-- ============================================================================
-- 2. get_user_favorite_places
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_favorite_places(double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.get_user_favorite_places(
  user_lat double precision,
  user_lng double precision,
  requesting_user_id uuid
)
RETURNS TABLE(
  id uuid, name text, category text, lat double precision, lng double precision,
  street text, house_number text, neighborhood text, city text, state text, country text,
  review_average double precision, review_count bigint, review_tags text[],
  dist_meters double precision, active_users bigint, preview_avatars jsonb, regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH
  favorite_places AS (
    SELECT p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number,
           p.neighborhood, p.city, p.state, p.country_code AS country,
           ST_Distance(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                       ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS dist_meters
    FROM places p
    INNER JOIN profile_favorite_places pfp ON pfp.place_id = p.id
    WHERE pfp.user_id = requesting_user_id AND p.active = true
  ),
  with_reviews AS (
    SELECT fp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM favorite_places fp
    LEFT JOIN LATERAL (
      SELECT AVG(psr.stars)::double precision AS avg_stars, COUNT(*)::bigint AS review_count,
        ARRAY(SELECT t.key FROM place_review_tag_relations prtr
              JOIN place_review_tags t ON t.id = prtr.tag_id
              JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
              WHERE psr2.place_id = fp.id GROUP BY t.key ORDER BY COUNT(*) DESC LIMIT 3) AS top_tags
      FROM place_social_reviews psr WHERE psr.place_id = fp.id
    ) r ON true
  ),
  eligible_active AS (
    SELECT DISTINCT up.place_id, up.user_id
    FROM user_presences up
    INNER JOIN favorite_places fp ON fp.id = up.place_id
    WHERE up.active = true AND up.ended_at IS NULL AND up.expires_at > NOW()
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),
  eligible_favorites AS (
    SELECT pfp2.place_id, pfp2.user_id
    FROM profile_favorite_places pfp2
    INNER JOIN favorite_places fp ON fp.id = pfp2.place_id
    WHERE (requesting_user_id IS NULL OR pfp2.user_id <> requesting_user_id)
      AND NOT EXISTS (SELECT 1 FROM eligible_active ea WHERE ea.user_id = pfp2.user_id AND ea.place_id = pfp2.place_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, pfp2.user_id))
  ),
  eligible_past AS (
    SELECT DISTINCT up.place_id, up.user_id
    FROM user_presences up
    INNER JOIN favorite_places fp ON fp.id = up.place_id
    WHERE up.active = false AND up.entered_at > NOW() - INTERVAL '60 days'
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND NOT EXISTS (SELECT 1 FROM eligible_active ea WHERE ea.user_id = up.user_id AND ea.place_id = up.place_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),
  eligible_regulars AS (
    SELECT place_id, user_id FROM eligible_favorites
    UNION
    SELECT place_id, user_id FROM eligible_past
  ),
  active_counts   AS (SELECT place_id, COUNT(*)::bigint  AS cnt FROM eligible_active   GROUP BY place_id),
  regulars_counts AS (SELECT place_id, COUNT(*)::integer AS cnt FROM eligible_regulars GROUP BY place_id),
  active_avatars_raw AS (
    SELECT ea.place_id, ea.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY ea.place_id ORDER BY ea.user_id, pp.position ASC) AS rn
    FROM eligible_active ea
    INNER JOIN LATERAL (SELECT url, position FROM profile_photos WHERE user_id = ea.user_id AND url IS NOT NULL ORDER BY position ASC LIMIT 1) pp ON true
  ),
  active_avatars AS (
    SELECT place_id, jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM active_avatars_raw WHERE rn <= 5 GROUP BY place_id
  ),
  regular_avatars_raw AS (
    SELECT er.place_id, er.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY er.place_id ORDER BY er.user_id, pp.position ASC) AS rn
    FROM eligible_regulars er
    INNER JOIN LATERAL (SELECT url, position FROM profile_photos WHERE user_id = er.user_id AND url IS NOT NULL ORDER BY position ASC LIMIT 1) pp ON true
  ),
  regular_avatars AS (
    SELECT place_id, jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM regular_avatars_raw WHERE rn <= 5 GROUP BY place_id
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country,
    wr.review_average, wr.review_count, wr.review_tags, wr.dist_meters,
    COALESCE(ac.cnt, 0)              AS active_users,
    COALESCE(aa.avatars, ra.avatars) AS preview_avatars,
    COALESCE(rc.cnt, 0)              AS regulars_count
  FROM with_reviews wr
  LEFT JOIN active_counts   ac ON ac.place_id = wr.id
  LEFT JOIN active_avatars  aa ON aa.place_id = wr.id
  LEFT JOIN regulars_counts rc ON rc.place_id = wr.id
  LEFT JOIN regular_avatars ra ON ra.place_id = wr.id
  ORDER BY wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_user_favorite_places(double precision, double precision, uuid) TO authenticated, anon;


-- ============================================================================
-- 3. search_places_by_favorites (filter_categories text[] version)
-- ============================================================================
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
  id uuid, name text, category text, lat double precision, lng double precision,
  street text, house_number text, neighborhood text, city text, state text, country text,
  total_score integer, active_users bigint, preview_avatars jsonb,
  favorites_count bigint, dist_meters double precision,
  review_average double precision, review_count bigint, review_tags text[],
  regulars_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH
  limited_places AS (
    SELECT p.id, p.name, p.category, p.lat, p.lng, p.street, p.house_number,
           p.neighborhood, p.city, p.state, p.country_code AS country, p.total_score,
      (SELECT count(*) FROM profile_favorite_places f
       WHERE f.place_id = p.id AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id)
      ) AS favorites_count,
      ST_Distance(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS dist_meters
    FROM places p
    WHERE p.active = true
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                     ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_meters)
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) AS c))
      AND EXISTS (SELECT 1 FROM profile_favorite_places f WHERE f.place_id = p.id
                    AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id))
    ORDER BY favorites_count DESC, dist_meters ASC
    LIMIT max_results
  ),
  with_reviews AS (
    SELECT lp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT AVG(psr.stars)::double precision AS avg_stars, COUNT(*)::bigint AS review_count,
        ARRAY(SELECT t.key FROM place_review_tag_relations prtr
              JOIN place_review_tags t ON t.id = prtr.tag_id
              JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
              WHERE psr2.place_id = lp.id GROUP BY t.key ORDER BY COUNT(*) DESC LIMIT 3) AS top_tags
      FROM place_social_reviews psr WHERE psr.place_id = lp.id
    ) r ON true
  ),
  eligible_active AS (
    SELECT DISTINCT up.place_id, up.user_id
    FROM user_presences up
    INNER JOIN limited_places lp ON lp.id = up.place_id
    WHERE up.active = true AND up.ended_at IS NULL AND up.expires_at > NOW()
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),
  eligible_favorites AS (
    SELECT pfp.place_id, pfp.user_id
    FROM profile_favorite_places pfp
    INNER JOIN limited_places lp ON lp.id = pfp.place_id
    WHERE (requesting_user_id IS NULL OR pfp.user_id <> requesting_user_id)
      AND NOT EXISTS (SELECT 1 FROM eligible_active ea WHERE ea.user_id = pfp.user_id AND ea.place_id = pfp.place_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, pfp.user_id))
  ),
  eligible_past AS (
    SELECT DISTINCT up.place_id, up.user_id
    FROM user_presences up
    INNER JOIN limited_places lp ON lp.id = up.place_id
    WHERE up.active = false AND up.entered_at > NOW() - INTERVAL '60 days'
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND NOT EXISTS (SELECT 1 FROM eligible_active ea WHERE ea.user_id = up.user_id AND ea.place_id = up.place_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),
  eligible_regulars AS (
    SELECT place_id, user_id FROM eligible_favorites
    UNION
    SELECT place_id, user_id FROM eligible_past
  ),
  active_counts   AS (SELECT place_id, COUNT(*)::bigint  AS cnt FROM eligible_active   GROUP BY place_id),
  regulars_counts AS (SELECT place_id, COUNT(*)::integer AS cnt FROM eligible_regulars GROUP BY place_id),
  active_avatars_raw AS (
    SELECT ea.place_id, ea.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY ea.place_id ORDER BY ea.user_id, pp.position ASC) AS rn
    FROM eligible_active ea
    INNER JOIN LATERAL (SELECT url, position FROM profile_photos WHERE user_id = ea.user_id AND url IS NOT NULL ORDER BY position ASC LIMIT 1) pp ON true
  ),
  active_avatars AS (
    SELECT place_id, jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM active_avatars_raw WHERE rn <= 5 GROUP BY place_id
  ),
  regular_avatars_raw AS (
    SELECT er.place_id, er.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY er.place_id ORDER BY er.user_id, pp.position ASC) AS rn
    FROM eligible_regulars er
    INNER JOIN LATERAL (SELECT url, position FROM profile_photos WHERE user_id = er.user_id AND url IS NOT NULL ORDER BY position ASC LIMIT 1) pp ON true
  ),
  regular_avatars AS (
    SELECT place_id, jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM regular_avatars_raw WHERE rn <= 5 GROUP BY place_id
  )
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country, wr.total_score,
    COALESCE(ac.cnt, 0)              AS active_users,
    COALESCE(aa.avatars, ra.avatars) AS preview_avatars,
    wr.favorites_count, wr.dist_meters,
    wr.review_average, wr.review_count, wr.review_tags,
    COALESCE(rc.cnt, 0)              AS regulars_count
  FROM with_reviews wr
  LEFT JOIN active_counts   ac ON ac.place_id = wr.id
  LEFT JOIN active_avatars  aa ON aa.place_id = wr.id
  LEFT JOIN regulars_counts rc ON rc.place_id = wr.id
  LEFT JOIN regular_avatars ra ON ra.place_id = wr.id
  ORDER BY wr.favorites_count DESC, wr.dist_meters ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION search_places_by_favorites(double precision, double precision, double precision, text[], integer, uuid) TO authenticated, anon;
