-- =====================================================
-- Migration: Add relevance_score to staging_places
-- Purpose: Support new relevance ranking system
-- =====================================================

-- Add relevance_score column to staging_places
ALTER TABLE staging_places 
ADD COLUMN IF NOT EXISTS relevance_score INT NOT NULL DEFAULT 0;

-- Add comment
COMMENT ON COLUMN staging_places.relevance_score IS 'Composite relevance score: structural_score + taxonomy_bonus + authority_bonus + scale_bonus';
