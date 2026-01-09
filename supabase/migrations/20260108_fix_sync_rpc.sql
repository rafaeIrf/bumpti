-- RPC Function to return denormalized chats for sync
-- Used by sync-chat-data edge function
-- Updated to use profile_photos table and return correct photo URL path

CREATE OR REPLACE FUNCTION get_user_chats_for_sync(
  p_user_id UUID,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  chat_id UUID,
  match_id UUID,
  chat_created_at TIMESTAMPTZ,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_photo_url TEXT,
  place_id UUID,
  place_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as chat_id,
    c.match_id,
    c.created_at as chat_created_at,
    
    -- Last message (subquery)
    (
      SELECT m.content_enc 
      FROM messages m 
      WHERE m.chat_id = c.id 
      ORDER BY m.created_at DESC 
      LIMIT 1
    ) as last_message,
    
    -- Last message timestamp
    (
      SELECT m.created_at 
      FROM messages m 
      WHERE m.chat_id = c.id 
      ORDER BY m.created_at DESC 
      LIMIT 1
    ) as last_message_at,
    
    -- Unread count
    (
      SELECT COUNT(*) 
      FROM messages m 
      WHERE m.chat_id = c.id 
        AND m.sender_id != p_user_id 
        AND m.read_at IS NULL
    )::BIGINT as unread_count,
    
    -- Other user details
    CASE 
      WHEN um.user_a = p_user_id THEN um.user_b
      ELSE um.user_a
    END as other_user_id,
    
    CASE 
      WHEN um.user_a = p_user_id THEN ub.name
      ELSE ua.name
    END as other_user_name,
    
    CASE 
      WHEN um.user_a = p_user_id THEN (
        SELECT url FROM profile_photos WHERE user_id = um.user_b ORDER BY position LIMIT 1
      )
      ELSE (
        SELECT url FROM profile_photos WHERE user_id = um.user_a ORDER BY position LIMIT 1
      )
    END as other_user_photo_url,
    
    -- Place details
    um.place_id,
    p.name as place_name
    
  FROM chats c
  INNER JOIN user_matches um ON c.match_id = um.id
  LEFT JOIN profiles ua ON um.user_a = ua.id
  LEFT JOIN profiles ub ON um.user_b = ub.id
  LEFT JOIN places p ON um.place_id = p.id
  WHERE 
    (um.user_a = p_user_id OR um.user_b = p_user_id)
    AND um.status = 'active'
    AND (p_since IS NULL OR c.updated_at >= p_since)
  ORDER BY 
    last_message_at DESC NULLS LAST;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_chats_for_sync(UUID, TIMESTAMPTZ) TO authenticated;
