-- Add Didit session tracking for GDPR-compliant deletion
-- 
-- This migration adds the didit_session_id field to profiles table
-- to enable proper deletion of user verification data from Didit API
-- when user deletes their account (LGPD/GDPR compliance)

ALTER TABLE profiles
ADD COLUMN didit_session_id text NULL;

COMMENT ON COLUMN profiles.didit_session_id IS 
  'Didit session/intent ID for this user verification. Required to delete verification data from Didit API when user deletes account (GDPR/LGPD compliance).';

-- Optional: Add index for faster lookups if we need to query by session_id
CREATE INDEX IF NOT EXISTS idx_profiles_didit_session_id 
  ON profiles(didit_session_id) 
  WHERE didit_session_id IS NOT NULL;
