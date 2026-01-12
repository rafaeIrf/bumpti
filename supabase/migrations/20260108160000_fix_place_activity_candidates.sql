-- Fix ambiguous user_id column reference in get_place_activity_candidates
-- The issue is that the function returns table columns named 'user_id', 'place_id' etc.
-- but these conflict with column names in the queries inside the function.

-- Drop existing function first (return type is changing)
drop function if exists get_place_activity_candidates();

create or replace function get_place_activity_candidates()
returns table (
  target_user_id uuid,
  notification_type text,
  target_place_id uuid,
  target_place_name text
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
    select distinct on (ul.user_id) ul.user_id, ul.place_id as current_place_id
    from user_presences ul
    where ul.active = true
  )
  -- 1. FAVORITE STARTED (Count >= 1)
  select 
    fav.user_id as target_user_id,
    'favorite_activity_started'::text as notification_type,
    ac.place_id as target_place_id,
    ac.place_name as target_place_name
  from active_counts ac
  join profile_favorite_places fav on fav.place_id = ac.place_id
  where ac.count >= 1
  -- User must NOT be currently active at this place
  and not exists (
    select 1 from user_presences up_check 
    where up_check.user_id = fav.user_id 
    and up_check.place_id = ac.place_id 
    and up_check.active = true
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
    fav.user_id as target_user_id,
    'favorite_activity_heating'::text as notification_type,
    ac.place_id as target_place_id,
    ac.place_name as target_place_name
  from active_counts ac
  join profile_favorite_places fav on fav.place_id = ac.place_id
  where ac.count >= 3
  and not exists (
    select 1 from user_presences up_check 
    where up_check.user_id = fav.user_id 
    and up_check.place_id = ac.place_id 
    and up_check.active = true
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
  select
    sub.target_user_id,
    'nearby_activity_heating'::text as notification_type,
    sub.target_place_id,
    sub.target_place_name
  from (
    select
      up_active.user_id as target_user_id,
      ac.place_id as target_place_id,
      ac.place_name as target_place_name,
      row_number() over (partition by up_active.user_id order by ac.count desc) as rn
    from active_counts ac
    join user_presences up_active on up_active.active = true
    join places user_place on user_place.id = up_active.place_id
    where ac.count >= 5
    and ac.place_id != up_active.place_id
    -- Distance Check (PostGIS) - 20km
    and st_dwithin(
      st_point(user_place.lng, user_place.lat)::geography,
      st_point(ac.lng, ac.lat)::geography,
      20000
    )
    -- Exclude if it's a favorite (handled by favorite rules)
    and not exists (
      select 1 from profile_favorite_places fav_check 
      where fav_check.user_id = up_active.user_id 
      and fav_check.place_id = ac.place_id
    )
    -- TTL Check
    and not exists (
      select 1 from notification_events ne
      where ne.user_id = up_active.user_id
      and ne.place_id = ac.place_id
      and ne.type = 'nearby_activity_heating'
      and ne.created_at > now() - (ttl_nearby || ' hours')::interval
    )
  ) sub
  where sub.rn = 1;
end;
$$;
