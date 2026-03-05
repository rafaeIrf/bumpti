-- Update save_onboarding_txn to accept and persist photo hashes (image_hash column)

-- Drop existing versions to avoid overloading conflicts
DROP FUNCTION IF EXISTS save_onboarding_txn(uuid, text, date, int, int[], int[], text[], int[], uuid[], text, uuid, text, int, boolean, uuid[]);
-- Drop broken overload that used wrong types (text[] for place_ids, int[] for interest_ids)
DROP FUNCTION IF EXISTS save_onboarding_txn(uuid, text, date, int, int[], int[], text[], int[], text[], text, uuid, text, int, boolean, int[]);
-- Drop broken overload with photo_hashes that also used wrong types
DROP FUNCTION IF EXISTS save_onboarding_txn(uuid, text, date, int, int[], int[], text[], int[], text[], text[], text, uuid, text, int, boolean, int[]);

CREATE OR REPLACE FUNCTION save_onboarding_txn(
  p_user_id uuid,
  p_name text,
  p_birthdate date,
  p_gender_id int,
  p_connect_ids int[],
  p_intention_ids int[],
  p_photo_urls text[] DEFAULT array[]::text[],
  p_photo_positions int[] DEFAULT array[]::int[],
  p_photo_hashes text[] DEFAULT array[]::text[],
  p_favorite_place_ids uuid[] DEFAULT array[]::uuid[],
  p_bio text DEFAULT null,
  p_university_id uuid DEFAULT null,
  p_university_name_custom text DEFAULT null,
  p_graduation_year int DEFAULT null,
  p_show_university_on_home boolean DEFAULT null,
  p_interest_ids uuid[] DEFAULT array[]::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Replace photos when provided (includes image_hash from moderation)
  delete from public.profile_photos where user_id = p_user_id;
  if array_length(p_photo_urls, 1) is not null
     and array_length(p_photo_urls, 1) = array_length(p_photo_positions, 1) then
    insert into public.profile_photos (user_id, url, position, image_hash)
    select p_user_id, url, position,
           case when array_length(p_photo_hashes, 1) is not null then p_photo_hashes[idx] else null end
    from unnest(p_photo_urls, p_photo_positions) with ordinality as t(url, position, idx);
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
