-- Create sync_deletions table to track CASCADE deletions for WatermelonDB sync
-- When matches/chats are hard-deleted (e.g., user deletes account), 
-- this table allows incremental sync to detect and propagate deletions

CREATE TABLE sync_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL CHECK (table_name IN ('user_matches', 'chats')),
  record_id UUID NOT NULL,
  affected_user_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient sync queries: "get deletions for this user since timestamp"
CREATE INDEX idx_sync_deletions_user_time 
  ON sync_deletions(affected_user_id, deleted_at);

-- Index to help with cleanup queries
CREATE INDEX idx_sync_deletions_deleted_at 
  ON sync_deletions(deleted_at);

COMMENT ON TABLE sync_deletions IS 'Audit table for CASCADE deletions to enable sync propagation';

---
-- Trigger function for user_matches deletion
---
CREATE OR REPLACE FUNCTION log_match_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Log deletion for both users in the match
  INSERT INTO sync_deletions (table_name, record_id, affected_user_id)
  VALUES 
    ('user_matches', OLD.id, OLD.user_a),
    ('user_matches', OLD.id, OLD.user_b);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_match_deletion
  BEFORE DELETE ON user_matches
  FOR EACH ROW EXECUTE FUNCTION log_match_deletion();

---
-- Trigger function for chats deletion
---
CREATE OR REPLACE FUNCTION log_chat_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_user_a UUID;
  v_user_b UUID;
BEGIN
  -- Get users from the associated match (still exists at BEFORE DELETE time)
  SELECT user_a, user_b INTO v_user_a, v_user_b
  FROM user_matches WHERE id = OLD.match_id;
  
  IF v_user_a IS NOT NULL THEN
    INSERT INTO sync_deletions (table_name, record_id, affected_user_id)
    VALUES 
      ('chats', OLD.id, v_user_a),
      ('chats', OLD.id, v_user_b);
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_chat_deletion
  BEFORE DELETE ON chats
  FOR EACH ROW EXECUTE FUNCTION log_chat_deletion();
