-- Fix: The chat deletion trigger cannot query user_matches because
-- in CASCADE delete order, user_matches is deleted BEFORE chats.
-- We need to store user_ids directly on the chat, or use a different approach.

-- SOLUTION: Log chat deletions from the user_matches trigger instead,
-- since we have access to the chat via match_id before the match is deleted.
-- OPTIMIZATION: Only insert for users that still exist (the deleted user won't sync)

-- Drop the broken chat trigger
DROP TRIGGER IF EXISTS trg_log_chat_deletion ON chats;
DROP FUNCTION IF EXISTS log_chat_deletion();

-- Update the match deletion trigger to also log associated chat deletions
-- Only inserts for users whose profiles still exist
CREATE OR REPLACE FUNCTION log_match_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_chat_id UUID;
  v_user_a_exists BOOLEAN;
  v_user_b_exists BOOLEAN;
BEGIN
  -- Check which users still exist (one of them is being deleted)
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = OLD.user_a) INTO v_user_a_exists;
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = OLD.user_b) INTO v_user_b_exists;
  
  -- Find associated chat (still exists at this point)
  SELECT id INTO v_chat_id FROM chats WHERE match_id = OLD.id;
  
  -- Log deletions only for users that still exist
  IF v_user_a_exists THEN
    INSERT INTO sync_deletions (table_name, record_id, affected_user_id)
    VALUES ('user_matches', OLD.id, OLD.user_a);
    
    IF v_chat_id IS NOT NULL THEN
      INSERT INTO sync_deletions (table_name, record_id, affected_user_id)
      VALUES ('chats', v_chat_id, OLD.user_a);
    END IF;
  END IF;
  
  IF v_user_b_exists THEN
    INSERT INTO sync_deletions (table_name, record_id, affected_user_id)
    VALUES ('user_matches', OLD.id, OLD.user_b);
    
    IF v_chat_id IS NOT NULL THEN
      INSERT INTO sync_deletions (table_name, record_id, affected_user_id)
      VALUES ('chats', v_chat_id, OLD.user_b);
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
