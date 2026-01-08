-- Enable Extensions
create extension if not exists pg_net;
create extension if not exists postgis;

-- 1. Create Notification Events Table (if not exists - based on context)
create table if not exists public.notification_events (
  id bigserial primary key,
  user_id uuid not null,
  place_id uuid null,
  type text not null,
  created_at timestamp with time zone default now(),
  constraint notification_events_type_check
    check (type in (
      'favorite_activity_started',
      'favorite_activity_heating',
      'nearby_activity_heating',
      'message_received',
      'like_received',
      'match_created'
    ))
);

-- Index for TTL performance
create index if not exists idx_notification_events_ttl 
on public.notification_events (user_id, place_id, type, created_at desc);

-- 2. Triggers for Realtime Notifications

-- 2. Triggers for Realtime Notifications via pg_net

-- Helper to get Project URL (Hardcoded from context to ensure it works)
-- NOTE: You must replace 'YOUR_SERVICE_ROLE_KEY' with your actual Supabase Service Role Key to bypass JWT enforcement
-- or ensure your Edge Function allows anon access (not recommended).

-- Function to handle Message Created
create or replace function public.trigger_handle_message_created()
returns trigger
language plpgsql
security definer
as $$
begin
  begin
    perform net.http_post(
      url := 'https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/handle-message-created',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY' 
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW)
      )
    );
  exception when others then
    -- Fail silently to allow the insert to proceed
    raise warning 'Push notification trigger failed: %', SQLERRM;
  end;
  return NEW;
end;
$$;

-- Trigger for Message
drop trigger if exists "on_message_created" on "messages";
create trigger "on_message_created"
after insert on "messages"
for each row execute function public.trigger_handle_message_created();


-- Function to handle Match Created
create or replace function public.trigger_handle_match_created()
returns trigger
language plpgsql
security definer
as $$
begin
  begin
    perform net.http_post(
      url := 'https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/handle-match-created',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW)
      )
    );
  exception when others then
     -- Fail silently to allow the insert to proceed
     raise warning 'Push notification trigger failed: %', SQLERRM;
  end;
  return NEW;
end;
$$;

-- Trigger for Match
drop trigger if exists "on_match_created" on "user_matches";
create trigger "on_match_created"
after insert on "user_matches"
for each row execute function public.trigger_handle_match_created();

-- 3. RPC for Place Activity Logic (Cron)

create or replace function get_place_activity_candidates()
returns table (
  user_id uuid,
  type text,
  place_id uuid,
  place_name text
) 
language plpgsql
security definer
as $$
declare
  -- TTL Definitions (Hours)
  ttl_started int := 3;
  ttl_heating int := 3;
  ttl_nearby int := 3;
begin
  return query
  with active_counts as (
    select 
      up.place_id, 
      p.name as place_name, 
      p.lat, 
      p.lng,
      count(*) as count 
    from user_presences up
    join places p on p.id = up.place_id
    where up.active = true
    group by up.place_id, p.name, p.lat, p.lng
  ),
  user_locations as (
    -- Get latest location for users who are NOT currently active in any place (or are active elsewhere)
    -- Ideally, we use their last known location.
    -- Assuming profiles or devices has lat/lng? 
    -- If not available, we can't do "Nearby" reliably without extra tracking.
    -- For now, we will assume 'nearby' logic relies on user_presences (last known active).
    select distinct on (user_id) user_id, place_id as current_place_id
    from user_presences
    where active = true
  )
  -- 1. FAVORITE STARTED (Count >= 1)
  select 
    fav.user_id,
    'favorite_activity_started'::text as type,
    ac.place_id,
    ac.place_name
  from active_counts ac
  join profile_favorite_places fav on fav.place_id = ac.place_id
  where ac.count >= 1
  -- User must NOT be currently active at this place
  and not exists (
    select 1 from user_presences up 
    where up.user_id = fav.user_id 
    and up.place_id = ac.place_id 
    and up.active = true
  )
  -- TTL Check
  and not exists (
    select 1 from notification_events ne
    where ne.user_id = fav.user_id
    and ne.place_id = ac.place_id
    and ne.type = 'favorite_activity_started'
    and ne.created_at > now() - (ttl_started || ' hours')::interval
  )

  union all

  -- 2. FAVORITE HEATING (Count >= 3)
  select 
    fav.user_id,
    'favorite_activity_heating'::text as type,
    ac.place_id,
    ac.place_name
  from active_counts ac
  join profile_favorite_places fav on fav.place_id = ac.place_id
  where ac.count >= 3
  and not exists (
    select 1 from user_presences up 
    where up.user_id = fav.user_id 
    and up.place_id = ac.place_id 
    and up.active = true
  )
  -- TTL Check
  and not exists (
    select 1 from notification_events ne
    where ne.user_id = fav.user_id
    and ne.place_id = ac.place_id
    and ne.type = 'favorite_activity_heating'
    and ne.created_at > now() - (ttl_heating || ' hours')::interval
  )

  union all

  -- 3. NEARBY HEATING (Max 1 per user, Count >= 5, Dist < 20km)
  -- Users currently active at Place A, notified about Place B (Top active place only)
  select
    sub.user_id,
    'nearby_activity_heating'::text as type,
    sub.place_id,
    sub.place_name
  from (
    select
      up.user_id,
      ac.place_id,
      ac.place_name,
      row_number() over (partition by up.user_id order by ac.count desc) as rn
    from active_counts ac
    join user_presences up on up.active = true -- Get currently active users
    join places user_place on user_place.id = up.place_id -- Get their specific location
    where ac.count >= 5 -- Increased Threshold to 5
    and ac.place_id != up.place_id -- Not the place they are at
    -- Distance Check (PostGIS) - 20km (20,000 meters)
    and st_dwithin(
      st_point(user_place.lng, user_place.lat)::geography,
      st_point(ac.lng, ac.lat)::geography,
      20000
    )
    -- Exclude if it's a favorite (handled by favorite rules)
    and not exists (
      select 1 from profile_favorite_places fav 
      where fav.user_id = up.user_id 
      and fav.place_id = ac.place_id
    )
    -- TTL Check
    and not exists (
      select 1 from notification_events ne
      where ne.user_id = up.user_id
      and ne.place_id = ac.place_id
      and ne.type = 'nearby_activity_heating'
      and ne.created_at > now() - (ttl_nearby || ' hours')::interval
    )
  ) sub
  where sub.rn = 1;
end;
$$;

-- 4. Schedule Cron Job (Every 5 minutes)
-- Invokes the 'handle-place-activity' Edge Function
create extension if not exists pg_cron;

select cron.schedule(
  'invoke-handle-place-activity', -- Job Name
  '*/5 * * * *',                 -- Cron Schedule (Every 5 mins)
  $$
  select net.http_post(
      url:='https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/handle-place-activity',
      headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body:='{}'::jsonb
  );
  $$
);
