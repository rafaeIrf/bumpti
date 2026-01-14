-- Add is_invisible column to profiles table
-- Used for: Invisible Mode feature (users can browse without being seen)
-- 
-- Logic: Users with is_invisible = true are excluded from discovery feeds,
-- UNLESS they have already liked the viewer (maintains reciprocity).

ALTER TABLE profiles
ADD COLUMN is_invisible boolean NOT NULL DEFAULT false;

-- Add index for performance (frequently queried in RPC)
CREATE INDEX idx_profiles_is_invisible ON profiles(is_invisible);

-- Comment for documentation
COMMENT ON COLUMN profiles.is_invisible IS 'Invisible mode: when true, user is hidden from discovery feeds unless they already liked the viewer';
