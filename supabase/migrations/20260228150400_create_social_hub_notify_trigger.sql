-- =============================================================================
-- Migration: Social hub notification trigger
-- =============================================================================
-- Fires when a user adds a social hub, notifying other users who also have
-- the same place as a hub via the handle-favorite-regular Edge Function.
-- Uses 'social_hub_new_regular' notification type.
-- =============================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION on_social_hub_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target RECORD;
  place_rec RECORD;
  author_rec RECORD;
  ttl_hours INT := 24;
  eligible_count INT := 0;
BEGIN
  -- Get place info
  SELECT id, name, lat, lng INTO place_rec
  FROM places
  WHERE id = NEW.place_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get author info
  SELECT id, name INTO author_rec
  FROM profiles
  WHERE id = NEW.user_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Find other users who have the same place as a social hub
  FOR target IN
    SELECT sh.user_id AS target_user_id
    FROM profile_social_hubs sh
    WHERE sh.place_id = NEW.place_id
      AND sh.user_id != NEW.user_id
      -- Eligibility check (blocks, gender, age, etc.)
      AND is_eligible_match(sh.user_id, NEW.user_id)
      -- TTL: don't re-notify if already notified in last 24h
      AND NOT EXISTS (
        SELECT 1 FROM notification_events ne
        WHERE ne.user_id = sh.user_id
        AND ne.place_id = NEW.place_id
        AND ne.type = 'social_hub_new_regular'
        AND ne.created_at > NOW() - (ttl_hours || ' hours')::interval
      )
  LOOP
    eligible_count := eligible_count + 1;
  END LOOP;

  -- Only call Edge Function if there are eligible targets
  IF eligible_count > 0 THEN
    BEGIN
      PERFORM net.http_post(
        url := current_setting('app.settings.edge_function_url', true) || '/functions/v1/handle-favorite-regular',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'record', jsonb_build_object(
            'user_id', NEW.user_id,
            'place_id', NEW.place_id,
            'type', 'social_hub'
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Fail silently so the INSERT proceeds
      RAISE WARNING 'social_hub_new_regular trigger failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_social_hub_notify ON profile_social_hubs;

CREATE TRIGGER trg_social_hub_notify
  AFTER INSERT ON profile_social_hubs
  FOR EACH ROW
  EXECUTE FUNCTION on_social_hub_inserted();
