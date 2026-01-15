-- Add Worker Queue support to cities_registry
-- Enables database-backed queue with retry logic and failure tracking

-- Add queue management columns
ALTER TABLE cities_registry 
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_finished_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Add index for efficient queue queries
-- Only indexes pending/failed cities to keep index small and fast
CREATE INDEX IF NOT EXISTS idx_cities_pending 
ON cities_registry(status, created_at) 
WHERE status IN ('pending', 'failed');

-- Add index for geometry-based lookups (find existing city by coordinates)
CREATE INDEX IF NOT EXISTS idx_cities_geom 
ON cities_registry USING GIST(geom);

-- Add unique constraint on coordinates to prevent duplicate cities
-- (commented out if you need to test - uncomment for production)
-- ALTER TABLE cities_registry 
-- ADD CONSTRAINT unique_city_coordinates 
-- UNIQUE (lat, lng);

-- Update existing cities to have completed status if they have data
UPDATE cities_registry 
SET status = 'completed'
WHERE status IS NULL 
  AND id IN (SELECT DISTINCT city_id FROM places WHERE city_id IS NOT NULL);

-- Comment for documentation
COMMENT ON COLUMN cities_registry.retry_count IS 'Number of processing attempts (max 3 before manual_review)';
COMMENT ON COLUMN cities_registry.last_error IS 'Last error message if processing failed';
COMMENT ON COLUMN cities_registry.processing_started_at IS 'Timestamp when worker claimed this city';
COMMENT ON COLUMN cities_registry.processing_finished_at IS 'Timestamp when processing completed (success or failure)';
COMMENT ON COLUMN cities_registry.lat IS 'Latitude used to discover this city';
COMMENT ON COLUMN cities_registry.lng IS 'Longitude used to discover this city';
