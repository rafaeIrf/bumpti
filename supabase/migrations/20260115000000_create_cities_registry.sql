-- =====================================================
-- Migration: Create cities_registry table
-- Purpose: Track city hydration status for lazy updates
-- =====================================================

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create cities_registry table
CREATE TABLE IF NOT EXISTS cities_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
  bbox FLOAT8[] NOT NULL CHECK(array_length(bbox, 1) = 4),
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  last_hydrated_at TIMESTAMPTZ,
  priority_score INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_city_country UNIQUE(city_name, country_code)
);

-- Create spatial index on geometry column
CREATE INDEX cities_registry_geom_idx 
  ON cities_registry USING GIST(geom);

-- Create index on status for filtering
CREATE INDEX cities_registry_status_idx 
  ON cities_registry(status);

-- Create composite index for priority-based queries
CREATE INDEX cities_registry_priority_idx 
  ON cities_registry(priority_score DESC, last_hydrated_at ASC NULLS FIRST);

-- Create spatial index on bbox for fast envelope queries
CREATE INDEX cities_registry_bbox_idx 
  ON cities_registry USING GIST(
    ST_MakeEnvelope(
      bbox[1], bbox[2], bbox[3], bbox[4], 4326
    )
  );

-- Grant permissions
GRANT SELECT ON cities_registry TO authenticated;
GRANT SELECT ON cities_registry TO anon;

-- Add comment
COMMENT ON TABLE cities_registry IS 'Tracks city hydration status for on-demand global expansion with lazy SWR updates';
COMMENT ON COLUMN cities_registry.bbox IS 'Bounding box in GIS format: [minLon, minLat, maxLon, maxLat]';
COMMENT ON COLUMN cities_registry.priority_score IS 'Priority for revalidation based on recent activity (check-ins, matches)';
COMMENT ON COLUMN cities_registry.last_hydrated_at IS 'Last successful hydration timestamp for 30-day SWR logic';
