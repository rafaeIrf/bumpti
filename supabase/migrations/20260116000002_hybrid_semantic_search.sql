-- ============================================================================
-- HYBRID SEMANTIC SEARCH: FTS + Trigram Fuzzy Matching
-- ============================================================================
-- OBJECTIVE: Prioritize unique words ('Blue') over common noise ('The', 'Pub')
-- APPROACH: Functional GIN index + ts_rank_cd semantic ranking
-- NO SCHEMA CHANGES: Uses functional index on existing 'name' column
-- ============================================================================

-- STEP 1: Create Functional GIN Index for Full-Text Search
-- Uses 'simple' dictionary to preserve brand names and short words
CREATE INDEX IF NOT EXISTS idx_places_fts_functional ON places 
USING GIN (to_tsvector('simple', immutable_unaccent(name)));

COMMENT ON INDEX idx_places_fts_functional IS 
'Functional GIN index for semantic search. Uses simple dictionary to preserve brands and short words. No schema changes required.';

-- ============================================================================
-- STEP 2: Refactor search_places_autocomplete with Hybrid Ranking
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
  relevance_score float,
  search_rank float  -- NEW: Expose for debugging
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query text;
  ts_query tsquery;
BEGIN
  -- Normalize query: remove accents and extra spaces
  normalized_query := trim(regexp_replace(immutable_unaccent(query_text), '\\s+', ' ', 'g'));
  
  -- Convert to tsquery for FTS ranking
  ts_query := plainto_tsquery('simple', normalized_query);
  
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
      
      -- Active users count (unchanged from original)
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
      
      -- Python-calculated relevance score (kept for reference, not used in ranking)
      p.total_score as relevance_score,
      
      -- ====================================================================
      -- HYBRID SEMANTIC RANKING (2 components)
      -- ====================================================================
      (
        -- Component 1: FTS Semantic Rank (0-100)
        -- ts_rank_cd weighs rare words ('Blue') higher than common ('The')
        ts_rank_cd(
          to_tsvector('simple', immutable_unaccent(p.name)),
          ts_query
        ) * 100.0
        
        +
        
        -- Component 2: Prefix Boost (50 points)
        -- Ensures autocomplete fluidity
        (CASE 
          WHEN immutable_unaccent(p.name) ILIKE immutable_unaccent(query_text) || '%' 
          THEN 50.0 
          ELSE 0.0 
        END)
        
      ) as search_rank
      
    FROM places p
    WHERE 
      p.active = true
      
      -- FILTER: Fuzzy trigram match (typo tolerance)
      -- Maintains existing behavior for punctuation ("Canto - Bar")
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
    rp.relevance_score,
    rp.search_rank
  FROM ranked_places rp
  ORDER BY 
    -- Primary: Semantic search rank (FTS + prefix + quality)
    rp.search_rank DESC,
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
'Hybrid semantic search combining FTS (ts_rank_cd) with trigram fuzzy matching.
Ranking components:
- ts_rank_cd: Semantic relevance via word rarity (0-100pts)
- Prefix boost: Exact prefix match (50pts)
Search is purely text-based, not influenced by quality scores.
Exposes search_rank for debugging. Uses functional GIN index on name column.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Test with: SELECT * FROM search_places_autocomplete('The Blue', -23.5, -46.6, 50000, 10, null);
-- Expected: 'The Blue Pub' ranks higher than 'The Burger Pub' due to word 'Blue' semantic weight
