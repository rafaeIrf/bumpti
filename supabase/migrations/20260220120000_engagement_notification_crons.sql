-- =============================================================================
-- Engagement Notification RPCs + pg_cron Schedules
-- =============================================================================
-- Two notification types:
--   1. planning_reminder  – fired 3x/day when user has unfulfilled planning
--   2. weekend_engagement – fired Fri/Sat/Sun to drive weekend activity
--
-- De-dup: both RPCs filter candidates against notification_events.
-- Quiet hours (23h-08h BRT) are enforced by the cron schedule itself.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Planning Reminder Candidates
-- DROP first to allow changing the return type (adding planned_period)
DROP FUNCTION IF EXISTS public.get_planning_reminder_candidates();
--    Returns users with a 'planning' entry_type for the current date/period
--    who have NOT yet done a physical check-in at the planned place.
--
--    Period detection is UTC-based (Brazil = UTC-3):
--      11-13 UTC → morning  (09h BRT)
--      17-19 UTC → afternoon (15h BRT)
--      >= 22 UTC → evening  (20h BRT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_planning_reminder_candidates()
RETURNS TABLE(
  user_id        uuid,
  place_id       uuid,
  place_name     text,
  planned_period text,
  active_count   int
)
LANGUAGE sql
STABLE
AS $func$
  WITH current_period AS (
    SELECT CASE
      WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'UTC') BETWEEN 11 AND 13 THEN 'morning'
      WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'UTC') BETWEEN 17 AND 19 THEN 'afternoon'
      WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'UTC') >= 22               THEN 'evening'
      ELSE NULL
    END AS period
  ),
  physical_counts AS (
    SELECT place_id, COUNT(*) AS cnt
    FROM user_presences
    WHERE entry_type = 'physical' AND active = true
    GROUP BY place_id
  )
  SELECT
    up.user_id,
    up.place_id,
    p.name AS place_name,
    up.planned_period,
    COALESCE(pc.cnt, 0)::int AS active_count
  FROM user_presences up
  JOIN places p ON p.id = up.place_id
  CROSS JOIN current_period cp
  LEFT JOIN physical_counts pc ON pc.place_id = up.place_id
  WHERE up.entry_type = 'planning'
    AND up.planned_for = CURRENT_DATE
    AND up.planned_period = cp.period
    AND cp.period IS NOT NULL
    AND up.expires_at >= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM user_presences ci
      WHERE ci.user_id  = up.user_id
        AND ci.place_id = up.place_id
        AND ci.entry_type = 'physical'
        AND ci.entered_at >= CURRENT_DATE::timestamptz
    )
    AND NOT EXISTS (
      SELECT 1 FROM notification_events ne
      WHERE ne.user_id  = up.user_id
        AND ne.place_id = up.place_id
        AND ne.type     = 'planning_reminder'
        AND ne.created_at >= CURRENT_DATE::timestamptz
    );
$func$;

COMMENT ON FUNCTION public.get_planning_reminder_candidates() IS
'Returns users with unfulfilled planning for the current time period.
 Period is inferred from current UTC hour (11-13→morning, 17-19→afternoon, >=22→evening).
 Excludes users who already checked in or already received a reminder today.';

-- ---------------------------------------------------------------------------
-- 2. Weekend Engagement Candidates
--    Returns ALL users with an active device who have not yet received a
--    weekend_engagement notification today.
--    No activity-window filter — even new/dormant users should be nudged.
--    No planning filter — planning_reminder is separate; users with plans
--    can still receive the weekend engagement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_weekend_engagement_candidates()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
AS $func$
  SELECT DISTINCT ud.user_id
  FROM user_devices ud
  WHERE ud.active = true
    AND NOT EXISTS (
      SELECT 1 FROM notification_events ne
      WHERE ne.user_id   = ud.user_id
        AND ne.type      = 'weekend_engagement'
        AND ne.created_at >= CURRENT_DATE::timestamptz
    );
$func$;

COMMENT ON FUNCTION public.get_weekend_engagement_candidates() IS
'Returns all users with an active push device who have not yet received
 a weekend_engagement notification today. Broad reach by design — meant
 to nudge even inactive users back into the app on weekends.';

-- ---------------------------------------------------------------------------
-- 3. pg_cron Schedules
--    All times are UTC. Brazil (BRT) = UTC - 3.
--
--    Planning reminders:
--      0 12 * * *  → 09:00 BRT (morning)
--      0 18 * * *  → 15:00 BRT (afternoon)
--      0 23 * * *  → 20:00 BRT (evening)
--
--    Weekend engagement:
--      0 20 * * 5    → 17:00 BRT Friday
--      0 15 * * 6,0  → 12:00 BRT Sat + Sun
--
--    NOTE: Replace SERVICE_ROLE with the actual service role JWT before running.
--    Do not commit the real token to git.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'planning-reminder-morning',
  '0 12 * * *',
  $cron$SELECT net.http_post(url:='https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/send-engagement-notifications',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE'),body:='{"type":"planning_reminder"}'::jsonb);$cron$
);

SELECT cron.schedule(
  'planning-reminder-afternoon',
  '0 18 * * *',
  $cron$SELECT net.http_post(url:='https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/send-engagement-notifications',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE'),body:='{"type":"planning_reminder"}'::jsonb);$cron$
);

SELECT cron.schedule(
  'planning-reminder-evening',
  '0 23 * * *',
  $cron$SELECT net.http_post(url:='https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/send-engagement-notifications',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE'),body:='{"type":"planning_reminder"}'::jsonb);$cron$
);

SELECT cron.schedule(
  'weekend-engagement-friday',
  '0 20 * * 5',
  $cron$SELECT net.http_post(url:='https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/send-engagement-notifications',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE'),body:='{"type":"weekend_engagement"}'::jsonb);$cron$
);

SELECT cron.schedule(
  'weekend-engagement-weekend',
  '0 15 * * 6,0',
  $cron$SELECT net.http_post(url:='https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/send-engagement-notifications',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE'),body:='{"type":"weekend_engagement"}'::jsonb);$cron$
);
