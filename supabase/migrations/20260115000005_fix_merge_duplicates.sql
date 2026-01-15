-- Fix: Add DISTINCT ON to prevent duplicate overture_id insertions
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
  v_city_bbox GEOMETRY;
BEGIN
  IF p_city_id IS NOT NULL THEN
    SELECT ST_Envelope(geom) INTO v_city_bbox
    FROM cities_registry WHERE id = p_city_id;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS temp_inserted_places (
    place_id UUID, overture_id TEXT
  ) ON COMMIT DROP;
  TRUNCATE temp_inserted_places;

  -- STEP 1: UPDATE existing places
  WITH updated AS (
    UPDATE places p SET
      name = s.name, category = s.category,
      lat = ST_Y(staging_wkb_to_geom(s.geom_wkb_hex)),
      lng = ST_X(staging_wkb_to_geom(s.geom_wkb_hex)),
      street = s.street, house_number = s.house_number,
      neighborhood = s.neighborhood, city = s.city, state = s.state,
      postal_code = s.postal_code, country_code = s.country_code,
      structural_score = s.structural_score, confidence = s.confidence,
      original_category = s.original_category, active = true, updated_at = NOW()
    FROM staging_places s
    JOIN place_sources ps ON (ps.external_id = s.overture_id AND ps.provider = 'overture')
    WHERE p.id = ps.place_id
    RETURNING p.id
  ) SELECT COUNT(*) INTO v_updated FROM updated;

  -- STEP 2: INSERT new places (DISTINCT ON overture_id to prevent duplicates)
  WITH distinct_staging AS (
    SELECT DISTINCT ON (overture_id)
      name, category, geom_wkb_hex, street, house_number, neighborhood,
      city, state, postal_code, country_code, structural_score,
      confidence, original_category, created_at, overture_id
    FROM staging_places
    WHERE overture_id NOT IN (
      SELECT external_id FROM place_sources WHERE provider = 'overture'
    )
    ORDER BY overture_id, created_at
  ),
  inserted AS (
    INSERT INTO places (name, category, lat, lng, street, house_number, neighborhood, city, state, postal_code, country_code, structural_score, confidence, original_category, active, created_at)
    SELECT name, category, ST_Y(staging_wkb_to_geom(geom_wkb_hex)), ST_X(staging_wkb_to_geom(geom_wkb_hex)), street, house_number, neighborhood, city, state, postal_code, country_code, structural_score, confidence, original_category, true, created_at
    FROM distinct_staging
    RETURNING id, (
      SELECT overture_id FROM distinct_staging ds
      WHERE ABS(ST_Y(staging_wkb_to_geom(ds.geom_wkb_hex)) - places.lat) < 0.00001
        AND ABS(ST_X(staging_wkb_to_geom(ds.geom_wkb_hex)) - places.lng) < 0.00001
        AND ds.name = places.name
      LIMIT 1
    ) as overture_id
  )
  INSERT INTO temp_inserted_places SELECT id, overture_id FROM inserted;

  SELECT COUNT(*) INTO v_inserted FROM temp_inserted_places;

  -- STEP 3: INSERT place_sources (DISTINCT ON to prevent duplicates)
  WITH sources_inserted AS (
    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
    SELECT DISTINCT ON (tip.place_id)
      tip.place_id, 'overture'::text, tip.overture_id, s.overture_raw, NOW()
    FROM temp_inserted_places tip
    JOIN staging_places s ON s.overture_id = tip.overture_id
    WHERE tip.overture_id IS NOT NULL
    ORDER BY tip.place_id
    ON CONFLICT (place_id, provider) DO UPDATE SET raw = EXCLUDED.raw, created_at = NOW()
    RETURNING *
  ) SELECT COUNT(*) INTO v_source FROM sources_inserted;

  -- STEP 4: SOFT DELETE missing places (update mode only)
  IF p_city_id IS NOT NULL THEN
    WITH deactivated AS (
      UPDATE places p SET active = false, updated_at = NOW()
      WHERE p.id IN (
        SELECT ps.place_id FROM place_sources ps
        JOIN places pl ON pl.id = ps.place_id
        WHERE ps.provider = 'overture' AND pl.active = true
          AND ST_Intersects(v_city_bbox, ST_SetSRID(ST_MakePoint(pl.lng, pl.lat), 4326))
          AND ST_Contains((SELECT geom FROM cities_registry WHERE id = p_city_id), ST_SetSRID(ST_MakePoint(pl.lng, pl.lat), 4326))
          AND ps.external_id NOT IN (SELECT overture_id FROM staging_places)
      ) RETURNING p.id
    ) SELECT COUNT(*) INTO v_deactivated FROM deactivated;
  END IF;

  TRUNCATE staging_places;
  RETURN QUERY SELECT v_inserted, v_updated, v_deactivated, v_source;
END;
$$ LANGUAGE plpgsql;
