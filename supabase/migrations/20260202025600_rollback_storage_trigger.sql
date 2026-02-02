-- Rollback the Storage cleanup trigger (not needed anymore)
-- Storage cleanup is now handled in the delete-account Edge Function
-- This avoids the complexity of configuring database-level environment variables

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_delete_photo_from_storage ON profile_photos;

-- Drop the function
DROP FUNCTION IF EXISTS delete_photo_from_storage();

-- Note: We keep the http extension as it might be useful for other features
-- If you want to remove it completely:
-- DROP EXTENSION IF EXISTS http;
