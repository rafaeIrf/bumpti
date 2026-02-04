-- =============================================================================
-- Migration: Add Likes Column to Notification Settings
-- =============================================================================
-- Purpose: Allow users to control whether they receive notifications when
--          someone likes them
-- =============================================================================

ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS likes boolean DEFAULT true;

COMMENT ON COLUMN public.notification_settings.likes IS 
'Controls whether user receives notifications when they receive likes. Default: true';
