-- Creates a transactional RPC to save onboarding data atomically
create or replace function public.save_onboarding_txn(
  p_user_id uuid,
  p_name text,
  p_birthdate date,
  p_gender_id int,
  p_connect_ids int[],
  p_intention_ids int[],
  p_photo_urls text[] default array[]::text[],
  p_photo_positions int[] default array[]::int[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Upsert profile
  insert into public.profiles as p (id, name, birthdate, gender_id, age_range_min, age_range_max, updated_at)
  values (p_user_id, p_name, p_birthdate, p_gender_id, 18, 35, now())
  on conflict (id) do update
    set name = excluded.name,
        birthdate = excluded.birthdate,
        gender_id = excluded.gender_id,
        age_range_min = coalesce(p.age_range_min, 18),
        age_range_max = coalesce(p.age_range_max, 35),
        updated_at = now();

  -- Replace connect_with
  delete from public.profile_connect_with where user_id = p_user_id;
  if array_length(p_connect_ids, 1) is not null then
    insert into public.profile_connect_with (user_id, gender_id)
    select p_user_id, unnest(p_connect_ids);
  end if;

  -- Replace intentions
  delete from public.profile_intentions where user_id = p_user_id;
  if array_length(p_intention_ids, 1) is not null then
    insert into public.profile_intentions (user_id, option_id)
    select p_user_id, unnest(p_intention_ids);
  end if;

  -- Replace photos when provided
  delete from public.profile_photos where user_id = p_user_id;
  if array_length(p_photo_urls, 1) is not null
     and array_length(p_photo_urls, 1) = array_length(p_photo_positions, 1) then
    insert into public.profile_photos (user_id, url, position)
    select p_user_id, url, position
    from unnest(p_photo_urls, p_photo_positions) as t(url, position);
  end if;
end;
$$;
