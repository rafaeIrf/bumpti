-- ============================================================================
-- FIX: Critical Soft Delete Bug - Timestamp + BBox Filtering
-- ============================================================================
-- PROBLEM: Soft delete checked staging_places (only current batch)
--          Would deactivate all POIs from previous batches!
-- SOLUTION: Timestamp marking + bbox spatial filter
-- ============================================================================

DROP FUNCTION IF EXISTS merge_staging_to_production(uuid, boolean);
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
      s.geom_wkb_hex
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
      confidence, original_category, active, created_at, updated_at
    )
    SELECT
      name, category, lat, lng, street, house_number, neighborhood,
      city, state, postal_code, country_code, relevance_score,
      confidence, original_category, true, execution_start, execution_start
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
        AND p.updated_at < execution_start - INTERVAL '1 minute'
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