-- =============================================================================
-- Migration: Add Precision Geofencing with Safety Margin
-- =============================================================================
-- Enables boundary-based geofencing for POIs:
-- - Area categories (parks, stadiums, universities): Real polygon boundaries
-- - Point categories (bars, restaurants): 60m precision circles
-- - All boundaries include 60m safety margin for GPS error compensation

-- =============================================================================
-- PART 1: Add boundary column to places table
-- =============================================================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS boundary geometry(Geometry, 4326);

-- GIST index for high-performance spatial intersection queries
CREATE INDEX IF NOT EXISTS idx_places_boundary_gist ON places USING GIST (boundary);

-- =============================================================================
-- PART 2: Add boundary_wkb_hex to staging_places
-- =============================================================================

ALTER TABLE staging_places ADD COLUMN IF NOT EXISTS boundary_wkb_hex text;

-- =============================================================================
-- PART 3: Update places_view to include boundary
-- =============================================================================

DROP VIEW IF EXISTS places_view;

CREATE OR REPLACE VIEW places_view AS
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
  p.postal_code,
  p.country_code,
  p.structural_score,
  p.social_score,
  p.total_score,
  p.last_activity_at,
  p.created_at,
  p.updated_at,
  p.active,
  p.relevance_score,
  p.confidence,
  p.socials,
  p.total_checkins,
  p.monthly_checkins,
  p.total_matches,
  p.monthly_matches,
  p.original_category,
  p.boundary,
  COALESCE(reviews.avg_stars, 0)::float as review_average,
  COALESCE(reviews.total_reviews, 0)::bigint as review_count,
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
WHERE p.active = true;

-- Grants
GRANT SELECT ON places_view TO authenticated;
GRANT SELECT ON places_view TO anon;

-- =============================================================================
-- PART 4: Update merge_staging_to_production to handle boundary
-- =============================================================================

DROP FUNCTION IF EXISTS merge_staging_to_production(uuid, double precision[], boolean);

