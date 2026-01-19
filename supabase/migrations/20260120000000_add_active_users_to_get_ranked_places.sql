-- Add active_users to get_ranked_places RPC
-- This enables "+Frequentados" to show active user counts

DROP FUNCTION IF EXISTS get_ranked_places(float, float, float, text, int);
DROP FUNCTION IF EXISTS get_ranked_places(float, float, float, text, int, uuid);

CREATE OR REPLACE FUNCTION get_ranked_places(
  user_lat float,
  user_lng float,
  radius_meters float default 50000,
  rank_by text default 'monthly',
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
  review_average float,
  review_count bigint,
  review_tags text[],
  active_users bigint,
  dist_meters float,
  rank_position bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
      p.review_average,
      p.review_count,
      p.review_tags,
      COALESCE(au.active_users, 0) as active_users,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      CASE 
        WHEN rank_by = 'monthly' THEN 
          DENSE_RANK() OVER (ORDER BY p.monthly_checkins DESC, st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          ) ASC)
        ELSE 
          DENSE_RANK() OVER (ORDER BY p.total_checkins DESC, st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          ) ASC)
      END as rank_position
    FROM places_view p
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
        )::bigint as active_users
      FROM user_presences up
      WHERE up.place_id = p.id
        AND up.active = true
        AND up.ended_at IS NULL
        AND up.expires_at > now()
    ) au ON true
    WHERE
      st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (
        (rank_by = 'monthly' AND p.monthly_checkins > 0)
        OR (rank_by != 'monthly' AND p.total_checkins > 0)
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
    r.review_average,
    r.review_count,
    r.review_tags,
    r.active_users,
    r.dist_meters,
    r.rank_position
  FROM ranked r
  ORDER BY r.rank_position ASC
  LIMIT max_results;
END;
$$;
