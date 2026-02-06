-- =====================================================
-- Migration: Extend save_onboarding_txn with interests
-- Description: Add p_interest_ids parameter to save user interests during onboarding
-- =====================================================

-- Drop existing version to avoid overloading conflicts
drop function if exists public.save_onboarding_txn(uuid, text, date, int, int[], int[], text[], int[], uuid[], text, uuid, text, int, boolean);

-- Recreate with p_interest_ids parameter
create or replace function public.save_onboarding_txn(
  p_user_id uuid,
  p_name text,
  p_birthdate date,
  p_gender_id int,
  p_connect_ids int[],
  p_intention_ids int[],
  p_photo_urls text[] default array[]::text[],
  p_photo_positions int[] default array[]::int[],
  p_favorite_place_ids uuid[] default array[]::uuid[],
  p_bio text default null,
  p_university_id uuid default null,
  p_university_name_custom text default null,
  p_graduation_year int default null,
  p_show_university_on_home boolean default null,
  p_interest_ids uuid[] default array[]::uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Upsert profile
  insert into public.profiles as p (
    id, name, birthdate, gender_id, age_range_min, age_range_max, bio,
    university_id, university_name_custom, graduation_year, show_university_on_home,
    updated_at
  )
  values (
    p_user_id, p_name, p_birthdate, p_gender_id, 18, 60, p_bio,
    p_university_id, p_university_name_custom, p_graduation_year,
    coalesce(p_show_university_on_home, (p_university_id is not null or p_university_name_custom is not null)),
    now()
  )
  on conflict (id) do update
    set name = excluded.name,
        birthdate = excluded.birthdate,
        gender_id = excluded.gender_id,
        bio = excluded.bio,
        age_range_min = coalesce(p.age_range_min, 18),
        age_range_max = coalesce(p.age_range_max, 60),
        university_id = coalesce(excluded.university_id, p.university_id),
        university_name_custom = coalesce(excluded.university_name_custom, p.university_name_custom),
        graduation_year = coalesce(excluded.graduation_year, p.graduation_year),
        show_university_on_home = coalesce(excluded.show_university_on_home, p.show_university_on_home),
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

  -- Replace favorite places when provided
  delete from public.profile_favorite_places where user_id = p_user_id;
  if array_length(p_favorite_place_ids, 1) is not null then
    insert into public.profile_favorite_places (user_id, place_id)
    select p_user_id, unnest(p_favorite_place_ids);
  end if;

  -- Replace interests when provided
  delete from public.profile_interests where profile_id = p_user_id;
  if array_length(p_interest_ids, 1) is not null then
    insert into public.profile_interests (profile_id, interest_id)
    select p_user_id, unnest(p_interest_ids);
  end if;
end;
$$;
