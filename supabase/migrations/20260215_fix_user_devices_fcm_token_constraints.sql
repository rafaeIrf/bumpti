-- =============================================================================
-- Migration: Fix user_devices FCM token constraints
-- =============================================================================
-- Problem: Both a full UNIQUE constraint and partial UNIQUE index existed on
-- fcm_token. The full UNIQUE blocked upsert because the same token can exist
-- as active=false AND a new active=true row.
-- Solution: Remove the full unique constraint and redundant indexes.
-- Keep only the partial unique index (WHERE active = true).
-- =============================================================================

-- Drop the full unique CONSTRAINT (causes 23505 duplicate error on upsert)
ALTER TABLE user_devices DROP CONSTRAINT IF EXISTS user_devices_fcm_token_unique;

-- Drop redundant regular indexes
DROP INDEX IF EXISTS idx_user_devices_fcm_token;
DROP INDEX IF EXISTS idx_user_devices_fcm_token_active;

-- Keep only: user_devices_fcm_token_active_unique (partial, WHERE active = true)
-- This allows the same token to exist in inactive rows while preventing
-- duplicate active registrations.
