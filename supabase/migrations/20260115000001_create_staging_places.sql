-- =====================================================
-- Migration: Create staging_places table
-- Purpose: UNLOGGED table for ultra-fast bulk inserts
-- =====================================================

-- Create UNLOGGED staging table (no WAL overhead)
CREATE UNLOGGED TABLE IF NOT EXISTS staging_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  geom_wkb_hex TEXT NOT NULL,  -- WKB in hexadecimal format
  street TEXT,
  house_number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country_code TEXT,
  structural_score INT NOT NULL DEFAULT 0,
  confidence FLOAT8 DEFAULT 0,
  original_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tracking fields for merge operation
  overture_id TEXT NOT NULL,
  overture_raw JSONB
);

-- Index on overture_id for fast lookups during merge
CREATE INDEX staging_places_overture_id_idx 
  ON staging_places(overture_id);

-- Helper function to convert WKB hex to PostGIS geometry
CREATE OR REPLACE FUNCTION staging_wkb_to_geom(wkb_hex TEXT)
RETURNS GEOMETRY AS $$
BEGIN
  RETURN ST_SetSRID(ST_GeomFromWKB(decode(wkb_hex, 'hex')), 4326);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comments
COMMENT ON TABLE staging_places IS 'UNLOGGED staging table for bulk POI imports with minimal IOPS';
COMMENT ON COLUMN staging_places.geom_wkb_hex IS 'Geometry in WKB hexadecimal format to preserve decimal precision';
COMMENT ON COLUMN staging_places.overture_id IS 'Overture Maps unique identifier for deduplication';
COMMENT ON FUNCTION staging_wkb_to_geom IS 'Convert WKB hex string to PostGIS geometry with SRID 4326';
