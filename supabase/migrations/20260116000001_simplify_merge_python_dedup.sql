-- Simplify merge_staging_to_production by removing SQL fuzzy matching
-- Python now handles deduplication before data reaches staging

DROP FUNCTION IF EXISTS merge_staging_to_production(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION merge_staging_to_production(
  p_city_id UUID DEFAULT NULL,
  p_is_final_batch BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  inserted INT,
  updated INT,
  sources_updated INT,
  deactivated INT
) AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
  v_sources_updated INT := 0;
  v_deactivated INT := 0;
  v_city_bbox GEOMETRY;
BEGIN
  -- Get city bounding box if updating specific city
  IF p_city_id IS NOT NULL THEN
    SELECT geom INTO v_city_bbox
    FROM cities_registry
    WHERE id = p_city_id;
  END IF;

  -- ===========================================
  -- STEP 1: UPDATE existing places via exact overture_id match
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
      relevance_score = s.relevance_score,
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
  -- STEP 2: REMOVED - Python handles deduplication
  -- ===========================================
  -- Fuzzy spatial deduplication now happens in Python before staging.
  -- This eliminates database locks and improves performance.

  -- ===========================================
  -- STEP 3: INSERT new places (not matched)
  -- ===========================================
  WITH inserted AS (
    INSERT INTO places (
      name,
      category,
      lat,
      lng,
      street,
      house_number,
      neighborhood,
      city,
      state,
      postal_code,
      country_code,
      relevance_score,
      confidence,
      original_category,
      active,
      created_at
    )
    SELECT DISTINCT ON (s.overture_id)
      s.name,
      s.category,
      ST_Y(staging_wkb_to_geom(s.geom_wkb_hex)),
      ST_X(staging_wkb_to_geom(s.geom_wkb_hex)),
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
      true,
      s.created_at
    FROM staging_places s
    WHERE s.overture_id NOT IN (
      SELECT external_id FROM place_sources WHERE provider = 'overture'
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  -- ===========================================
  -- STEP 4: UPSERT place_sources for new inserts
  -- ===========================================
  WITH sources_upserted AS (
    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
    SELECT DISTINCT ON (s.overture_id)
      p.id,
      'overture'::text,
      s.overture_id,
      s.overture_raw,
      NOW()
    FROM staging_places s
    JOIN places p ON (
      ABS(p.lat - ST_Y(staging_wkb_to_geom(s.geom_wkb_hex))) < 0.00001
      AND ABS(p.lng - ST_X(staging_wkb_to_geom(s.geom_wkb_hex))) < 0.00001
      AND p.name = s.name
    )
    WHERE s.overture_id IS NOT NULL
      AND s.overture_id NOT IN (
        SELECT external_id FROM place_sources WHERE provider = 'overture'
      )
    ORDER BY s.overture_id, p.created_at DESC
    ON CONFLICT (provider, external_id) DO UPDATE SET
      place_id = EXCLUDED.place_id,
      raw = EXCLUDED.raw,
      created_at = NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_sources_updated FROM sources_upserted;

  -- ===========================================
  -- STEP 5: SOFT DELETE missing places (ONLY ON FINAL BATCH!)
  -- ===========================================
  IF p_city_id IS NOT NULL AND p_is_final_batch THEN
    WITH deactivated AS (
      UPDATE places p
      SET active = false, updated_at = NOW()
      WHERE p.id IN (
        SELECT ps.place_id
        FROM place_sources ps
        JOIN places pl ON pl.id = ps.place_id
        WHERE ps.provider = 'overture'
          AND pl.active = true
          AND ST_Intersects(v_city_bbox, ST_MakeEnvelope(pl.lng - 0.01, pl.lat - 0.01, pl.lng + 0.01, pl.lat + 0.01, 4326))
          AND ST_Contains(v_city_bbox, ST_SetSRID(ST_MakePoint(pl.lng, pl.lat), 4326))
          AND ps.external_id NOT IN (SELECT overture_id FROM staging_places)
      )
      RETURNING p.id
    )
    SELECT COUNT(*) INTO v_deactivated FROM deactivated;
  END IF;

  -- Return stats (removed fuzzy_merged column)
  RETURN QUERY SELECT v_inserted, v_updated, v_sources_updated, v_deactivated;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION merge_staging_to_production(UUID, BOOLEAN) TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION merge_staging_to_production IS 'Simplified merge function. Fuzzy deduplication now handled by Python worker before staging. This eliminates database locks and improves performance for megacities.';
