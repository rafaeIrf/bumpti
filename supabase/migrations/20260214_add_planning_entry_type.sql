-- =============================================================================
-- Migration: Add planning support to user_presences
-- =============================================================================
-- Adds 'planning' as a valid entry_type, plus planned_for (DATE) and
-- planned_period columns for when users create plans via the modal.

-- 1. Extend entry_type CHECK to include 'planning'
ALTER TABLE user_presences
  DROP CONSTRAINT IF EXISTS user_presences_entry_type_check;

ALTER TABLE user_presences
  ADD CONSTRAINT user_presences_entry_type_check
  CHECK (entry_type IN ('physical', 'checkin_plus', 'planning'));

-- 2. Add planned_for column (nullable DATE — only set for planning entries)
ALTER TABLE user_presences
  ADD COLUMN IF NOT EXISTS planned_for DATE;

COMMENT ON COLUMN user_presences.planned_for IS
  'Target date for planned presence (today or tomorrow). Only set when entry_type = planning.';

-- 3. Add planned_period column (nullable TEXT)
ALTER TABLE user_presences
  ADD COLUMN IF NOT EXISTS planned_period TEXT;

ALTER TABLE user_presences
  ADD CONSTRAINT user_presences_planned_period_check
  CHECK (planned_period IS NULL OR planned_period IN (
    'morning', 'afternoon', 'night'
  ));

COMMENT ON COLUMN user_presences.planned_period IS
  'Time of day for planned presence. Only set when entry_type = planning.';

-- 4. Partial unique index: one active plan per user+place+day
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_presences_unique_plan
  ON user_presences (user_id, place_id, planned_for)
  WHERE entry_type = 'planning' AND active = true;
