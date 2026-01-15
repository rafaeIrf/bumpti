-- Fix merge_staging_to_production DISTINCT ON syntax
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

  WITH inserted AS (
    INSERT INTO places (name, category, lat, lng, street, house_number, neighborhood, city, state, postal_code, country_code, structural_score, confidence, original_category, active, created_at)
    SELECT s.name, s.category, ST_Y(staging_wkb_to_geom(s.geom_wkb_hex)), ST_X(staging_wkb_to_geom(s.geom_wkb_hex)), s.street, s.house_number, s.neighborhood, s.city, s.state, s.postal_code, s.country_code, s.structural_score, s.confidence, s.original_category, true, NOW()
    FROM staging_places s
    WHERE s.overture_id NOT IN (SELECT external_id FROM place_sources WHERE provider = 'overture')
    RETURNING id, (SELECT overture_id FROM staging_places s2 WHERE ABS(ST_Y(staging_wkb_to_geom(s2.geom_wkb_hex)) - places.lat) < 0.00001 AND ABS(ST_X(staging_wkb_to_geom(s2.geom_wkb_hex)) - places.lng) < 0.00001 AND s2.name = places.name LIMIT 1) as overture_id
  ) INSERT INTO temp_inserted_places SELECT id, overture_id FROM inserted;

  SELECT COUNT(*) INTO v_inserted FROM temp_inserted_places;

  WITH sources_inserted AS (
    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
    SELECT DISTINCT ON (tip.place_id) tip.place_id, 'overture'::text, tip.overture_id, s.overture_raw, NOW()
    FROM temp_inserted_places tip
    JOIN staging_places s ON s.overture_id = tip.overture_id
    WHERE tip.overture_id IS NOT NULL
    ORDER BY tip.place_id
    ON CONFLICT (place_id, provider) DO UPDATE SET raw = EXCLUDED.raw, created_at = NOW()
    RETURNING *
  ) SELECT COUNT(*) INTO v_source FROM sources_inserted;

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
