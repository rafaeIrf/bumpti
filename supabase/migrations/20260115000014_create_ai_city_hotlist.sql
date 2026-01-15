-- =====================================================
-- Migration: Create ai_city_hotlist table
-- Purpose: Cache AI-generated iconic venue hotlists
-- =====================================================

-- Create ai_city_hotlist table
CREATE TABLE IF NOT EXISTS ai_city_hotlist (
  city_id UUID PRIMARY KEY REFERENCES cities_registry(id) ON DELETE CASCADE,
  hotlist JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  venue_count INT NOT NULL,
  temperature FLOAT NOT NULL DEFAULT 0.3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on generated_at for cache invalidation queries
CREATE INDEX ai_city_hotlist_generated_at_idx 
  ON ai_city_hotlist(generated_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_city_hotlist TO service_role;

-- Add comments
COMMENT ON TABLE ai_city_hotlist IS 'Caches AI-generated iconic venue hotlists to avoid redundant OpenAI API calls';
COMMENT ON COLUMN ai_city_hotlist.hotlist IS 'JSON object with categories as keys: {"bar": ["Name1", ...], "nightclub": [...]}';
COMMENT ON COLUMN ai_city_hotlist.venue_count IS 'Total number of venues across all categories';
COMMENT ON COLUMN ai_city_hotlist.generated_at IS 'Timestamp when hotlist was generated - used for 30-day cache invalidation';
