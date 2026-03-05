-- =============================================================================
-- Migration: Fix social hub notification pipeline
-- =============================================================================
-- 1. Creates dedicated RPC get_social_hub_targets (queries profile_social_hubs)
-- 2. Extends notification_events CHECK constraint with hub types
-- 3. Re-creates trigger to call handle-social-hub-notify Edge Function
-- =============================================================================

-- 1. RPC: get_social_hub_targets
-- Mirrors get_favorite_regular_targets but queries profile_social_hubs
-- and uses 'social_hub_new_regular' for TTL dedup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_social_hub_targets(
  p_author_id  uuid,
  p_place_id   uuid
)
RETURNS TABLE(target_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ttl_hours INT := 24;
BEGIN
  RETURN QUERY
  SELECT sh.user_id AS target_user_id
  FROM profile_social_hubs sh
  WHERE sh.place_id = p_place_id
    AND sh.user_id != p_author_id
    -- Eligibility check (blocks, gender, age, verification, etc.)
    AND is_eligible_match(sh.user_id, p_author_id)
    -- TTL: don't re-notify within 24h
    AND NOT EXISTS (
      SELECT 1 FROM notification_events ne
      WHERE ne.user_id = sh.user_id
      AND ne.place_id = p_place_id
      AND ne.type = 'social_hub_new_regular'
      AND ne.created_at > NOW() - (ttl_hours || ' hours')::interval
    );
END;
$$;

ALTER FUNCTION get_social_hub_targets(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_social_hub_targets(uuid, uuid) TO service_role;

COMMENT ON FUNCTION get_social_hub_targets IS
  'Returns eligible users to notify when someone adds a social hub. Queries profile_social_hubs with is_eligible_match + 24h TTL on social_hub_new_regular.';

-- 2. Extend notification_events CHECK constraint
-- Add hub_activity_started, hub_activity_heating, social_hub_new_regular
-- ---------------------------------------------------------------------------
ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_type_check
  CHECK (type = ANY (ARRAY[
    'favorite_activity_started',
    'favorite_activity_heating',
    'hub_activity_started',
    'hub_activity_heating',
    'nearby_activity_started',
    'nearby_activity_heating',
    'message_received',
    'like_received',
    'match_created',
    'favorite_new_regular',
    'social_hub_new_regular',
    'planning_reminder',
    'weekend_engagement'
  ]));

-- 3. Fix social hub trigger to call dedicated Edge Function
-- Previous trigger called handle-favorite-regular (wrong RPC/wrong targets).
-- Now calls handle-social-hub-notify with correct payload.
-- ---------------------------------------------------------------------------
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
        url := current_setting('app.settings.edge_function_url', true) || '/functions/v1/handle-social-hub-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer '
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
      RAISE WARNING 'social_hub_new_regular trigger failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create trigger
DROP TRIGGER IF EXISTS trg_social_hub_notify ON profile_social_hubs;

CREATE TRIGGER trg_social_hub_notify
  AFTER INSERT ON profile_social_hubs
  FOR EACH ROW
  EXECUTE FUNCTION on_social_hub_inserted();
