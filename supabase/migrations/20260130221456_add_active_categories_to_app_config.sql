-- Migration: Add active_categories to app_config for feature flags
-- This column stores a JSONB array of active PlaceCategory values

-- Add active_categories column to app_config table
ALTER TABLE app_config 
ADD COLUMN active_categories JSONB 
DEFAULT '["bar", "nightclub", "university", "park", "cafe", "gym", "shopping", "library"]'::jsonb
NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN app_config.active_categories IS 'JSONB array of active PlaceCategory values. Controls which categories are visible in UI and included in "all" queries.';

-- Update existing rows with the default whitelist
UPDATE app_config 
SET active_categories = '["bar", "nightclub", "university", "park", "cafe", "gym", "shopping", "library"]'::jsonb
WHERE active_categories IS NULL;
