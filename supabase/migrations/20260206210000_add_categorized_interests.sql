-- =====================================================
-- Migration: Categorized Interests System
-- Description: Capture user "vibe" preferences across different location categories
-- =====================================================

-- -----------------------------------------------------
-- Table: interests
-- Purpose: Master catalog of categorized interest options
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  category_key TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add index for category-based queries
CREATE INDEX idx_interests_category_key ON interests(category_key);

-- Add index for position-based ordering
CREATE INDEX idx_interests_position ON interests(position);

-- Add comment for documentation
COMMENT ON TABLE interests IS 'Master catalog of categorized interest options for user profile preferences';
COMMENT ON COLUMN interests.key IS 'Translation key for i18n (e.g., nightlife_techno)';
COMMENT ON COLUMN interests.category_key IS 'Category grouping key (e.g., cat_nightlife)';
COMMENT ON COLUMN interests.icon_name IS 'Emoji character (e.g., 🥐, ☕, 🍔)';
COMMENT ON COLUMN interests.position IS 'Display order position';

-- -----------------------------------------------------
-- Table: profile_interests
-- Purpose: Junction table linking profiles to their selected interests
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_interests (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (profile_id, interest_id)
);

-- Add index on profile_id for fast profile loading
CREATE INDEX idx_profile_interests_profile_id ON profile_interests(profile_id);

-- Add index on interest_id for reverse lookups (find users by interest)
CREATE INDEX idx_profile_interests_interest_id ON profile_interests(interest_id);

-- Add comment for documentation
COMMENT ON TABLE profile_interests IS 'Junction table linking user profiles to their selected interest preferences';

-- -----------------------------------------------------
-- RLS Policies
-- -----------------------------------------------------

-- Enable RLS on both tables
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_interests ENABLE ROW LEVEL SECURITY;

-- Public read access to interests catalog (no auth required)
CREATE POLICY "interests_select_public"
  ON interests
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Users can view their own profile interests
CREATE POLICY "profile_interests_select_own"
  ON profile_interests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

-- Users can insert their own profile interests
CREATE POLICY "profile_interests_insert_own"
  ON profile_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

-- Users can delete their own profile interests
CREATE POLICY "profile_interests_delete_own"
  ON profile_interests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- -----------------------------------------------------
-- Trigger: Update timestamp
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_interests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_interests_timestamp
  BEFORE UPDATE ON interests
  FOR EACH ROW
  EXECUTE FUNCTION update_interests_updated_at();
