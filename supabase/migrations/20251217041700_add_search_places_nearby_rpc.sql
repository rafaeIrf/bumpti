DROP FUNCTION IF EXISTS search_places_nearby(float, float, float, text[], int);
DROP FUNCTION IF EXISTS search_places_nearby(float, float, float, text[], int, int);
DROP FUNCTION IF EXISTS search_places_nearby(float, float, float, text[], int, uuid);

create or replace function search_places_nearby(
  user_lat float,
  user_lng float,
  radius_meters float,
  filter_categories text[] default null,
  max_results int default 50,
  requesting_user_id uuid default null
)
returns table (
  id uuid,
  name text,
  category text,
  lat float,
  lng float,
  street text,
  city text,
  total_score int,
  active_users bigint,
  dist_meters float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.category,
    p.lat,
    p.lng,
    p.street,
    p.city,
    p.total_score,
    (
        select count(*)
        from user_presences up
        where up.place_id = p.id::text
          and up.active = true
          and up.ended_at is null
          and up.expires_at > now()
          -- Exclude self
          and (requesting_user_id is null or up.user_id != requesting_user_id)
          -- Filter Blocks
          and (requesting_user_id is null or not exists (
            select 1 from user_blocks b 
            where (b.blocker_id = requesting_user_id and b.blocked_id = up.user_id) 
               or (b.blocker_id = up.user_id and b.blocked_id = requesting_user_id)
          ))
          -- Filter Dislikes (Mutual)
          and (requesting_user_id is null or not exists (
            select 1 from user_interactions ui 
            where ui.action = 'dislike'
              and (
                  (ui.from_user_id = requesting_user_id and ui.to_user_id = up.user_id) 
                  or 
                  (ui.from_user_id = up.user_id and ui.to_user_id = requesting_user_id)
              )
          ))
          -- Filter Active Matches
          and (requesting_user_id is null or not exists (
            select 1 from user_matches um
            where um.status = 'matched'
              and (
                  (um.user_a = requesting_user_id and um.user_b = up.user_id)
                  or 
                  (um.user_a = up.user_id and um.user_b = requesting_user_id)
              )
          ))
    ) as active_users,
    st_distance(
      st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) as dist_meters
  from places p
  where st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
    and (filter_categories is null or lower(p.category) = any(select lower(c) from unnest(filter_categories) as c))
  order by dist_meters asc, p.total_score desc
  limit max_results;
end;
$$;
