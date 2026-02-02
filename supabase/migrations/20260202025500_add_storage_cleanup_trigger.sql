-- Migration: Add automatic Storage cleanup for profile photos
-- Description: Creates a trigger that deletes files from Supabase Storage when profile_photos records are deleted
-- This solves the orphaned files issue when users delete their accounts

-- Enable HTTP extension for making API calls from PostgreSQL
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Function to delete photo from Supabase Storage
CREATE OR REPLACE FUNCTION delete_photo_from_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  storage_url text;
  service_key text;
  file_path text;
  http_response extensions.http_response;
BEGIN
  -- Extract file path from URL
  -- Format: https://<project>.supabase.co/storage/v1/object/sign/user_photos/user_id/filename.jpg?token=...
  -- We need: user_photos/user_id/filename.jpg
  file_path := regexp_replace(OLD.url, '^.*/storage/v1/object/[^/]+/', '');
  
  -- Remove any query parameters (e.g., ?token=...)
  file_path := regexp_replace(file_path, '\?.*$', '');
  
  -- Get Supabase configuration from database settings
  -- These need to be configured via: ALTER DATABASE postgres SET app.settings.supabase_url = '...';
  storage_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- Skip if environment variables are not configured
  IF storage_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Storage cleanup skipped: environment variables not configured (app.settings.supabase_url, app.settings.service_role_key)';
    RETURN OLD;
  END IF;
  
  -- Make DELETE request to Storage API
  BEGIN
    SELECT * INTO http_response
    FROM extensions.http((
      'DELETE',
      storage_url || '/storage/v1/object/' || file_path,
      ARRAY[extensions.http_header('Authorization', 'Bearer ' || service_key)],
      NULL,
      NULL
    )::extensions.http_request);
    
    -- Log result (don't fail transaction on storage errors)
    IF http_response.status = 200 THEN
      RAISE NOTICE 'Successfully deleted photo from storage: %', file_path;
    ELSIF http_response.status = 404 THEN
      RAISE WARNING 'Photo already deleted from storage: %', file_path;
    ELSE
      RAISE WARNING 'Failed to delete photo from storage: % (status: %, body: %)', 
        file_path, http_response.status, http_response.content;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Exception while deleting photo from storage: % (error: %)', 
        file_path, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$;

-- Create trigger on profile_photos table
CREATE TRIGGER trigger_delete_photo_from_storage
AFTER DELETE ON profile_photos
FOR EACH ROW
EXECUTE FUNCTION delete_photo_from_storage();

-- Add comment explaining the trigger
COMMENT ON FUNCTION delete_photo_from_storage() IS 
'Automatically deletes photo files from Supabase Storage when profile_photos records are deleted. 
Requires database settings: app.settings.supabase_url and app.settings.service_role_key.
Gracefully handles errors to ensure user deletion succeeds even if Storage cleanup fails.';

-- Instructions for configuring environment variables:
-- Run these commands in Supabase SQL Editor or via migration:
--
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
--
-- Note: These settings persist across deployments and are encrypted in the database.
