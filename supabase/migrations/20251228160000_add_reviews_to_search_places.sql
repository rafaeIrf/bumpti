-- Up Migration

DROP FUNCTION IF EXISTS search_places_nearby(float, float, float, text[], int, uuid);

CREATE OR REPLACE FUNCTION search_places_nearby(
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
    (
        SELECT count(*)
        FROM user_presences up
        WHERE up.place_id = p.id
          AND up.active = true
          AND up.ended_at IS NULL
          AND up.expires_at > now()
          AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
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
    ) AS active_users,
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
  ORDER BY dist_meters ASC, p.total_score DESC
  LIMIT max_results;
END;
$$;
