-- Migration: Add filter_only_verified column to profiles
-- Purpose: Enables the "Trust Circle" filter for verified users
-- 
-- When filter_only_verified = true:
--   1. User only sees verified profiles in discovery
--   2. User is only visible to verified viewers (reciprocity)

-- Add the column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS filter_only_verified boolean NOT NULL DEFAULT false;

-- Create index for query optimization
CREATE INDEX IF NOT EXISTS idx_profiles_filter_only_verified 
ON profiles(filter_only_verified) 
WHERE filter_only_verified = true;

-- Add documentation
COMMENT ON COLUMN profiles.filter_only_verified IS 
  'Trust Circle filter: when true, user only sees verified profiles AND is only visible to verified viewers';
