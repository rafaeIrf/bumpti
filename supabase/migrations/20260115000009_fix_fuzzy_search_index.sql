-- Professional Fuzzy Search with pg_trgm
-- Fix GIN index to use immutable_unaccent(name) for proper fuzzy matching
-- NOTE: Requires immutable_unaccent() function from migration 007

-- Step 1: Drop old index
DROP INDEX IF EXISTS idx_places_name_trgm;

-- Step 2: Create corrected GIN index on immutable_unaccent(name)
CREATE INDEX idx_places_name_trgm ON places USING GIN (immutable_unaccent(name) gin_trgm_ops);

-- Add performance-critical comment
COMMENT ON INDEX idx_places_name_trgm IS 'GIN trigram index on immutable_unaccent(name) for fuzzy text search with punctuation tolerance';
