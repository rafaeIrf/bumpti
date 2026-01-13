-- Add verification_status column to profiles table
-- Values: 'unverified' (default), 'pending', 'verified', 'rejected'
ALTER TABLE profiles
ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified'
CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

-- Create index for faster queries on verification_status
CREATE INDEX idx_profiles_verification_status ON profiles(verification_status);

-- Add comment to document the column
COMMENT ON COLUMN profiles.verification_status IS 'Identity verification status: unverified (default), pending (in review), verified (approved), rejected (denied)';
