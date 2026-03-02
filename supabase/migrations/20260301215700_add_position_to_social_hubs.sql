-- =============================================================================
-- Migration: Add position column to profile_social_hubs
-- =============================================================================
-- Enables user-defined ordering of social hubs via drag-to-reorder.
-- Backfills existing rows with sequential positions per user.
-- =============================================================================

-- 1. Add the column with a default so existing rows get 0
ALTER TABLE profile_social_hubs
  ADD COLUMN IF NOT EXISTS position SMALLINT NOT NULL DEFAULT 0;

-- 2. Backfill: assign sequential positions per user based on created_at order
UPDATE profile_social_hubs AS psh
SET position = subq.rn
FROM (
  SELECT user_id, place_id,
         (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) - 1)::SMALLINT AS rn
  FROM profile_social_hubs
) AS subq
WHERE psh.user_id = subq.user_id
  AND psh.place_id = subq.place_id;

-- 3. Comment for documentation
COMMENT ON COLUMN profile_social_hubs.position IS
  'User-defined display order (0-based). Lower = shown first.';
