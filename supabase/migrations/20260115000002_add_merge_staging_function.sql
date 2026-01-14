-- =====================================================
-- Migration: Create merge_staging_to_production function
-- Purpose: Atomic UPSERT with soft delete support
-- =====================================================

CREATE OR REPLACE FUNCTION merge_staging_to_production(p_city_id UUID DEFAULT NULL)
RETURNS TABLE(
  inserted_count INT,
  updated_count INT,
  deactivated_count INT,
  source_count INT
)
AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
  v_deactivated INT := 0;
  v_source INT := 0;
  v_city_bbox GEOMETRY;  -- Envelope for BBox optimization
BEGIN
  -- Fetch city BBox for optimized soft delete  (update mode only)
  IF p_city_id IS NOT NULL THEN
    SELECT ST_Envelope(geom) INTO v_city_bbox
    FROM cities_registry
    WHERE id = p_city_id;
  END IF;

  -- ===========================================
  -- STEP 1: UPDATE existing places via overture_id
  -- ===========================================
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
      structural_score = s.structural_score,
      confidence = s.confidence,
      original_category = s.original_category,
      active = true,
      updated_at = NOW()
    FROM staging_places s
    JOIN place_sources ps ON (
      ps.external_id = s.overture_id
      AND ps.provider = 'overture'
    )
    WHERE p.id = ps.place_id
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_updated FROM updated;

  -- ===========================================
  -- STEP 2: INSERT new places (not in place_sources)
  -- ===========================================
  WITH inserted AS (
    INSERT INTO places (
      name, category, lat, lng, street, house_number,
      neighborhood, city, state, postal_code, country_code,
      structural_score, confidence, original_category,
      active, created_at
    )
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
      s.structural_score,
      s.confidence,
      s.original_category,
      true,
      s.created_at
    FROM staging_places s
    WHERE s.overture_id NOT IN (
      SELECT external_id
      FROM place_sources
      WHERE provider = 'overture'
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  -- ===========================================
  -- STEP 3: UPSERT place_sources tracking table
  -- ===========================================
  WITH sources_upserted AS (
    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
    SELECT
      p.id,
      'overture'::text,
      s.overture_id,
      s.overture_raw,
      NOW()
    FROM staging_places s
    JOIN places p ON (
      -- Match newly inserted by proximity + name
      ABS(p.lat - ST_Y(staging_wkb_to_geom(s.geom_wkb_hex))) < 0.00001
      AND ABS(p.lng - ST_X(staging_wkb_to_geom(s.geom_wkb_hex))) < 0.00001
      AND p.name = s.name
    )
    WHERE s.overture_id IS NOT NULL
    ON CONFLICT (place_id, provider)
    DO UPDATE SET
      raw = EXCLUDED.raw,
      created_at = NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_source FROM sources_upserted;

  -- ===========================================
  -- STEP 4: SOFT DELETE missing places (update mode only)
  -- Optimized with BBox pre-filter
  -- ===========================================
  IF p_city_id IS NOT NULL THEN
    WITH deactivated AS (
      UPDATE places p
      SET active = false, updated_at = NOW()
      WHERE p.id IN (
        SELECT ps.place_id
        FROM place_sources ps
        JOIN places pl ON pl.id = ps.place_id
        WHERE ps.provider = 'overture'
          AND pl.active = true
          -- Filter 1: Fast BBox check using envelope (uses spatial index)
          AND ST_Intersects(
            v_city_bbox,
            ST_SetSRID(ST_MakePoint(pl.lng, pl.lat), 4326)
          )
          -- Filter 2: Precise containment check (only on BBox candidates)
          AND ST_Contains(
            (SELECT geom FROM cities_registry WHERE id = p_city_id),
            ST_SetSRID(ST_MakePoint(pl.lng, pl.lat), 4326)
          )
          -- Not in current staging (means it was removed from Overture)
          AND ps.external_id NOT IN (
            SELECT overture_id FROM staging_places
          )
      )
      RETURNING p.id
    )
    SELECT COUNT(*) INTO v_deactivated FROM deactivated;
  END IF;

  -- ===========================================
  -- STEP 5: Clean up staging table
  -- ===========================================
  TRUNCATE staging_places;

  -- Return statistics
  RETURN QUERY SELECT v_inserted, v_updated, v_deactivated, v_source;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION merge_staging_to_production TO service_role;

-- Add comment
COMMENT ON FUNCTION merge_staging_to_production IS 'Atomic merge from staging to production with UPSERT and soft delete. Optimized with BBox pre-filter for large cities.';
