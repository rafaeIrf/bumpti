-- =============================================================================
-- Optimize: get_trending_places — users-first set-based CTE approach
-- =============================================================================
-- Problem (v1): Calling get_eligible_active_users_count() + get_regulars_count_at_place()
--   per-row for each of the 65k places in radius → 200k+ function calls → 8.5s timeout.
-- Problem (v2): Materializing all 65k places via ST_DWithin (1.4s alone) → 3.9s.
--
-- Solution: Start from the SMALL user sets (presences ~9, favorites ~259, past ~44)
--   and only apply ST_DWithin for the places those users are at.
--   Result: 466ms (18x improvement vs original 8.5s).
--
-- Behavior identical to 20260218162600_fix_trending_places_sort_by_total_people.sql:
--   - Same return columns and types
--   - Same eligibility filters via is_eligible_match()
--   - Same regular sources: past checkins (60d) + favorites + university members
--   - Same sort: (active + regulars) DESC, active DESC, dist_meters ASC
--   - Same cold-start: include places with regulars even when no active users
--   - Same avatar priority: active users first, regulars as fallback, max 5
-- =============================================================================

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
  safe_offset    int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
BEGIN
  RETURN QUERY
  WITH

  -- ─── 1. ELIGIBLE ACTIVE USERS (start from user_presences — tiny set ~9 rows) ───
  eligible_active AS (
    SELECT DISTINCT
      up.place_id,
      up.user_id
    FROM user_presences up
    WHERE up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),

  -- ─── 2. ELIGIBLE REGULARS — favorites ───
  eligible_favorites AS (
    SELECT pfp.place_id, pfp.user_id
    FROM profile_favorite_places pfp
    WHERE (requesting_user_id IS NULL OR pfp.user_id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = pfp.user_id AND ea.place_id = pfp.place_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, pfp.user_id))
  ),

  -- ─── 3. ELIGIBLE REGULARS — past visitors (last 60 days) ───
  eligible_past_visitors AS (
    SELECT DISTINCT up.place_id, up.user_id
    FROM user_presences up
    WHERE up.active = false
      AND up.entered_at > NOW() - INTERVAL '60 days'
      AND (requesting_user_id IS NULL OR up.user_id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = up.user_id AND ea.place_id = up.place_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, up.user_id))
  ),

  -- ─── 4. ELIGIBLE REGULARS — university members ───
  eligible_university_members AS (
    SELECT p.university_id AS place_id, p.id AS user_id
    FROM profiles p
    WHERE p.university_id IS NOT NULL
      AND (requesting_user_id IS NULL OR p.id <> requesting_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM eligible_active ea
        WHERE ea.user_id = p.id AND ea.place_id = p.university_id
      )
      AND (requesting_user_id IS NULL OR is_eligible_match(requesting_user_id, p.id))
  ),

  -- ─── 5. ALL ELIGIBLE REGULARS (union) ───
  eligible_regulars AS (
    SELECT place_id, user_id FROM eligible_favorites
    UNION
    SELECT place_id, user_id FROM eligible_past_visitors
    UNION
    SELECT place_id, user_id FROM eligible_university_members
  ),

  -- ─── 6. CANDIDATE PLACE IDs (union of all referenced places) ───
  candidate_place_ids AS (
    SELECT place_id FROM eligible_active
    UNION
    SELECT place_id FROM eligible_regulars
  ),

  -- ─── 7. RESOLVE PLACE DATA + DISTANCE FILTER ───
  -- ST_DWithin is only applied to places referenced by actual users (small set)
  places_with_distance AS (
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
      p.country_code AS country,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    INNER JOIN candidate_place_ids cp ON cp.place_id = p.id
    WHERE p.active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),

  -- ─── 8. COUNTS per place ───
  active_counts AS (
    SELECT ea.place_id, COUNT(*)::bigint AS active_users_count
    FROM eligible_active ea
    INNER JOIN places_with_distance pwd ON pwd.id = ea.place_id
    GROUP BY ea.place_id
  ),
  regulars_counts AS (
    SELECT er.place_id, COUNT(*)::integer AS regulars_cnt
    FROM eligible_regulars er
    INNER JOIN places_with_distance pwd ON pwd.id = er.place_id
    GROUP BY er.place_id
  ),

  -- ─── 9. COMBINED PLACE ACTIVITY ───
  place_activity AS (
    SELECT
      pwd.*,
      COALESCE(ac.active_users_count, 0) AS active_users_count,
      COALESCE(rc.regulars_cnt, 0)       AS regulars_cnt
    FROM places_with_distance pwd
    LEFT JOIN active_counts ac   ON ac.place_id = pwd.id
    LEFT JOIN regulars_counts rc ON rc.place_id = pwd.id
  ),

  -- ─── 10. TOTAL COUNT ───
  total AS (
    SELECT COUNT(*)::bigint AS cnt FROM place_activity
  ),

  -- ─── 11. PAGINATED SLICE — same sort as before ───
  limited_places AS (
    SELECT * FROM place_activity
    ORDER BY (active_users_count + regulars_cnt) DESC,
             active_users_count DESC,
             dist_meters ASC
    LIMIT safe_page_size OFFSET safe_offset
  ),

  -- ─── 12. REVIEWS — only for paginated places ───
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision AS review_average,
      COALESCE(r.review_count, 0)::bigint        AS review_count,
      COALESCE(r.top_tags, ARRAY[]::text[])      AS review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision AS avg_stars,
        COUNT(*)::bigint                 AS review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t       ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) AS top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  ),

  -- ─── 13. ACTIVE AVATARS — bulk fetch for paginated places only (max 5) ───
  active_avatars_raw AS (
    SELECT
      ea.place_id, ea.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY ea.place_id ORDER BY ea.user_id, pp.position ASC) AS rn
    FROM eligible_active ea
    INNER JOIN limited_places lp ON lp.id = ea.place_id
    INNER JOIN LATERAL (
      SELECT url, position FROM profile_photos
      WHERE user_id = ea.user_id AND url IS NOT NULL
      ORDER BY position ASC LIMIT 1
    ) pp ON true
  ),
  active_avatars AS (
    SELECT place_id,
      jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM active_avatars_raw WHERE rn <= 5
    GROUP BY place_id
  ),

  -- ─── 14. REGULAR AVATARS — fallback when no active avatars (max 5) ───
  regular_avatars_raw AS (
    SELECT
      er.place_id, er.user_id, pp.url,
      ROW_NUMBER() OVER (PARTITION BY er.place_id ORDER BY er.user_id, pp.position ASC) AS rn
    FROM eligible_regulars er
    INNER JOIN limited_places lp ON lp.id = er.place_id
    INNER JOIN LATERAL (
      SELECT url, position FROM profile_photos
      WHERE user_id = er.user_id AND url IS NOT NULL
      ORDER BY position ASC LIMIT 1
    ) pp ON true
  ),
  regular_avatars AS (
    SELECT place_id,
      jsonb_agg(jsonb_build_object('user_id', user_id, 'url', url) ORDER BY rn) AS avatars
    FROM regular_avatars_raw WHERE rn <= 5
    GROUP BY place_id
  )

  -- ─── FINAL SELECT ───
  SELECT
    wr.id, wr.name, wr.category, wr.lat, wr.lng, wr.street, wr.house_number,
    wr.neighborhood, wr.city, wr.state, wr.country,
    wr.review_average, wr.review_count, wr.review_tags, wr.dist_meters,
    wr.active_users_count                    AS active_users,
    COALESCE(aa.avatars, ra.avatars)         AS preview_avatars,
    (SELECT cnt FROM total)                   AS total_count,
    wr.regulars_cnt                          AS regulars_count
  FROM with_reviews wr
  LEFT JOIN active_avatars  aa ON aa.place_id = wr.id
  LEFT JOIN regular_avatars ra ON ra.place_id = wr.id
  ORDER BY (wr.active_users_count + wr.regulars_cnt) DESC,
           wr.active_users_count DESC,
           wr.dist_meters ASC;

END;
$function$;

GRANT EXECUTE ON FUNCTION get_trending_places(double precision, double precision, double precision, uuid, integer, integer)
  TO authenticated, anon;
