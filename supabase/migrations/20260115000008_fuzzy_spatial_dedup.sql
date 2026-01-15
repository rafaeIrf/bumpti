-- Fuzzy Spatial Deduplication - Quality-based merge with pg_trgm similarity
-- This replaces the simple overture_id-based deduplication with intelligent fuzzy matching
-- NOTE: Requires immutable_unaccent() function from migration 007

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS merge_staging_to_production(UUID);

CREATE OR REPLACE FUNCTION merge_staging_to_production(p_city_id UUID DEFAULT NULL)
RETURNS TABLE (
  inserted INT,
  updated INT,
  sources_updated INT,
  deactivated INT,
  fuzzy_merged INT
) AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
  v_sources_updated INT := 0;  -- Renamed from v_source for consistency
  v_deactivated INT := 0;
  v_fuzzy_merged INT := 0;
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
  -- STEP 2: FUZZY SPATIAL DEDUPLICATION
  -- Find potential duplicates using proximity + name similarity
  -- Resolution: Keep record with highest structural_score
  -- ===========================================
  WITH fuzzy_candidates AS (
    -- Find staging records NOT in place_sources (potential new inserts)
    SELECT 
      s.overture_id as staging_id,
      s.name as staging_name,
      s.category as staging_category,
      s.structural_score as staging_score,
      ST_SetSRID(ST_MakePoint(
        ST_X(staging_wkb_to_geom(s.geom_wkb_hex)),
        ST_Y(staging_wkb_to_geom(s.geom_wkb_hex))
      ), 4326) as staging_geom,
      s.street,
      s.house_number,
      s.neighborhood,
      s.city,
      s.state,
      s.postal_code,
      s.country_code,
      s.confidence,
      s.original_category,
      s.geom_wkb_hex,
      s.overture_raw
    FROM staging_places s
    WHERE s.overture_id NOT IN (
      SELECT external_id FROM place_sources WHERE provider = 'overture'
    )
  ),
  fuzzy_matches AS (
    -- Match staging with existing places using spatial + text similarity
    -- ADAPTIVE RADIUS: 800m for large venues (parks, universities, stadiums), 50m for others
    SELECT DISTINCT ON (fc.staging_id)
      fc.staging_id,
      p.id as existing_place_id,
      p.name as existing_name,
      p.structural_score as existing_score,
      fc.staging_score,
      fc.staging_name,
      fc.staging_category,
      fc.staging_geom,
      fc.street,
      fc.house_number,
      fc.neighborhood,
      fc.city,
      fc.state,
      fc.postal_code,
      fc.country_code,
      fc.confidence,
      fc.original_category,
      fc.geom_wkb_hex,
      fc.overture_raw,
      similarity(immutable_unaccent(lower(p.name)), immutable_unaccent(lower(fc.staging_name))) as name_similarity,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        fc.staging_geom::geography
      ) as distance_meters,
      -- Calculate adaptive radius based on category
      CASE 
        WHEN fc.staging_category IN ('park', 'university', 'stadium', 'airport') 
        THEN 800.0  -- 800 meters for large venues
        ELSE 50.0   -- 50 meters for regular places
      END as adaptive_radius
    FROM fuzzy_candidates fc
    JOIN places p ON (
      -- ADAPTIVE SPATIAL PROXIMITY FILTER
      ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        fc.staging_geom::geography,
        CASE 
          WHEN fc.staging_category IN ('park', 'university', 'stadium') 
          THEN 800.0  -- 800 meters for large venues
          ELSE 50.0   -- 50 meters for regular places
        END
      )
      -- Text similarity filter (70% match) - case and accent insensitive
      AND similarity(immutable_unaccent(lower(p.name)), immutable_unaccent(lower(fc.staging_name))) > 0.7
      -- Category compatibility (same category or NULL)
      AND (p.category = fc.staging_category OR p.category IS NULL OR fc.staging_category IS NULL)
      -- Only active places
      AND p.active = true
    )
    -- ORDER BY: prioritize higher name similarity, then closer distance
    ORDER BY fc.staging_id, similarity(immutable_unaccent(lower(p.name)), immutable_unaccent(lower(fc.staging_name))) DESC, distance_meters ASC
  ),
  quality_winners AS (
    -- Update existing if staging has BETTER quality
    UPDATE places p
    SET
      name = fm.staging_name,
      category = fm.staging_category,
      lat = ST_Y(fm.staging_geom),
      lng = ST_X(fm.staging_geom),
      street = fm.street,
      house_number = fm.house_number,
      neighborhood = fm.neighborhood,
      city = fm.city,
      state = fm.state,
      postal_code = fm.postal_code,
      country_code = fm.country_code,
      structural_score = fm.staging_score,
      confidence = fm.confidence,
      original_category = fm.original_category,
      active = true,
      updated_at = NOW()
    FROM fuzzy_matches fm
    WHERE p.id = fm.existing_place_id
      AND fm.staging_score > fm.existing_score  -- Only update if better quality
    RETURNING p.id, fm.staging_id
  ),
  fuzzy_sources AS (
    -- Link new overture_id to existing place (multi-ID support)
    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
    SELECT 
      qw.id as place_id,
      'overture'::text,
      qw.staging_id,
      fm.overture_raw,
      NOW()
    FROM quality_winners qw
    JOIN fuzzy_matches fm ON fm.staging_id = qw.staging_id
    ON CONFLICT (provider, external_id) DO UPDATE SET
      place_id = EXCLUDED.place_id,  -- Allow re-linking to better place
      raw = EXCLUDED.raw,
      created_at = NOW()
    RETURNING *
  ),
  ignored_losers AS (
    -- For losers (existing_score >= staging_score), just link the ID
    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
    SELECT
      fm.existing_place_id,
      'overture'::text,
      fm.staging_id,
      fm.overture_raw,
      NOW()
    FROM fuzzy_matches fm
    WHERE fm.staging_score <= fm.existing_score
      AND fm.staging_id NOT IN (SELECT staging_id FROM quality_winners)
    ON CONFLICT (provider, external_id) DO UPDATE SET
      place_id = EXCLUDED.place_id,
      raw = EXCLUDED.raw,
      created_at = NOW()
    RETURNING *
  )
  SELECT 
    (SELECT COUNT(*) FROM quality_winners) + (SELECT COUNT(*) FROM ignored_losers)
  INTO v_fuzzy_merged;

  -- ===========================================
  -- STEP 3: INSERT truly new places (no fuzzy match found)
  -- Internal deduplication is now handled in Python before bulk insert
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
      -- Exclude already matched (exact or fuzzy)
      SELECT external_id FROM place_sources WHERE provider = 'overture'
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  -- ===========================================
  -- STEP 4: UPSERT place_sources for new inserts
  -- Links overture_ids to places (Python handles dedup, so 1:1 mapping here)
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
      AND s.overture_id NOT IN (
        SELECT external_id FROM place_sources WHERE provider = 'overture'
      )
    ON CONFLICT (provider, external_id) DO UPDATE SET
      place_id = EXCLUDED.place_id,
      raw = EXCLUDED.raw,
      created_at = NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_sources_updated FROM sources_upserted;

  -- ===========================================
  -- STEP 5: SOFT DELETE missing places (update mode only)
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
          AND ST_Intersects(v_city_bbox, ST_MakeEnvelope(pl.lng - 0.01, pl.lat - 0.01, pl.lng + 0.01, pl.lat + 0.01, 4326))
          AND ST_Contains(v_city_bbox, ST_SetSRID(ST_MakePoint(pl.lng, pl.lat), 4326))
          AND ps.external_id NOT IN (SELECT overture_id FROM staging_places)
      )
      RETURNING p.id
    )
    SELECT COUNT(*) INTO v_deactivated FROM deactivated;
  END IF;

  -- Return comprehensive stats
  RETURN QUERY SELECT v_inserted, v_updated, v_sources_updated, v_deactivated, v_fuzzy_merged;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION merge_staging_to_production(UUID) TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION merge_staging_to_production IS 'Fuzzy spatial deduplication with quality-based conflict resolution and adaptive radius. Uses pg_trgm similarity (>0.7) and adaptive ST_DWithin (800m for parks/universities/stadiums, 50m for others). Keeps highest structural_score record.';
