-- =====================================================
-- Migration: Remove structural_score from staging_places
-- Purpose: Use only relevance_score for quality decisions
-- =====================================================

-- Drop structural_score column (no longer needed)
ALTER TABLE staging_places 
DROP COLUMN IF EXISTS structural_score;

-- Add comment
COMMENT ON TABLE staging_places IS 'UNLOGGED staging table for bulk POI imports. Uses relevance_score (structural + taxonomy + authority + scale) for quality ranking.';
