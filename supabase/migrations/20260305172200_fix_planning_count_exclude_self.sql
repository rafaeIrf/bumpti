-- =============================================================================
-- Fix: get_planning_count_at_place — exclude the requesting user from count
-- =============================================================================
-- Adds optional requesting_user_id param to exclude self from planning count.
-- The caller (get_place_social_summary) already has this param available.
-- =============================================================================

-- 1. Drop old single-param signature
DROP FUNCTION IF EXISTS get_planning_count_at_place(uuid);

-- 2. Recreate with requesting_user_id (optional, backward-compatible)
CREATE OR REPLACE FUNCTION get_planning_count_at_place(
  target_place_id    uuid,
  requesting_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM user_presences
  WHERE place_id    = target_place_id
    AND active      = true
    AND entry_type  IN ('planning', 'checkin_plus')
    AND planned_for BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
    AND (requesting_user_id IS NULL OR user_id != requesting_user_id);
$$;

GRANT EXECUTE ON FUNCTION get_planning_count_at_place(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_planning_count_at_place IS
'Returns the total number of active plans at a place for the next 7 days.
Excludes the requesting user from the count when requesting_user_id is provided.';

-- 3. Update get_place_social_summary to pass requesting_user_id
CREATE OR REPLACE FUNCTION get_place_social_summary(
  target_place_id    uuid,
  requesting_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_active_count    bigint  := 0;
  v_regulars_count  integer := 0;
  v_planning_count  integer := 0;
  v_avatars         jsonb   := '[]'::jsonb;
BEGIN
  -- 1. Personalised active users count (excludes self, blocked, disliked, etc.)
  v_active_count := COALESCE(
    get_eligible_active_users_count(target_place_id, requesting_user_id),
    0
  );

  -- 2. Personalised regulars count (past visitors + favouriters)
  v_regulars_count := COALESCE(
    get_regulars_count_at_place(target_place_id, requesting_user_id),
    0
  );

  -- 3. Planning count for the next 7 days (now excludes self)
  v_planning_count := COALESCE(
    get_planning_count_at_place(target_place_id, requesting_user_id),
    0
  );

  -- 4. Combined avatars: active first, then regulars (deduped, up to 5)
  v_avatars := COALESCE(
    get_combined_place_avatars(target_place_id, requesting_user_id, 5),
    '[]'::jsonb
  );

  RETURN jsonb_build_object(
    'active_count',   v_active_count,
    'regulars_count', v_regulars_count,
    'planning_count', v_planning_count,
    'avatars',        v_avatars
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_place_social_summary(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_place_social_summary IS
'Master orchestrator for place social signals on the map.
Returns a jsonb with active_count, regulars_count, planning_count, avatars.
All counts exclude the requesting user when provided.';
