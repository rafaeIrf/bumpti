-- Fix FCM Token Duplication
-- Problem: user_devices table allows duplicate fcm_token entries due to race conditions
-- Solution: Add UNIQUE constraint on fcm_token and clean up existing duplicates

-- Step 2: Add UNIQUE constraint on fcm_token
-- This prevents the same token from being registered multiple times
ALTER TABLE user_devices
ADD CONSTRAINT user_devices_fcm_token_unique UNIQUE (fcm_token);

-- Step 3: Add index for performance on active lookups
-- This optimizes queries that filter by fcm_token and active status
CREATE INDEX IF NOT EXISTS idx_user_devices_fcm_token_active 
ON user_devices(fcm_token) 
WHERE active = true;

-- Step 4: Add comment for documentation
COMMENT ON CONSTRAINT user_devices_fcm_token_unique ON user_devices IS 
'Ensures each FCM token is unique across all users. FCM tokens are device-specific and should only be associated with one active device record.';
