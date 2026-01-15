-- Enable pg_trgm extension for fuzzy text matching
-- Create GIN indexes for performance

-- Step 1: Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Create GIN index on places.name for fast similarity searches
CREATE INDEX IF NOT EXISTS idx_places_name_trgm ON places USING GIN (name gin_trgm_ops);

-- Step 3: Create spatial index on places location (if not exists)
CREATE INDEX IF NOT EXISTS idx_places_location ON places USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326));

-- Step 4: Add comment for documentation
COMMENT ON INDEX idx_places_name_trgm IS 'GIN index for fuzzy text matching on place names using pg_trgm';
COMMENT ON INDEX idx_places_location IS 'Spatial index for proximity-based deduplication';
