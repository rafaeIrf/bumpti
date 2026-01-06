-- Update search_places_nearby to use places_view with filters + pagination

DROP FUNCTION IF EXISTS search_places_nearby(float, float, float, text[], int, uuid);
DROP FUNCTION IF EXISTS search_places_nearby(float, float, float, text[], int, uuid, text, double precision, integer);
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
    COALESCE(au.active_users, 0) as active_users,
    st_distance(
      st_setsrid(st_makepoint(pv.lng, pv.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) AS dist_meters
  FROM places_view pv
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (
        WHERE (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
          AND (requesting_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_blocks b 
            WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
               OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
          ))
          AND (requesting_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_interactions ui 
            WHERE ui.action = 'dislike'
              AND (
                  (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
                  OR 
                  (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
              )
          ))
          AND (requesting_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_matches um
            WHERE um.status = 'matched'
              AND (
                  (um.user_a = requesting_user_id AND um.user_b = up.user_id)
                  OR 
                  (um.user_a = up.user_id AND um.user_b = requesting_user_id)
              )
          ))
          AND (requesting_user_id IS NULL OR EXISTS (
            SELECT 1 FROM profile_connect_with pcw
            INNER JOIN profiles rp ON rp.id = requesting_user_id
            WHERE pcw.user_id = up.user_id
              AND pcw.gender_id = rp.gender_id
          ))
      )::bigint as active_users,
      count(*) FILTER (
        WHERE (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
      )::bigint as active_users_sort
    FROM user_presences up
    WHERE up.place_id = pv.id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > now()
  ) au ON true
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
    CASE WHEN sort_by = 'relevance' THEN COALESCE(au.active_users_sort, 0) END DESC,
    CASE WHEN sort_by = 'relevance' THEN pv.last_activity_at END DESC,
    CASE WHEN sort_by = 'relevance' THEN pv.relevance_score END DESC,
    CASE WHEN sort_by = 'relevance' THEN pv.confidence END DESC,
    dist_meters ASC,
    pv.relevance_score DESC
  LIMIT limit_amount
  OFFSET safe_offset;
END;
$$;