CREATE OR REPLACE FUNCTION merge_staging_to_production(
  p_city_id uuid,
  p_bbox double precision[],  -- [min_lng, min_lat, max_lng, max_lat]
  is_final_batch boolean DEFAULT false
)
RETURNS TABLE (
  exact_updated bigint,
  exact_inserted bigint,
  duplicate_links bigint,
  soft_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exact_updated bigint := 0;
  v_exact_inserted bigint := 0;
  v_duplicate_links bigint := 0;
  v_soft_deleted bigint := 0;
  execution_start timestamptz := NOW();
BEGIN
  -- ====================================================================
  -- STEP 1: UPDATE existing places via exact overture_id match
  -- ====================================================================
  WITH updated AS (
    UPDATE places p
    SET
      name = s.name,
      category = s.category,
      lat = ST_Y(staging_wkb_to_geom(s.geom_wkb_hex)),
      lng = ST_X(staging_wkb_to_geom(s.geom_wkb_hex)),
      street = s.street,
      house_number = s.house_number,
      neighborhood = s.neighborhood,
      city = s.city,
      state = s.state,
      postal_code = s.postal_code,
      country_code = s.country_code,
      relevance_score = s.relevance_score,
      confidence = s.confidence,
      original_category = s.original_category,
      boundary = CASE 
        WHEN s.boundary_wkb_hex IS NOT NULL AND s.boundary_wkb_hex != '' 
        THEN ST_MakeValid(ST_Simplify(ST_GeomFromWKB(decode(s.boundary_wkb_hex, 'hex'), 4326), 0.00001))
        ELSE NULL 
      END,
      active = true,
      updated_at = execution_start  -- Mark as touched in this execution
    FROM staging_places s
    JOIN place_sources ps ON (
      ps.external_id = s.overture_id
      AND ps.provider = 'overture'
    )
    WHERE p.id = ps.place_id
    RETURNING p.id
  )
  SELECT count(*) INTO v_exact_updated FROM updated;

  -- ====================================================================
  -- STEP 2: INSERT new places (no match in place_sources)
  -- ====================================================================
  WITH new_places AS (
    SELECT
      s.name,
      s.category,
      ST_Y(staging_wkb_to_geom(s.geom_wkb_hex)) as lat,
      ST_X(staging_wkb_to_geom(s.geom_wkb_hex)) as lng,
      s.street,
      s.house_number,
      s.neighborhood,
      s.city,
      s.state,
      s.postal_code,
      s.country_code,
      s.relevance_score,
      s.confidence,
      s.original_category,
      s.overture_id,
      s.geom_wkb_hex,
      CASE 
        WHEN s.boundary_wkb_hex IS NOT NULL AND s.boundary_wkb_hex != '' 
        THEN ST_MakeValid(ST_Simplify(ST_GeomFromWKB(decode(s.boundary_wkb_hex, 'hex'), 4326), 0.00001))
        ELSE NULL 
      END as boundary
    FROM staging_places s
    WHERE NOT EXISTS (
      SELECT 1 FROM place_sources ps
      WHERE ps.external_id = s.overture_id
      AND ps.provider = 'overture'
    )
  ),
  inserted AS (
    INSERT INTO places (
      name, category, lat, lng, street, house_number, neighborhood,
      city, state, postal_code, country_code, relevance_score,
      confidence, original_category, boundary, active, created_at, updated_at
    )
    SELECT
      name, category, lat, lng, street, house_number, neighborhood,
      city, state, postal_code, country_code, relevance_score,
      confidence, original_category, boundary, true, execution_start, execution_start
    FROM new_places
    RETURNING id, lat, lng
  )
  INSERT INTO place_sources (place_id, provider, external_id, raw)
  SELECT 
    i.id, 
    'overture', 
    np.overture_id, 
    NULL
  FROM inserted i
  JOIN new_places np ON (
    abs(i.lat - np.lat) < 0.0000001 
    AND abs(i.lng - np.lng) < 0.0000001
  )
  ON CONFLICT (provider, external_id) DO NOTHING;

  GET DIAGNOSTICS v_exact_inserted = ROW_COUNT;

  -- ====================================================================
  -- STEP 3: Soft delete (Final batch only)
  -- FIX: Timestamp marking + bbox prevents deactivating previous batches
  -- ====================================================================
  IF is_final_batch THEN
    WITH deactivated AS (
      UPDATE places p
      SET active = false, updated_at = execution_start
      WHERE p.active = true
        -- Only Overture POIs
        AND EXISTS (
          SELECT 1 FROM place_sources ps
          WHERE ps.place_id = p.id
          AND ps.provider = 'overture'
        )
        -- NOT touched in this execution (all batches)
        AND p.updated_at < execution_start - INTERVAL '1 hour'
        -- Within city bbox (spatial filter)
        AND p.lng >= p_bbox[1] AND p.lng <= p_bbox[3]
        AND p.lat >= p_bbox[2] AND p.lat <= p_bbox[4]
      RETURNING p.id
    )
    SELECT count(*) INTO v_soft_deleted FROM deactivated;
  END IF;

  RETURN QUERY SELECT v_exact_updated, v_exact_inserted, v_duplicate_links, v_soft_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_staging_to_production(uuid, double precision[], boolean) TO authenticated, service_role;

-- =============================================================================
-- PART 5: Create get_current_place_candidate RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION get_current_place_candidate(
  user_lat float,
  user_lng float
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  relevance_score int,
  boundary_area_sqm float
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
    p.relevance_score,
    ST_Area(p.boundary::geography) as boundary_area_sqm
  FROM places p
  WHERE p.active = true
    AND p.boundary IS NOT NULL
    AND ST_Intersects(
      p.boundary,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
    )
  ORDER BY ST_Area(p.boundary) ASC, p.relevance_score DESC
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_place_candidate(float, float) TO authenticated, anon;

COMMENT ON FUNCTION get_current_place_candidate IS 
'Returns candidate places where the user might be located, based on boundary intersection.
Orders by area (smallest first) so more specific locations (e.g., a bar inside a park) 
appear before larger containing areas.';
