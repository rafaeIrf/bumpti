-- =============================================================================
-- Migration: Add get_planning_avatars + get_all_plans_feed
-- =============================================================================
-- 1. get_planning_avatars: Returns avatars of users planning at a specific
--    place/date/period (filtered by is_eligible_match).
-- 2. get_all_plans_feed: Returns all plan slots (place+date+period) near the
--    user, sorted by date proximity + attendee count, limit 10.
-- =============================================================================


-- ── 1. get_planning_avatars ─────────────────────────────────────────────────
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
        jsonb_build_object('user_id', up.user_id, 'url', pp.url) as avatar_row
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

COMMENT ON FUNCTION get_planning_avatars IS
'Returns avatar list (jsonb) of users planning at a specific place/date/period.
Filtered by is_eligible_match for eligibility. Used in the all-plans feed for
StackedAvatars display.';


-- ── 2. get_all_plans_feed ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_all_plans_feed(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision DEFAULT 50000,
  requesting_user_id uuid DEFAULT NULL::uuid,
  start_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  place_id uuid,
  name text,
  category text,
  lat double precision,
  lng double precision,
  planned_for date,
  planned_period text,
  plan_count bigint,
  preview_avatars jsonb,
  dist_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH plan_slots AS (
    -- Find all active planning presences near the user, from start_date onwards
    SELECT
      up.place_id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      up.planned_for,
      up.planned_period,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM user_presences up
    JOIN places p ON p.id = up.place_id
    WHERE
      up.entry_type = 'planning'
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND up.planned_for >= start_date
      AND p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  grouped AS (
    -- Group by place + date + period (one row per "event slot")
    SELECT
      ps.place_id,
      ps.name,
      ps.category,
      ps.lat,
      ps.lng,
      ps.planned_for,
      ps.planned_period,
      MIN(ps.dist_meters) as dist_meters,
      -- Count eligible users for this slot
      (
        SELECT COUNT(DISTINCT up2.user_id)
        FROM user_presences up2
        WHERE up2.place_id = ps.place_id
          AND up2.entry_type = 'planning'
          AND up2.active = true
          AND up2.ended_at IS NULL
          AND up2.expires_at > NOW()
          AND up2.planned_for = ps.planned_for
          AND up2.planned_period = ps.planned_period
          AND (requesting_user_id IS NULL
               OR is_eligible_match(requesting_user_id, up2.user_id))
      ) as plan_count
    FROM plan_slots ps
    GROUP BY ps.place_id, ps.name, ps.category, ps.lat, ps.lng,
             ps.planned_for, ps.planned_period
  )
  SELECT
    g.place_id,
    g.name,
    g.category,
    g.lat,
    g.lng,
    g.planned_for,
    g.planned_period,
    g.plan_count,
    get_planning_avatars(g.place_id, g.planned_for, g.planned_period, requesting_user_id, 3) as preview_avatars,
    g.dist_meters
  FROM grouped g
  WHERE g.plan_count > 0
  ORDER BY g.planned_for ASC, g.plan_count DESC, g.dist_meters ASC
  LIMIT 10;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_all_plans_feed(double precision, double precision, double precision, uuid, date) TO authenticated, anon;

COMMENT ON FUNCTION get_all_plans_feed IS
'Returns the top 10 plan slots (place+date+period) near the user, sorted by
closest date first, then most attendees. Each row includes preview_avatars from
get_planning_avatars for StackedAvatars display. Used by the PlanHero carousel.';
