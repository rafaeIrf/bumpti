-- ============================================================================
-- SIMPLIFIED TEXT HIERARCHY SEARCH
-- ============================================================================
-- OBJECTIVE: Eliminate noise by using strict text match hierarchy
-- APPROACH: CASE-based ranking (exact > prefix > contains) + minimal relevance tiebreaker
-- REMOVED: FTS/ts_rank_cd that caused false matches
-- ============================================================================

-- Drop FTS index (no longer needed)
DROP INDEX IF EXISTS idx_places_fts_functional;

-- ============================================================================
-- Refactor search_places_autocomplete with Text Hierarchy Ranking
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
  text_rank float  -- Expose for debugging
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query text;
BEGIN
  -- Normalize query: remove accents and extra spaces
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
      
      -- Active users count (unchanged)
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
      
      -- ====================================================================
      -- TEXT HIERARCHY RANKING (3 tiers + tiebreaker)
      -- ====================================================================
      (
        CASE
          -- Tier 1: EXACT MATCH (1000 points)
          WHEN lower(immutable_unaccent(p.name)) = lower(normalized_query) THEN 1000.0
          
          -- Tier 2: STARTS WITH (500 points)
          WHEN immutable_unaccent(p.name) ILIKE immutable_unaccent(query_text) || '%' THEN 500.0
          
          -- Tier 3: WORD CONTAINED (200 points)
          -- Matches whole word within name (e.g., "Blue" in "The Blue Pub")
          WHEN immutable_unaccent(p.name) ~* ('\\m' || immutable_unaccent(query_text) || '\\M') THEN 200.0
          
          -- Tier 4: FUZZY FALLBACK (100 points)
          -- Trigram similarity for typo tolerance
          WHEN word_similarity(normalized_query, immutable_unaccent(p.name)) > 0.3 THEN 100.0
          
          ELSE 0.0
        END
        
        +
        
        -- Minimal relevance tiebreaker (0-10 points)
        -- Only affects ordering within same text match tier
        (LEAST(p.total_score / 100.0, 1.0) * 10.0)
        
      ) as text_rank
      
    FROM places p
    WHERE 
      p.active = true
      
      -- FILTER: Fuzzy trigram match (typo tolerance)
      AND (
        immutable_unaccent(query_text) <% immutable_unaccent(p.name)
        OR 
        word_similarity(normalized_query, immutable_unaccent(p.name)) > 0.3
      )
      
      -- FILTER: Spatial constraint (uses GiST index)
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
  ORDER BY 
    -- Primary: Text match hierarchy (exact > prefix > contains)
    rp.text_rank DESC,
    -- Secondary: Distance (proximity tiebreaker)
    CASE WHEN rp.dist_meters IS NOT NULL THEN rp.dist_meters ELSE 999999999 END ASC
  LIMIT max_results;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_places_autocomplete(text, float, float, float, int, uuid) TO authenticated, anon;

-- Add comprehensive comment
COMMENT ON FUNCTION search_places_autocomplete IS 
'Simplified text hierarchy search with strict match tiers.
Ranking tiers:
- Exact match: 1000pts
- Starts with (prefix): 500pts
- Word contained: 200pts
- Fuzzy fallback: 100pts
- Relevance tiebreaker: 0-10pts
Ordered strictly by text_rank, then distance.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Test: SELECT * FROM search_places_autocomplete('The Blue', -23.5, -46.6, 50000, 10, null);
-- Expected: 'The Blue Pub' ranks 500pts (prefix), 'Academia Bluefit' ranks 200pts (word)
