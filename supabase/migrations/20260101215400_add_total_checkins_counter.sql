-- Add total_checkins counter to places table
-- This counter increments on each check-in and does NOT depend on user_presences records

-- Add the column
ALTER TABLE places ADD COLUMN IF NOT EXISTS total_checkins integer DEFAULT 0;

-- Create function to increment checkins counter
CREATE OR REPLACE FUNCTION increment_place_checkins()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE places 
  SET total_checkins = COALESCE(total_checkins, 0) + 1,
      last_activity_at = now()
  WHERE id = NEW.place_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_presences INSERT
DROP TRIGGER IF EXISTS trg_increment_place_checkins ON user_presences;
CREATE TRIGGER trg_increment_place_checkins
  AFTER INSERT ON user_presences
  FOR EACH ROW
  EXECUTE FUNCTION increment_place_checkins();

-- Create index for sorting by checkins
CREATE INDEX IF NOT EXISTS places_total_checkins_idx ON places(total_checkins DESC);
