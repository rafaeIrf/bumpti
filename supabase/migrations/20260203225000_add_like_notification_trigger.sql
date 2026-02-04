-- Migration: Add trigger for like notifications
-- 
-- When a user receives a like ('like' action in user_interactions table),
-- trigger an Edge Function to send a push notification.

-- Function to handle like notifications
CREATE OR REPLACE FUNCTION public.handle_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if this is a 'like' action
  IF NEW.action = 'like' THEN
    -- Call Edge Function to send notification asynchronously
    -- We use pg_net extension for HTTP requests
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/handle-like-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'liked_user_id', NEW.target_user_id,
          'interaction_id', NEW.id,
          'created_at', NEW.created_at
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_interactions table
DROP TRIGGER IF EXISTS on_like_send_notification ON public.user_interactions;

CREATE TRIGGER on_like_send_notification
  AFTER INSERT ON public.user_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_notification();

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_like_notification() IS 
  'Triggers Edge Function to send push notification when a user receives a like';
