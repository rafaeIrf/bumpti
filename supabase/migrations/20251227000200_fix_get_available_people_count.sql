-- Create or replace get_available_people_count RPC to return people count for specific places
-- Handles strict UUID typing to avoid operator does not exist: uuid = text errors

DROP FUNCTION IF EXISTS get_available_people_count(text[], uuid);
DROP FUNCTION IF EXISTS get_available_people_count(uuid[], uuid);

CREATE OR REPLACE FUNCTION get_available_people_count(
  place_ids uuid[],
  viewer_id uuid
)
RETURNS TABLE (
  place_id uuid,
  people_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS place_id,
    count(up.user_id) AS people_count
  FROM places p
  JOIN user_presences up ON up.place_id = p.id
  WHERE p.id = ANY(place_ids)
    AND up.active = true
    AND up.ended_at IS NULL
    AND up.expires_at > now()
    -- Exclude self
    AND up.user_id != viewer_id
    -- Filter Blocks
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks b 
      WHERE (b.blocker_id = viewer_id AND b.blocked_id = up.user_id) 
         OR (b.blocker_id = up.user_id AND b.blocked_id = viewer_id)
    )
    -- Filter Dislikes (Mutual)
    AND NOT EXISTS (
      SELECT 1 FROM user_interactions ui 
      WHERE ui.action = 'dislike'
        AND (
            (ui.from_user_id = viewer_id AND ui.to_user_id = up.user_id) 
            OR 
            (ui.from_user_id = up.user_id AND ui.to_user_id = viewer_id)
        )
    )
    -- Filter Active Matches
    AND NOT EXISTS (
      SELECT 1 FROM user_matches um
      WHERE um.status = 'active'
        AND (
            (um.user_a = viewer_id AND um.user_b = up.user_id)
            OR 
            (um.user_a = up.user_id AND um.user_b = viewer_id)
        )
    )
    -- Filter by Gender Preference: only count users looking to connect with requesting user's gender
    AND EXISTS (
      SELECT 1 FROM profile_connect_with pcw
      INNER JOIN profiles rp ON rp.id = viewer_id
      WHERE pcw.user_id = up.user_id
        AND pcw.gender_id = rp.gender_id
    )
  GROUP BY p.id;
END;
$$;
