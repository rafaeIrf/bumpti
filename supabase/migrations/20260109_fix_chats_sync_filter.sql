-- Fix get_user_chats_for_sync to only return chats WITH messages
-- Matches without messages should be returned by fetchMatchesChanges, not fetchChatsChanges

CREATE OR REPLACE FUNCTION get_user_chats_for_sync(
  p_user_id UUID,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  chat_id UUID,
  match_id UUID,
  chat_created_at TIMESTAMPTZ,
  last_message TEXT,
  last_message_iv TEXT,
  last_message_tag TEXT,
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
  WITH chat_data AS (
    SELECT 
      c.id as c_id,
      c.match_id as c_match_id,
      c.created_at as c_created_at,
      c.first_message_at as c_first_message_at, -- ← IMPORTANTE: Incluir para filtrar
      
      -- Last message details (subquery)
      (
        SELECT m.content_enc 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg,

      (
        SELECT m.content_iv 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg_iv,

      (
        SELECT m.content_tag 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg_tag,
      
      -- Last message timestamp
      (
        SELECT m.created_at 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg_at,
      
      -- Unread count
      (
        SELECT COUNT(*) 
        FROM messages m 
        WHERE m.chat_id = c.id 
          AND m.sender_id != p_user_id 
          AND m.read_at IS NULL
      )::BIGINT as unread_cnt,

      -- Join fields needed
      um.user_a,
      um.user_b,
      um.place_id as um_place_id,
      p.name as p_name,
      ua.name as ua_name,
      ub.name as ub_name

    FROM chats c
    INNER JOIN user_matches um ON c.match_id = um.id
    LEFT JOIN profiles ua ON um.user_a = ua.id
    LEFT JOIN profiles ub ON um.user_b = ub.id
    LEFT JOIN places p ON um.place_id = p.id
    WHERE 
      (um.user_a = p_user_id OR um.user_b = p_user_id)
      AND um.status = 'active'
      -- Retorna TODOS os chats (com e sem mensagens)
      -- O filtro de exibição será feito no frontend
  )
  SELECT 
    cd.c_id,
    cd.c_match_id,
    cd.c_created_at,
    cd.last_msg,
    cd.last_msg_iv,
    cd.last_msg_tag,
    cd.last_msg_at,
    cd.unread_cnt,
    
    -- Other user details
    CASE 
      WHEN cd.user_a = p_user_id THEN cd.user_b
      ELSE cd.user_a
    END as other_user_id,
    
    CASE 
      WHEN cd.user_a = p_user_id THEN cd.ub_name
      ELSE cd.ua_name
    END as other_user_name,
    
    CASE 
      WHEN cd.user_a = p_user_id THEN (
        SELECT url FROM profile_photos WHERE user_id = cd.user_b ORDER BY position LIMIT 1
      )
      ELSE (
        SELECT url FROM profile_photos WHERE user_id = cd.user_a ORDER BY position LIMIT 1
      )
    END as other_user_photo_url,
    
    -- Place details
    cd.um_place_id,
    cd.p_name

  FROM chat_data cd
  WHERE 
    -- Filter by p_since (if provided)
    (p_since IS NULL OR cd.c_created_at >= p_since OR cd.last_msg_at >= p_since)
  ORDER BY 
    cd.last_msg_at DESC NULLS LAST;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_chats_for_sync(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION get_user_chats_for_sync IS 
'Returns ALL chats (with and without messages). 
The frontend will filter to display only chats with messages in the UI.';

