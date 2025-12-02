-- RPC function to get count of available (eligible) people per place
-- Used by: get-trending-places edge function
-- 
-- This function filters users based on:
-- - Excludes the viewer themselves
-- - Excludes users the viewer has disliked
-- - Excludes users the viewer has liked (but like hasn't expired yet)
-- - Excludes users the viewer has blocked
-- - Excludes users who have blocked the viewer
-- - Does NOT exclude unmatched users (allows re-matching)
--
-- Returns: place_id and people_count for each place with eligible users

create or replace function get_available_people_count(
  place_ids text[],
  viewer_id uuid
)
returns table (
  place_id text,
  people_count bigint
)
language sql
stable
as $$
  SELECT
    a.place_id,
    COUNT(*)::bigint AS people_count
  FROM active_users_per_place a
  WHERE a.place_id = ANY(place_ids)
    AND a.user_id != viewer_id

    AND NOT EXISTS (
      SELECT 1
      FROM user_interactions ui
      WHERE ui.from_user_id = viewer_id
        AND ui.to_user_id = a.user_id
        AND (
          ui.action = 'dislike'
          OR (ui.action = 'like' AND ui.action_expires_at > now())
        )
    )

    -- Exclude users blocked by viewer
    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks ub
      WHERE ub.blocker_id = viewer_id
        AND ub.blocked_id = a.user_id
    )

    -- Exclude users who blocked the viewer
    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks ub
      WHERE ub.blocker_id = a.user_id
        AND ub.blocked_id = viewer_id
    )

  GROUP BY a.place_id;
$$;
