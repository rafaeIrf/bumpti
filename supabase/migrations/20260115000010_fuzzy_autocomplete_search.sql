-- Professional Fuzzy Search RPC with pg_trgm Similarity Ranking
-- Replaces ILIKE with similarity operators and implements composite scoring

DROP FUNCTION IF EXISTS search_places_autocomplete(text, float, float, float, int, uuid);

CREATE OR REPLACE FUNCTION search_places_autocomplete(
  query_text text,
  user_lat float default null,
  user_lng float default null,
  radius_meters float default 50000, -- Default 50km
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
  relevance_score float  -- NEW: Expose relevance for debugging
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query text;
BEGIN
  -- Normalize query: remove accents and extra spaces
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
      
      -- Active users count (replicated from original)
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
      
      -- Distance calculation
      case 
        when user_lat is not null and user_lng is not null then
          st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          )
        else
          null::float
      end as dist_meters,
      
      -- COMPOSITE RELEVANCE SCORE
      (
        -- Component 1: Word Similarity (0-1 range, weight: 100)
        (word_similarity(normalized_query, immutable_unaccent(p.name)) * 100.0)
        
        +
        
        -- Component 2: Prefix Bonus (50 points if starts with query)
        (CASE 
          WHEN immutable_unaccent(p.name) ILIKE immutable_unaccent(query_text) || '%' 
          THEN 50.0 
          ELSE 0.0 
        END)
        
        +
        
        -- Component 3: Exact Match Bonus (100 points for perfect match)
        (CASE 
          WHEN lower(immutable_unaccent(p.name)) = lower(normalized_query)
          THEN 100.0
          ELSE 0.0
        END)
        
        +
        
        -- Component 4: Popularity Score (normalized, weight: 20)
        (LEAST(p.total_score / 100.0, 1.0) * 20.0)
        
      ) as relevance_score
      
    FROM places p
    WHERE 
      p.active = true
      
      -- Fuzzy text match using pg_trgm similarity operator
      -- This replaces "unaccent(p.name) ilike '%' || unaccent(query_text) || '%'"
      AND (
        immutable_unaccent(query_text) <% immutable_unaccent(p.name)
        OR 
        word_similarity(normalized_query, immutable_unaccent(p.name)) > 0.3
      )
      
      -- Spatial filter FIRST for performance (uses GiST index)
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
    -- Primary: Relevance score (text similarity + prefix + popularity)
    rp.relevance_score DESC,
    -- Secondary: Active users (engagement)
    rp.active_users DESC,
    -- Tertiary: Distance (proximity)
    CASE WHEN rp.dist_meters IS NOT NULL THEN rp.dist_meters ELSE 999999999 END ASC
  LIMIT max_results;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_places_autocomplete(text, float, float, float, int, uuid) TO authenticated, anon;

-- Add comprehensive comment
COMMENT ON FUNCTION search_places_autocomplete IS 
'Fuzzy autocomplete search using pg_trgm with composite relevance scoring. 
Scores combine: word_similarity (100pts), prefix match (50pts), exact match (100pts), popularity (20pts). 
Handles punctuation ("Canto - Bar" matches "Canto Bar"). 
Optimized with spatial filter first (ST_DWithin).';
