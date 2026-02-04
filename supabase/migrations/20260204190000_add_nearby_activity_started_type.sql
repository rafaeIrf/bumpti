-- =============================================================================
-- Migration: Add nearby_activity_started to notification_events type check
-- =============================================================================
-- Purpose: Allow the new nearby_activity_started notification type to be 
--          stored in notification_events for TTL tracking
-- =============================================================================

-- Drop the old constraint
ALTER TABLE public.notification_events
DROP CONSTRAINT IF EXISTS notification_events_type_check;

-- Add new constraint with nearby_activity_started included
ALTER TABLE public.notification_events
ADD CONSTRAINT notification_events_type_check CHECK (
  type = ANY (
    ARRAY[
      'favorite_activity_started'::text,
      'favorite_activity_heating'::text,
      'nearby_activity_started'::text,  -- NEW!
      'nearby_activity_heating'::text,
      'message_received'::text,
      'like_received'::text,
      'match_created'::text
    ]
  )
);
