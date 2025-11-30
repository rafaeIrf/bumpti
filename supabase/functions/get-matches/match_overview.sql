CREATE OR REPLACE VIEW match_overview AS
SELECT
  m.id AS match_id,
  c.id AS chat_id,
  m.matched_at,
  m.place_id,

  m.user_a,
  m.user_b,
  m.user_a_opened_at,
  m.user_b_opened_at,

  -- dados do user_a
  pa.name AS user_a_name,
  (
    SELECT url
    FROM profile_photos ppa
    WHERE ppa.user_id = m.user_a
    ORDER BY ppa.position
    LIMIT 1
  ) AS user_a_photo_url,

  -- dados do user_b
  pb.name AS user_b_name,
  (
    SELECT url
    FROM profile_photos ppb
    WHERE ppb.user_id = m.user_b
    ORDER BY ppb.position
    LIMIT 1
  ) AS user_b_photo_url

FROM user_matches m
JOIN chats c ON c.match_id = m.id
JOIN profiles pa ON pa.id = m.user_a
JOIN profiles pb ON pb.id = m.user_b
WHERE m.status = 'active';
