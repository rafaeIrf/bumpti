-- =============================================================================
-- Migration: Create profile_social_hubs table
-- =============================================================================
-- Stores user's social hubs (1-4 places where they are socially active and
-- open to meeting people). Separate from profile_favorite_places.
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS profile_social_hubs (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id   UUID NOT NULL REFERENCES places(id),
  visible    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

-- Index for notification/matching JOINs (place_id lookups)
CREATE INDEX IF NOT EXISTS idx_social_hubs_place_id
  ON profile_social_hubs(place_id);

-- =============================================================================
-- RLS Policies
-- =============================================================================
ALTER TABLE profile_social_hubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hubs"
  ON profile_social_hubs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hubs"
  ON profile_social_hubs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hubs"
  ON profile_social_hubs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own hubs"
  ON profile_social_hubs FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Max 4 social hubs enforcement (server-side)
-- =============================================================================
CREATE OR REPLACE FUNCTION check_max_social_hubs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM profile_social_hubs WHERE user_id = NEW.user_id) >= 4 THEN
    RAISE EXCEPTION 'Maximum of 4 social hubs allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_social_hubs
  BEFORE INSERT ON profile_social_hubs
  FOR EACH ROW EXECUTE FUNCTION check_max_social_hubs();
