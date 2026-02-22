-- =============================================================================
-- Migration: Add place social summary RPCs for the map
-- =============================================================================
-- Creates two functions:
--   1. get_planning_count_at_place  — counts active plans for next 7 days
--   2. get_place_social_summary     — master orchestrator returning unified jsonb
-- =============================================================================


-- =============================================================================
-- PART 1: get_planning_count_at_place
-- =============================================================================
-- Counts user_presences where:
--   • active = true
--   • entry_type IN ('planning', 'checkin_plus')
--   • planned_for BETWEEN today and today + 6  (next 7 days, inclusive)
--
-- NOTE: This is a place-level metric (social proof for the map), therefore we
-- intentionally do NOT apply the 8-filter eligibility matrix. The raw count
-- represents the total "buzz" around a place, irrespective of who is viewing.
-- This is consistent with how planning_count is used in VibeCheckScreen.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_planning_count_at_place(
  target_place_id uuid
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
    AND planned_for BETWEEN CURRENT_DATE AND CURRENT_DATE + 6;
$$;

GRANT EXECUTE ON FUNCTION get_planning_count_at_place(uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_planning_count_at_place IS
'Returns the total number of active plans at a place for the next 7 days
(today through today+6, inclusive). Counts entry_type in (planning, checkin_plus).
No eligibility filtering applied — this is a raw place-level social proof metric
used by the map and place detail views.';


-- =============================================================================
-- PART 2: get_place_social_summary (master orchestrator)
-- =============================================================================
-- Returns a single jsonb object unifying all social signals for a place:
--   • active_count    — current eligible active users (personalised)
--   • regulars_count  — regular visitors / favouriters (personalised)
--   • planning_count  — raw plans for next 7 days (non-personalised)
--   • avatars         — combined active + regular avatars (up to 5)
--
-- Null-safety: all counts default to 0, avatars default to []
-- Performance: SECURITY DEFINER + STABLE, delegates to existing helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION get_place_social_summary(
  target_place_id   uuid,
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

  -- 3. Raw planning count for the next 7 days (place-level metric)
  v_planning_count := COALESCE(
    get_planning_count_at_place(target_place_id),
    0
  );

  -- 4. Combined avatars: active first, then regulars (deduped by user_id, up to 5)
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
Returns a jsonb with:
  active_count   — personalised eligible active users right now
  regulars_count — personalised regular visitors / favouriters
  planning_count — raw total plans (next 7 days, place-level social proof)
  avatars        — combined active + regular avatars, up to 5, deduped by user_id
All counts null-safe (default 0). Avatars null-safe (default []).
SECURITY DEFINER to access profile_favorite_places and other restricted tables.';
