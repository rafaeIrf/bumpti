-- =============================================================================
-- Migration: favorite_new_regular notification trigger
-- =============================================================================
-- Fires when a user favorites a place, notifying other users who also
-- favorited the same place via the handle-favorite-regular Edge Function.
-- =============================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION on_favorite_place_inserted()
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

  -- Find other users who favorited the same place
  FOR target IN
    SELECT pfp.user_id AS target_user_id
    FROM profile_favorite_places pfp
    WHERE pfp.place_id = NEW.place_id
      AND pfp.user_id != NEW.user_id
      -- Eligibility check (blocks, gender, age, etc.)
      AND is_eligible_match(pfp.user_id, NEW.user_id)
      -- TTL: don't re-notify if already notified in last 24h
      AND NOT EXISTS (
        SELECT 1 FROM notification_events ne
        WHERE ne.user_id = pfp.user_id
        AND ne.place_id = NEW.place_id
        AND ne.type = 'favorite_new_regular'
        AND ne.created_at > NOW() - (ttl_hours || ' hours')::interval
      )
  LOOP
    eligible_count := eligible_count + 1;
  END LOOP;

  -- Only call Edge Function if there are eligible targets
  IF eligible_count > 0 THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/handle-favorite-regular',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'record', jsonb_build_object(
            'user_id', NEW.user_id,
            'place_id', NEW.place_id
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Fail silently so the INSERT proceeds
      RAISE WARNING 'favorite_new_regular trigger failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_favorite_place_notify ON profile_favorite_places;

CREATE TRIGGER trg_favorite_place_notify
  AFTER INSERT ON profile_favorite_places
  FOR EACH ROW
  EXECUTE FUNCTION on_favorite_place_inserted();
