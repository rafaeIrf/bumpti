-- =============================================================================
-- Migration: Add date-filtered overload for active users count
-- =============================================================================
-- get_eligible_active_users_count(place, user) counts ALL active users at a
-- place regardless of date. This means a plan for Tuesday shows confirmed
-- users from today's plans too.
--
-- Fix: add a 3-param overload that also filters by planned_for date.
-- The 2-param version is kept for callers that want the total (trending, etc).
-- =============================================================================

-- Overload: count only users with a presence for a specific date
CREATE OR REPLACE FUNCTION get_eligible_active_users_count(
  target_place_id uuid,
  requesting_user_id uuid,
  target_date date
) RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(DISTINCT e.user_id)
  FROM get_eligible_users_at_place(target_place_id, requesting_user_id) e
  WHERE EXISTS (
    SELECT 1 FROM user_presences up
    WHERE up.user_id = e.user_id
      AND up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND up.planned_for = target_date
  );
$$;
