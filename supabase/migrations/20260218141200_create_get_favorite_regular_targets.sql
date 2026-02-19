-- =============================================================================
-- RPC: get_favorite_regular_targets
-- =============================================================================
-- Returns eligible users to notify when someone favorites a place.
-- Used by handle-favorite-regular Edge Function.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_favorite_regular_targets(
  p_author_id  uuid,
  p_place_id   uuid
)
RETURNS TABLE(target_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ttl_hours INT := 24;
BEGIN
  RETURN QUERY
  SELECT pfp.user_id AS target_user_id
  FROM profile_favorite_places pfp
  WHERE pfp.place_id = p_place_id
    AND pfp.user_id != p_author_id
    -- Eligibility check (blocks, gender, age, verification, etc.)
    AND is_eligible_match(pfp.user_id, p_author_id)
    -- TTL: don't re-notify within 24h
    AND NOT EXISTS (
      SELECT 1 FROM notification_events ne
      WHERE ne.user_id = pfp.user_id
      AND ne.place_id = p_place_id
      AND ne.type = 'favorite_new_regular'
      AND ne.created_at > NOW() - (ttl_hours || ' hours')::interval
    );
END;
$$;

ALTER FUNCTION get_favorite_regular_targets(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_favorite_regular_targets(uuid, uuid) TO service_role;

COMMENT ON FUNCTION get_favorite_regular_targets IS
  'Returns eligible users to notify when someone favorites a place. Filters with is_eligible_match + 24h TTL.';
