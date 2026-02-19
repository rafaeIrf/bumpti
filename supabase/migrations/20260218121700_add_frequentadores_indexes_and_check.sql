-- =====================================================
-- Frequentadores Feature: Infrastructure Preparation
-- =====================================================

-- 1. Indexes on profile_favorite_places (currently has ZERO indexes)
CREATE INDEX IF NOT EXISTS idx_pfp_place_id
  ON profile_favorite_places(place_id);

CREATE INDEX IF NOT EXISTS idx_pfp_user_id
  ON profile_favorite_places(user_id);

CREATE INDEX IF NOT EXISTS idx_pfp_user_place
  ON profile_favorite_places(user_id, place_id);

-- 2. Partial index on user_presences for past check-in queries
CREATE INDEX IF NOT EXISTS idx_presences_place_past
  ON user_presences(place_id, entered_at DESC)
  WHERE active = false;

-- 3. Extend notification_events CHECK constraint
--    Existing types in data: favorite_activity_started, like_received,
--    nearby_activity_heating, nearby_activity_started
--    Adding: favorite_new_regular
ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_type_check
  CHECK (type = ANY (ARRAY[
    'favorite_activity_started',
    'favorite_activity_heating',
    'nearby_activity_started',
    'nearby_activity_heating',
    'message_received',
    'like_received',
    'match_created',
    'favorite_new_regular'
  ]));
