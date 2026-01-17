-- Fix place_sources schema for proper external source management
-- PRIMARY KEY: (provider, external_id) ensures each external ID is unique
-- FOREIGN KEY: place_id allows multiple external IDs to point to same place
-- This enables fuzzy dedup where multiple overture_ids represent the same physical location

-- Drop existing primary key
ALTER TABLE place_sources DROP CONSTRAINT place_sources_pkey;

-- Add new primary key on (provider, external_id)
-- This ensures each external source record is processed exactly once
ALTER TABLE place_sources ADD PRIMARY KEY (provider, external_id);

-- Create index on place_id for efficient reverse lookups
CREATE INDEX IF NOT EXISTS idx_place_sources_place_id ON place_sources(place_id);

-- Add comment
COMMENT ON TABLE place_sources IS 'Maps external data sources to places. Multiple external IDs from the same provider can map to a single place (fuzzy dedup). The (provider, external_id) PRIMARY KEY ensures each external record is processed once, while allowing re-linking to better quality places via ON CONFLICT updates.';
