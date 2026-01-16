-- ============================================================================
-- FIX: Soft delete should check place_sources, not staging_places
-- ============================================================================
-- PROBLEM: Soft delete deactivates places not in final batch
-- SOLUTION: Check place_sources (all processed overture_ids) instead
-- ============================================================================

DROP FUNCTION IF EXISTS merge_staging_to_production(uuid, boolean);

CREATE OR REPLACE FUNCTION merge_staging_to_production(
  p_city_id uuid,
  is_final_batch boolean DEFAULT false
)
RETURNS TABLE (
  inserted bigint,
  updated bigint,
  deactivated bigint,
  linked bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted bigint := 0;
  v_updated bigint := 0;
  v_deactivated bigint := 0;
  v_linked bigint := 0;
BEGIN
  -- ====================================================================
  -- STEP 1: UPDATE existing places via exact overture_id match
  -- ====================================================================
  WITH updated AS (
    UPDATE places p
    SET
      name = s.name,
      category = s.category,
      lat = s.lat,
      lng = s.lng,
      street = s.street,
      house_number = s.house_number,
      neighborhood = s.neighborhood,
      city = s.city,
      state = s.state,
      postal_code = s.postal_code,
      country_code = s.country_code,
      confidence = s.confidence,
      source_raw = s.source_raw,
      updated_at = now()
    FROM staging_places s
    JOIN place_sources ps ON (
      ps.external_id = s.overture_id
      AND ps.provider = 'overture'
    )
    WHERE p.id = ps.place_id
    RETURNING p.id
  )
  SELECT count(*) INTO v_updated FROM updated;

  -- ====================================================================
  -- STEP 3: INSERT new places (overture_id not in place_sources)
  -- ====================================================================
  WITH inserted AS (
    INSERT INTO places (
      name, category, lat, lng, street, house_number,
      neighborhood, city, state, postal_code, country_code,
      confidence, source_raw, city_id, active
    )
    SELECT
      s.name, s.category, s.lat, s.lng, s.street, s.house_number,
      s.neighborhood, s.city, s.state, s.postal_code, s.country_code,
      s.confidence, s.source_raw, p_city_id, true
    FROM staging_places s
    WHERE s.overture_id NOT IN (
      SELECT external_id FROM place_sources WHERE provider = 'overture'
    )
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  -- ====================================================================
  -- STEP 4: Link new places to place_sources
  -- ====================================================================
  WITH linked AS (
    INSERT INTO place_sources (place_id, provider, external_id, source_raw)
    SELECT p.id, 'overture', s.overture_id, s.source_raw
    FROM staging_places s
    JOIN places p ON (
      p.lat = s.lat
      AND p.lng = s.lng
      AND p.name = s.name
      AND p.city_id = p_city_id
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM place_sources ps
      WHERE ps.place_id = p.id
        AND ps.provider = 'overture'
        AND ps.external_id = s.overture_id
    )
    ON CONFLICT (place_id, provider) DO UPDATE
    SET external_id = EXCLUDED.external_id,
        source_raw = EXCLUDED.source_raw
    RETURNING place_id
  )
  SELECT count(*) INTO v_linked FROM linked;

  -- ====================================================================
  -- STEP 5: Soft delete (ONLY final batch) - FIXED LOGIC
  -- ====================================================================
  IF is_final_batch THEN
    WITH deactivated AS (
      UPDATE places
      SET active = false, updated_at = now()
      WHERE city_id = p_city_id
        AND active = true
        -- FIX: Check place_sources instead of staging_places
        AND id NOT IN (
          SELECT ps.place_id
          FROM place_sources ps
          WHERE ps.provider = 'overture'
            AND ps.place_id IN (
              SELECT id FROM places WHERE city_id = p_city_id
            )
        )
      RETURNING id
    )
    SELECT count(*) INTO v_deactivated FROM deactivated;
  END IF;

  RETURN QUERY SELECT v_inserted, v_updated, v_deactivated, v_linked;
END;
$$;

COMMENT ON FUNCTION merge_staging_to_production IS 
'Merges staging_places into production with Python deduplication.
STEP 1: Update via overture_id
STEP 3: Insert new (not in place_sources)
STEP 4: Link to place_sources
STEP 5: Soft delete (checks place_sources, not staging) - FIXED';
