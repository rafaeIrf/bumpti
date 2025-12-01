CREATE OR REPLACE VIEW chat_list AS
WITH last_msg AS (
  SELECT DISTINCT ON (chat_id)
    chat_id,
    content AS last_message,
    created_at AS last_message_at
  FROM messages
  ORDER BY chat_id, created_at DESC
),
unread AS (
  SELECT
    c.id AS chat_id,
    m.user_a,
    m.user_b,
    COUNT(*) FILTER (
      WHERE msg.read_at IS NULL AND msg.sender_id = m.user_b
    ) AS user_a_unread,
    COUNT(*) FILTER (
      WHERE msg.read_at IS NULL AND msg.sender_id = m.user_a
    ) AS user_b_unread
  FROM chats c
  JOIN user_matches m ON m.id = c.match_id
  LEFT JOIN messages msg ON msg.chat_id = c.id
  GROUP BY c.id, m.user_a, m.user_b
)
SELECT
  c.id AS chat_id,
  c.match_id,
  c.created_at AS chat_created_at,
  m.place_id,

  -- User A
  m.user_a,
  pa.name AS user_a_name,
  (
    SELECT url FROM profile_photos
    WHERE user_id = m.user_a
    ORDER BY position
    LIMIT 1
  ) AS user_a_photo_url,

  -- User B
  m.user_b,
  pb.name AS user_b_name,
  (
    SELECT url FROM profile_photos
    WHERE user_id = m.user_b
    ORDER BY position
    LIMIT 1
  ) AS user_b_photo_url,

  -- Last message
  lm.last_message,
  lm.last_message_at,

  -- Unread count
  u.user_a_unread,
  u.user_b_unread

FROM chats c
JOIN user_matches m ON m.id = c.match_id
JOIN profiles pa ON pa.id = m.user_a
JOIN profiles pb ON pb.id = m.user_b
LEFT JOIN last_msg lm ON lm.chat_id = c.id
LEFT JOIN unread u ON u.chat_id = c.id

WHERE m.status = 'active' AND lm.last_message IS NOT NULL;
;
