-- ============================================================================
-- FIX: Remove total_score dependency (column will be removed)
-- ============================================================================

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
  text_rank float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query text;
BEGIN
  normalized_query := trim(regexp_replace(immutable_unaccent(query_text), '\\s+', ' ', 'g'));
  
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
              AND ((ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
                   OR (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id))
          ))
          AND (requesting_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_matches um
            WHERE um.status = 'matched'
              AND ((um.user_a = requesting_user_id AND um.user_b = up.user_id)
                   OR (um.user_a = up.user_id AND um.user_b = requesting_user_id))
          ))
          AND (requesting_user_id IS NULL OR EXISTS (
            SELECT 1 FROM profile_connect_with pcw
            INNER JOIN profiles rp ON rp.id = requesting_user_id
            WHERE pcw.user_id = up.user_id
              AND pcw.gender_id = rp.gender_id
          ))
      ) AS active_users,
      
      case 
        when user_lat is not null and user_lng is not null then
          st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          )
        else
          null::float
      end as dist_meters,
      
      -- PURE TEXT RANKING (no quality score dependency)
      (
        CASE
          -- Tier 1: EXACT MATCH (1000 points)
          WHEN lower(immutable_unaccent(p.name)) = lower(normalized_query) THEN 1000.0
          
          -- Tier 2: STARTS WITH (500 points)
          WHEN immutable_unaccent(p.name) ILIKE immutable_unaccent(query_text) || '%' THEN 500.0
          
          -- Tier 3: CONTAINS (200 points)
          WHEN immutable_unaccent(p.name) ILIKE '%' || immutable_unaccent(query_text) || '%' THEN 200.0
          
          -- Tier 4: FUZZY FALLBACK (100 points)
          WHEN word_similarity(normalized_query, immutable_unaccent(p.name)) > 0.2 THEN 100.0
          
          ELSE 0.0
        END
      )::double precision as text_rank
      
    FROM places p
    WHERE 
      p.active = true
      AND (
        lower(immutable_unaccent(p.name)) = lower(normalized_query)
        OR immutable_unaccent(p.name) ILIKE immutable_unaccent(query_text) || '%'
        OR immutable_unaccent(p.name) ILIKE '%' || immutable_unaccent(query_text) || '%'
        OR word_similarity(normalized_query, immutable_unaccent(p.name)) > 0.2
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
    rp.text_rank
  FROM ranked_places rp
  WHERE rp.text_rank > 0
  ORDER BY 
    rp.text_rank DESC,
    CASE WHEN rp.dist_meters IS NOT NULL THEN rp.dist_meters ELSE 999999999 END ASC
  LIMIT max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION search_places_autocomplete(text, float, float, float, int, uuid) TO authenticated, anon;

COMMENT ON FUNCTION search_places_autocomplete IS 
'Pure text hierarchy search (no quality score dependency).
Tiers: exact (1000), prefix (500), contains (200), fuzzy (100).
Safe for total_score column removal.';
