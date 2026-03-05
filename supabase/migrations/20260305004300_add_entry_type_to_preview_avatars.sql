-- =============================================================================
-- Migration: Add entry_type to preview_avatars JSONB
-- =============================================================================
-- Problem: preview_avatars only returns {user_id, url} — we need entry_type
--   to render colored borders on the mobile stacked avatars component.
--
-- Fix:
--   1. Update get_regulars_avatars_at_place to include entry_type in JSONB
--   2. Update get_combined_place_avatars to tag active avatars with entry_type
--      and preserve entry_type from regulars
-- =============================================================================

-- 1. Fix get_regulars_avatars_at_place — include entry_type
CREATE OR REPLACE FUNCTION get_regulars_avatars_at_place(
  target_place_id uuid,
  requesting_user_id uuid DEFAULT NULL,
  max_avatars integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(avatar_row)
    FROM (
      SELECT DISTINCT ON (r.user_id)
        jsonb_build_object(
          'user_id', r.user_id,
          'url', pp.url,
          'entry_type', r.entry_type
        ) as avatar_row
      FROM get_eligible_regulars_at_place(target_place_id, requesting_user_id) r
      INNER JOIN profile_photos pp ON pp.user_id = r.user_id
      WHERE pp.url IS NOT NULL
      ORDER BY r.user_id, pp.position ASC
      LIMIT max_avatars
    ) sub
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_regulars_avatars_at_place(uuid, uuid, integer) TO authenticated, anon;


-- 2. Update get_combined_place_avatars — add entry_type to active avatars
--    Active users are tagged as 'physical' since they have active presences.
--    Regulars already carry their entry_type from step 1 above.
CREATE OR REPLACE FUNCTION get_combined_place_avatars(
  target_place_id uuid,
  requesting_user_id uuid DEFAULT NULL,
  max_avatars integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  active_avatars jsonb;
  regular_avatars jsonb;
  combined jsonb;
BEGIN
  -- Get active user avatars — tag with entry_type from user_presences
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', (a).user_id,
      'url', (a).url,
      'entry_type', COALESCE(up_type.entry_type, 'physical')
    )
  )
  INTO active_avatars
  FROM unnest((get_active_users_with_avatars(target_place_id, requesting_user_id, max_avatars)).avatars) a
  LEFT JOIN LATERAL (
    SELECT up.entry_type::text
    FROM user_presences up
    WHERE up.user_id = (a).user_id
      AND up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
    ORDER BY up.entered_at DESC
    LIMIT 1
  ) up_type ON true;

  -- Get regular avatars (already includes entry_type from step 1)
  SELECT get_regulars_avatars_at_place(target_place_id, requesting_user_id, max_avatars)
  INTO regular_avatars;

  -- Combine: active first, then regulars, dedup by user_id, limit to max_avatars
  SELECT jsonb_agg(item ORDER BY idx)
  INTO combined
  FROM (
    SELECT item, row_number() OVER () as idx
    FROM (
      -- Active avatars first
      SELECT item
      FROM jsonb_array_elements(COALESCE(active_avatars, '[]'::jsonb)) item
      UNION ALL
      -- Regular avatars, excluding any already in active
      SELECT item
      FROM jsonb_array_elements(COALESCE(regular_avatars, '[]'::jsonb)) item
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(active_avatars, '[]'::jsonb)) a
        WHERE a->>'user_id' = item->>'user_id'
      )
    ) all_avatars
    LIMIT max_avatars
  ) limited;

  RETURN combined;
END;
$$;

GRANT EXECUTE ON FUNCTION get_combined_place_avatars(uuid, uuid, integer) TO authenticated, anon;

COMMENT ON FUNCTION get_combined_place_avatars IS
'Returns combined avatar list: active users first, then regulars (deduped by user_id), up to max_avatars.
Each avatar now includes entry_type for colored border rendering on mobile.
Used in place listing RPCs to show all relevant people at a place.';


-- 3. Fix get_planning_avatars — include entry_type
CREATE OR REPLACE FUNCTION get_planning_avatars(
  target_place_id uuid,
  target_date date,
  target_period text,
  requesting_user_id uuid DEFAULT NULL,
  max_avatars integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(avatar_row)
    FROM (
      SELECT DISTINCT ON (up.user_id)
        jsonb_build_object('user_id', up.user_id, 'url', pp.url, 'entry_type', up.entry_type::text) as avatar_row
      FROM user_presences up
      INNER JOIN profile_photos pp ON pp.user_id = up.user_id
      WHERE up.place_id = target_place_id
        AND up.entry_type = 'planning'
        AND up.active = true
        AND up.ended_at IS NULL
        AND up.expires_at > NOW()
        AND up.planned_for = target_date
        AND up.planned_period = target_period
        AND pp.url IS NOT NULL
        AND (requesting_user_id IS NULL
             OR is_eligible_match(requesting_user_id, up.user_id))
      ORDER BY up.user_id, pp.position ASC
      LIMIT max_avatars
    ) sub
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_planning_avatars(uuid, date, text, uuid, integer) TO authenticated, anon;
