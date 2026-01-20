-- Add entry_type column to user_presences
-- Values: 'physical' (default) | 'checkin_plus'
-- This allows differentiating how a user entered a place

ALTER TABLE user_presences 
ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'physical';

-- Add check constraint for valid values
ALTER TABLE user_presences
ADD CONSTRAINT user_presences_entry_type_check 
CHECK (entry_type IN ('physical', 'checkin_plus'));

-- Add comment for documentation
COMMENT ON COLUMN user_presences.entry_type IS 
  'How user entered: physical (in proximity) or checkin_plus (remote via Check-in+)';
