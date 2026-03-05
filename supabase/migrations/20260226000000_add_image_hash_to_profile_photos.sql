-- Add image_hash column to profile_photos for duplicate detection
-- Nullable so existing rows are unaffected
ALTER TABLE profile_photos ADD COLUMN IF NOT EXISTS image_hash TEXT;

-- Unique index per user: prevents same user uploading duplicate photos
-- Does NOT block same photo across multiple users (this is intentional)
CREATE UNIQUE INDEX IF NOT EXISTS profile_photos_user_hash_unique
  ON profile_photos (user_id, image_hash)
  WHERE image_hash IS NOT NULL;
