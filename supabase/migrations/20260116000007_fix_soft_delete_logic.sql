-- ============================================================================
-- FIX: Soft delete should check place_sources, not staging_places
-- ============================================================================
-- PROBLEM: Soft delete deactivates places not in final batch
-- SOLUTION: Check place_sources (all processed overture_ids) instead
-- ============================================================================

DROP FUNCTION IF EXISTS merge_staging_to_production(uuid, boolean);

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
      city_id = p_city_id,
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
  SELECT count(*) INTO v_updated FROM updated;

  -- ====================================================================
  -- STEP 3: INSERT new places (overture_id not in place_sources)
  -- ====================================================================
  WITH inserted AS (
    INSERT INTO places (
      name, category, lat, lng, street, house_number,
      neighborhood, city, state, postal_code, country_code,
      relevance_score, confidence, original_category,
      city_id, active, created_at
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
      p_city_id,
      true,
      NOW()
    FROM staging_places s
    WHERE s.overture_id NOT IN (
      SELECT external_id FROM place_sources WHERE provider = 'overture'
    )
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  -- ====================================================================
  -- STEP 4: Link IDs na place_sources
  -- ====================================================================
  WITH linked AS (
    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
    SELECT DISTINCT ON (s.overture_id)
      p.id,
      'overture'::text,
      s.overture_id,
      s.overture_raw,
      NOW()
    FROM staging_places s
    JOIN places p ON (
      -- Match por precisão de GPS (WKB) + Nome
      ABS(p.lat - ST_Y(staging_wkb_to_geom(s.geom_wkb_hex))) < 0.00001
      AND ABS(p.lng - ST_X(staging_wkb_to_geom(s.geom_wkb_hex))) < 0.00001
      AND p.name = s.name
    )
    ON CONFLICT (provider, external_id) DO UPDATE SET
      place_id = EXCLUDED.place_id,
      raw = EXCLUDED.raw
    RETURNING place_id
  )
  SELECT count(*) INTO v_linked FROM linked;

  -- ====================================================================
  -- STEP 5: Soft delete (Somente no lote final)
  -- ====================================================================
  IF is_final_batch THEN
    WITH deactivated AS (
      UPDATE places
      SET active = false, updated_at = now()
      WHERE city_id = p_city_id
        AND active = true
        AND id NOT IN (
          SELECT ps.place_id
          FROM place_sources ps
          WHERE ps.provider = 'overture'
        )
      RETURNING id
    )
    SELECT count(*) INTO v_deactivated FROM deactivated;
  END IF;

  RETURN QUERY SELECT v_inserted, v_updated, v_deactivated, v_linked;
END;
$$;