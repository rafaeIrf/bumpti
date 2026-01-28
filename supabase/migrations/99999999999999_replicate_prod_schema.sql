


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."user_avatar" AS (
	"user_id" "uuid",
	"url" "text"
);


ALTER TYPE "public"."user_avatar" OWNER TO "postgres";


CREATE TYPE "public"."active_users_info" AS (
	"count" bigint,
	"avatars" "public"."user_avatar"[]
);


ALTER TYPE "public"."active_users_info" OWNER TO "postgres";


CREATE TYPE "public"."place_report_reason" AS ENUM (
    'closed',
    'wrong_info',
    'does_not_exist',
    'inappropriate',
    'other'
);


ALTER TYPE "public"."place_report_reason" OWNER TO "postgres";


CREATE TYPE "public"."place_report_status" AS ENUM (
    'pending',
    'resolved',
    'ignored'
);


ALTER TYPE "public"."place_report_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_insert_places_osm"("places_input" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  item jsonb;
  new_place_id uuid;
begin
  for item in
    select * from jsonb_array_elements(places_input)
  loop

    -- Evita duplicar por source
    if exists (
      select 1
      from place_sources
      where provider = 'osm'
        and external_id = item->>'external_id'
    ) then
      continue;
    end if;

    -- Insere place
    insert into places (
      name,
      category,
      lat,
      lng,
      street,
      house_number,
      neighborhood,
      city,
      state,
      postal_code,
      country_code,
      structural_score,
      social_score,
      total_score,
      last_osm_edit_at,
      osm_version
    ) values (
      item->>'name',
      item->>'category',
      (item->>'lat')::double precision,
      (item->>'lng')::double precision,
      item->'address'->>'street',
      item->'address'->>'house_number',
      item->'address'->>'neighborhood',
      item->'address'->>'city',
      item->'address'->>'state',
      item->'address'->>'postal_code',
      item->'address'->>'country_code',
      coalesce((item->>'structural_score')::int, 0),
      coalesce((item->>'social_score')::int, 0),
      coalesce((item->>'total_score')::int, 0),
      (item->>'last_osm_edit_at')::timestamptz,
      (item->>'osm_version')::int
    )
    returning id into new_place_id;

    -- Insere source
    insert into place_sources (
      place_id,
      provider,
      external_id,
      raw
    ) values (
      new_place_id,
      'osm',
      item->>'external_id',
      item
    );

  end loop;
end;
$$;


ALTER FUNCTION "public"."bulk_insert_places_osm"("places_input" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_lock_city_for_hydration"("user_lat" double precision, "user_lng" double precision) RETURNS TABLE("id" "uuid", "city_name" "text", "country_code" "text", "status" "text", "last_hydrated_at" timestamp with time zone, "bbox" double precision[], "should_hydrate" boolean, "skip_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  city_record RECORD;
  should_proceed boolean := FALSE;
  reason text := NULL;
  days_since_hydration integer;
  revalidation_days constant integer := 60;
BEGIN
  -- Find city with lock (lock held until transaction commits)
  SELECT 
    c.id,
    c.city_name,
    c.country_code,
    c.status,
    c.last_hydrated_at,
    c.bbox
  INTO city_record
  FROM cities_registry c
  WHERE ST_Contains(
    ST_MakeEnvelope(
      c.bbox[1],  -- min_lng
      c.bbox[2],  -- min_lat
      c.bbox[3],  -- max_lng
      c.bbox[4],  -- max_lat
      4326
    ),
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
  )
  LIMIT 1
  FOR UPDATE;  -- Lock acquired here
  
  -- If no city found, return null
  IF city_record.id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if already processing
  IF city_record.status = 'processing' THEN
    reason := 'already_processing';
    should_proceed := FALSE;
  
  -- Check if completed and fresh
  ELSIF city_record.status = 'completed' AND city_record.last_hydrated_at IS NOT NULL THEN
    days_since_hydration := EXTRACT(DAY FROM (NOW() - city_record.last_hydrated_at));
    
    IF days_since_hydration <= revalidation_days THEN
      reason := 'fresh';
      should_proceed := FALSE;
    ELSE
      -- Stale, needs refresh
      reason := 'stale';
      should_proceed := TRUE;
    END IF;
  
  -- Failed, pending, or other status - needs hydration
  ELSE
    reason := 'needs_hydration';
    should_proceed := TRUE;
  END IF;
  
  -- Update status to processing if should proceed
  IF should_proceed THEN
    UPDATE cities_registry
    SET status = 'processing',
        updated_at = NOW()
    WHERE cities_registry.id = city_record.id;
    
    city_record.status := 'processing';
  END IF;
  
  -- Return city data with flags
  RETURN QUERY SELECT 
    city_record.id,
    city_record.city_name,
    city_record.country_code::text,  -- Cast char(2) to text
    city_record.status,
    city_record.last_hydrated_at,
    city_record.bbox,
    should_proceed,
    reason;
END;
$$;


ALTER FUNCTION "public"."check_and_lock_city_for_hydration"("user_lat" double precision, "user_lng" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_lock_city_for_hydration"("user_lat" double precision, "user_lng" double precision) IS 'Atomically check city, evaluate skip logic, and update status.
All logic in single transaction with lock held throughout.
Returns should_hydrate=true only if city needs hydration.
Skip reasons: already_processing, fresh, stale, needs_hydration.
FIXED: bbox is array [min_lng, min_lat, max_lng, max_lat] not JSONB.';



CREATE OR REPLACE FUNCTION "public"."check_city_by_coordinates"("user_lat" double precision, "user_lng" double precision) RETURNS TABLE("id" "uuid", "city_name" "text", "country_code" character, "geom" "public"."geometry", "bbox" double precision[], "status" "text", "last_hydrated_at" timestamp with time zone, "priority_score" integer, "error_message" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.city_name,
    cr.country_code,
    cr.geom,
    cr.bbox,
    cr.status,
    cr.last_hydrated_at,
    cr.priority_score,
    cr.error_message,
    cr.created_at,
    cr.updated_at
  FROM cities_registry cr
  WHERE cr.status = 'completed'
    AND ST_Contains(cr.geom, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326))
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."check_city_by_coordinates"("user_lat" double precision, "user_lng" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_checkin_credit"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update credits, ensuring it doesn't go below 0
  UPDATE public.user_checkin_credits
  SET 
    credits = GREATEST(credits - 1, 0),
    updated_at = now()
  WHERE user_id = p_user_id
    AND credits > 0;
  
  -- If no row was updated, the user either doesn't exist or has 0 credits
  -- We don't throw an error here, just silently fail
  IF NOT FOUND THEN
    RAISE WARNING 'No credits to decrement for user %', p_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."decrement_checkin_credit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_completely"("target_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  -- Delete from public.profiles first (CASCADE will handle profile_* tables)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Delete from auth schema
  DELETE FROM auth.identities WHERE user_id = target_user_id;
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
  
  result := json_build_object(
    'success', true,
    'user_id', target_user_id,
    'message', 'User deleted successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'user_id', target_user_id,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."delete_user_completely"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_invisible_on_subscription_end"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Disable invisible mode for this user
  -- (Trigger WHEN clause ensures this only runs when status changes to non-active)
  UPDATE profiles
  SET is_invisible = false
  WHERE id = NEW.user_id
    AND is_invisible = true; -- Only update if it's currently enabled
  
  -- Log for debugging (optional, can be removed in production)
  RAISE NOTICE 'Disabled invisible mode for user % (subscription status changed to: %)', 
    NEW.user_id, NEW.status;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."disable_invisible_on_subscription_end"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."disable_invisible_on_subscription_end"() IS 'Automatically disables invisible mode when user subscription status changes from active to inactive';



CREATE OR REPLACE FUNCTION "public"."enter_place"("p_user_id" "uuid", "p_place_id" "uuid", "p_user_lat" double precision DEFAULT NULL::double precision, "p_user_lng" double precision DEFAULT NULL::double precision, "p_is_checkin_plus" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_inside_boundary boolean := false;
  v_existing_presence record;
  v_new_presence record;
  v_entry_type text;
  v_new_expires_at timestamptz;
  v_remaining_credits int;
  v_result jsonb;
BEGIN
  v_new_expires_at := NOW() + INTERVAL '30 minutes';

  -- 1. Check boundary intersection (if coordinates provided)
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    SELECT ST_Intersects(
      p.boundary,
      ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)
    ) INTO v_inside_boundary
    FROM places p
    WHERE p.id = p_place_id
      AND p.active = true
      AND p.boundary IS NOT NULL;
    
    v_inside_boundary := COALESCE(v_inside_boundary, false);
  END IF;

  -- 2. Check for existing active presence
  SELECT * INTO v_existing_presence
  FROM user_presences
  WHERE user_id = p_user_id
    AND place_id = p_place_id
    AND active = true
    AND ended_at IS NULL
    AND expires_at > NOW()
  ORDER BY entered_at DESC
  LIMIT 1;

  -- 3a. Existing presence found - refresh it
  IF v_existing_presence.id IS NOT NULL THEN
    -- Upgrade checkin_plus to physical if now inside boundary
    IF v_existing_presence.entry_type = 'checkin_plus' AND v_inside_boundary THEN
      UPDATE user_presences
      SET entry_type = 'physical',
          lat = p_user_lat,
          lng = p_user_lng,
          expires_at = v_new_expires_at
      WHERE id = v_existing_presence.id
      RETURNING * INTO v_existing_presence;
    ELSE
      -- Just refresh expires_at
      UPDATE user_presences
      SET expires_at = v_new_expires_at
      WHERE id = v_existing_presence.id
      RETURNING * INTO v_existing_presence;
    END IF;

    RETURN jsonb_build_object(
      'status', 'refreshed',
      'presence', row_to_json(v_existing_presence)::jsonb,
      'inside_boundary', v_inside_boundary
    );
  END IF;

  -- 3b. No existing presence - validate and create new
  IF NOT v_inside_boundary THEN
    IF p_is_checkin_plus THEN
      v_entry_type := 'checkin_plus';
    ELSE
      -- User is outside boundary and not using checkin_plus
      RETURN jsonb_build_object(
        'status', 'rejected',
        'error', 'outside_boundary',
        'inside_boundary', false
      );
    END IF;
  ELSE
    v_entry_type := 'physical';
  END IF;

  -- Insert new presence
  INSERT INTO user_presences (user_id, place_id, lat, lng, active, entry_type, expires_at)
  VALUES (p_user_id, p_place_id, p_user_lat, p_user_lng, true, v_entry_type, v_new_expires_at)
  RETURNING * INTO v_new_presence;

  -- 4. Consume credit if checkin_plus
  IF v_entry_type = 'checkin_plus' THEN
    UPDATE user_checkin_credits
    SET credits = GREATEST(credits - 1, 0),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    SELECT credits INTO v_remaining_credits
    FROM user_checkin_credits
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'created',
    'presence', row_to_json(v_new_presence)::jsonb,
    'inside_boundary', v_inside_boundary,
    'remaining_credits', v_remaining_credits
  );
END;
$$;


ALTER FUNCTION "public"."enter_place"("p_user_id" "uuid", "p_place_id" "uuid", "p_user_lat" double precision, "p_user_lng" double precision, "p_is_checkin_plus" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enter_place"("p_user_id" "uuid", "p_place_id" "uuid", "p_user_lat" double precision, "p_user_lng" double precision, "p_is_checkin_plus" boolean) IS 'Unified enter-place operation. Handles boundary check, presence refresh/insert, and credit decrement in one call.';



CREATE OR REPLACE FUNCTION "public"."find_city_by_coordinates"("search_lat" double precision, "search_lng" double precision, "tolerance_meters" double precision DEFAULT 1000) RETURNS TABLE("id" "uuid", "city_name" "text", "status" "text", "lat" double precision, "lng" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.city_name,
    cr.status,
    cr.lat,
    cr.lng
  FROM cities_registry cr
  WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(cr.lng, cr.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
    tolerance_meters
  )
  ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(cr.lng, cr.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
  ) ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_city_by_coordinates"("search_lat" double precision, "search_lng" double precision, "tolerance_meters" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_user_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid" DEFAULT NULL::"uuid", "max_avatars" integer DEFAULT 5) RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT ARRAY_AGG(avatar_url)
    FROM (
      SELECT p.photos[1] as avatar_url
      FROM user_presences up
      INNER JOIN profiles p ON p.id = up.user_id
      WHERE up.place_id = target_place_id
        AND up.active = true
        AND up.ended_at IS NULL
        AND up.expires_at > NOW()
        AND p.photos IS NOT NULL
        AND array_length(p.photos, 1) > 0
        AND p.photos[1] IS NOT NULL
        -- Exclude self
        AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
        -- Exclude blocked users (bidirectional)
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_blocks b 
          WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
             OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
        ))
        -- Exclude disliked users (bidirectional)
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_interactions ui 
          WHERE ui.action = 'dislike'
            AND (
              (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
              OR 
              (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
            )
        ))
        -- Exclude users with pending likes
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_interactions ui 
          WHERE ui.action = 'like'
            AND ui.from_user_id = requesting_user_id 
            AND ui.to_user_id = up.user_id
        ))
        -- Exclude active matched users
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_matches um
          WHERE um.status = 'active'
            AND (
              (um.user_a = requesting_user_id AND um.user_b = up.user_id)
              OR 
              (um.user_a = up.user_id AND um.user_b = requesting_user_id)
            )
        ))
        -- Require matching gender preference
        AND (requesting_user_id IS NULL OR EXISTS (
          SELECT 1 FROM profile_connect_with pcw
          INNER JOIN profiles rp ON rp.id = requesting_user_id
          WHERE pcw.user_id = up.user_id
            AND pcw.gender_id = rp.gender_id
        ))
      ORDER BY up.entered_at DESC
      LIMIT max_avatars
    ) subq
  );
END;
$$;


ALTER FUNCTION "public"."get_active_user_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_users_with_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid" DEFAULT NULL::"uuid", "max_avatars" integer DEFAULT 5) RETURNS "public"."active_users_info"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result active_users_info;
  avatar_data user_avatar[];
  req_age_min integer;
  req_age_max integer;
  req_age integer;
BEGIN
  -- Get requesting user's age preferences AND their own age
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      age_range_min, 
      age_range_max,
      EXTRACT(YEAR FROM AGE(birthdate))::integer
    INTO req_age_min, req_age_max, req_age
    FROM profiles
    WHERE id = requesting_user_id;
  END IF;

  -- Get the count of eligible active users
  SELECT COUNT(*) INTO result.count
  FROM user_presences up
  WHERE up.place_id = target_place_id
    AND up.active = true
    AND up.ended_at IS NULL
    AND up.expires_at > NOW()
    -- Exclude self
    AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
    -- Exclude blocked users (bidirectional)
    AND (requesting_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM user_blocks b 
      WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
         OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
    ))
    -- Exclude disliked users (bidirectional)
    AND (requesting_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM user_interactions ui 
      WHERE ui.action = 'dislike'
        AND (
          (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
          OR 
          (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
        )
    ))
    -- Exclude users with pending likes
    AND (requesting_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM user_interactions ui 
      WHERE ui.action = 'like'
        AND ui.from_user_id = requesting_user_id 
        AND ui.to_user_id = up.user_id
    ))
    -- Exclude active matched users (bidirectional)
    AND (requesting_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM user_matches um
      WHERE um.status = 'active'
        AND (
          (um.user_a = requesting_user_id AND um.user_b = up.user_id)
          OR 
          (um.user_a = up.user_id AND um.user_b = requesting_user_id)
        )
    ))
    -- Require matching gender preference
    AND (requesting_user_id IS NULL OR EXISTS (
      SELECT 1 FROM profile_connect_with pcw
      INNER JOIN profiles rp ON rp.id = requesting_user_id
      WHERE pcw.user_id = up.user_id
        AND pcw.gender_id = rp.gender_id
    ))
    -- BIDIRECTIONAL age filter: target user must be in MY age range
    AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.birthdate IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
        AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
    ))
    -- BIDIRECTIONAL age filter: I must be in TARGET user's age range
    AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
             OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
    ));

  -- Get avatar URLs with user_id for up to max_avatars eligible users
  SELECT ARRAY(
    SELECT ROW(up.user_id, pp.url)::user_avatar
    FROM user_presences up
    INNER JOIN profile_photos pp ON pp.user_id = up.user_id AND pp.position = 0
    WHERE up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND pp.url IS NOT NULL
      -- Same eligibility filters
      AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_blocks b 
        WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
           OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
      ))
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'dislike'
          AND (
            (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
            OR 
            (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
          )
      ))
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'like'
          AND ui.from_user_id = requesting_user_id 
          AND ui.to_user_id = up.user_id
      ))
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_matches um
        WHERE um.status = 'active'
          AND (
            (um.user_a = requesting_user_id AND um.user_b = up.user_id)
            OR 
            (um.user_a = up.user_id AND um.user_b = requesting_user_id)
          )
      ))
      AND (requesting_user_id IS NULL OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      ))
      -- BIDIRECTIONAL age filter
      AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.birthdate IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
      ))
      AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
               OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
      ))
    ORDER BY up.entered_at DESC
    LIMIT max_avatars
  ) INTO avatar_data;

  result.avatars := avatar_data;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_active_users_with_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_users_with_avatars_batch"("place_ids" "uuid"[], "requesting_user_id" "uuid" DEFAULT NULL::"uuid", "max_avatars" integer DEFAULT 3) RETURNS TABLE("place_id" "uuid", "count" bigint, "avatars" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH place_users AS (
    SELECT 
      p.place_id,
      get_active_users_with_avatars(p.place_id, requesting_user_id, max_avatars) as user_data
    FROM unnest(place_ids) as p(place_id)
  )
  SELECT 
    pu.place_id,
    (pu.user_data).count,
    (pu.user_data).avatars
  FROM place_users pu;
END;
$$;


ALTER FUNCTION "public"."get_active_users_with_avatars_batch"("place_ids" "uuid"[], "requesting_user_id" "uuid", "max_avatars" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_users_at_place"("p_place_id" "uuid", "viewer_id" "uuid") RETURNS TABLE("user_id" "uuid", "name" "text", "age" integer, "bio" "text", "intentions" "text"[], "photos" "text"[], "entered_at" timestamp with time zone, "expires_at" timestamp with time zone, "job_title" "text", "company_name" "text", "height_cm" integer, "zodiac_sign" "text", "education_level" "text", "relationship_status" "text", "smoking_habit" "text", "favorite_places" "text"[], "languages" "text"[], "entry_type" "text", "university_id" "uuid", "university_name" "text", "university_name_custom" "text", "graduation_year" integer, "show_university_on_home" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  viewer_age_min integer;
  viewer_age_max integer;
  viewer_age integer;
BEGIN
  -- Get viewer's age preferences AND their own age
  SELECT 
    age_range_min, 
    age_range_max,
    EXTRACT(YEAR FROM AGE(birthdate))::integer
  INTO viewer_age_min, viewer_age_max, viewer_age
  FROM profiles
  WHERE id = viewer_id;

  RETURN QUERY
  WITH active_presences AS (
    -- Get active presences at this place
    SELECT 
      up.user_id AS u_id,
      up.entered_at AS u_entered_at,
      up.expires_at AS u_expires_at,
      up.entry_type AS u_entry_type
    FROM user_presences up
    WHERE up.place_id = p_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      AND up.user_id != viewer_id
  ),
  viewer_profile AS (
    -- Cache viewer's profile for preference matching and filters
    SELECT 
      gender_id,
     filter_only_verified,
      verification_status
    FROM profiles 
    WHERE id = viewer_id
  ),
  eligible_users AS (
    SELECT ap.*
    FROM active_presences ap
    -- Exclude blocked users (bidirectional)
    WHERE NOT EXISTS (
      SELECT 1 FROM user_blocks b 
      WHERE (b.blocker_id = viewer_id AND b.blocked_id = ap.u_id) 
         OR (b.blocker_id = ap.u_id AND b.blocked_id = viewer_id)
    )
    -- Exclude users I disliked or liked
    AND NOT EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = viewer_id
        AND ui.to_user_id = ap.u_id
        AND (ui.action = 'dislike' OR ui.action = 'like')
    )
    -- Exclude users who disliked me
    AND NOT EXISTS (
      SELECT 1 FROM user_interactions ui
      WHERE ui.from_user_id = ap.u_id
        AND ui.to_user_id = viewer_id
        AND ui.action = 'dislike'
    )
    -- Exclude active matches
    AND NOT EXISTS (
      SELECT 1 FROM user_matches um
      WHERE um.status = 'active'
        AND (
          (um.user_a = viewer_id AND um.user_b = ap.u_id)
          OR (um.user_a = ap.u_id AND um.user_b = viewer_id)
        )
    )
    -- Gender preference filter
    AND EXISTS (
      SELECT 1 FROM profile_connect_with pcw, viewer_profile vp
      WHERE pcw.user_id = ap.u_id
        AND pcw.gender_id = vp.gender_id
    )
    -- BIDIRECTIONAL age filter: target user must be in MY age range
    AND (viewer_age_min IS NULL OR viewer_age_max IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_p
      WHERE target_p.id = ap.u_id
        AND target_p.birthdate IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(target_p.birthdate)) >= viewer_age_min
        AND EXTRACT(YEAR FROM AGE(target_p.birthdate)) <= viewer_age_max
    ))
    -- BIDIRECTIONAL age filter: I must be in TARGET user's age range
    AND (viewer_age IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_p
      WHERE target_p.id = ap.u_id
        AND (target_p.age_range_min IS NULL OR target_p.age_range_max IS NULL
             OR (viewer_age >= target_p.age_range_min AND viewer_age <= target_p.age_range_max))
    ))
  )
  SELECT
    eu.u_id AS user_id,
    p.name,
    date_part('year', age(p.birthdate))::int AS age,
    p.bio,
    COALESCE(intent.intentions, ARRAY[]::text[]) AS intentions,
    COALESCE(photo.photos, ARRAY[]::text[]) AS photos,
    eu.u_entered_at AS entered_at,
    eu.u_expires_at AS expires_at,
    p.job_title,
    p.company_name,
    p.height_cm,
    zs.key AS zodiac_sign,
    el.key AS education_level,
    rs.key AS relationship_status,
    sh.key AS smoking_habit,
    COALESCE(fav.places, ARRAY[]::text[]) AS favorite_places,
    COALESCE(lang.langs, ARRAY[]::text[]) AS languages,
    COALESCE(eu.u_entry_type, 'physical')::text AS entry_type,
    -- University fields from profiles table
    p.university_id,
    COALESCE(univ_place.name, p.university_name_custom) AS university_name,
    p.university_name_custom,
    p.graduation_year,
    COALESCE(p.show_university_on_home, false) AS show_university_on_home
  FROM eligible_users eu
  JOIN profiles p ON p.id = eu.u_id
  CROSS JOIN viewer_profile vp
  LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
  LEFT JOIN education_levels el ON el.id = p.education_id
  LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
  LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id
  -- Join with places to get university name if university_id is set
  LEFT JOIN places univ_place ON univ_place.id = p.university_id
  -- Aggregate intentions from profile_intentions + intention_options
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT io.key) AS intentions
    FROM profile_intentions pi
    JOIN intention_options io ON io.id = pi.option_id
    WHERE pi.user_id = eu.u_id
  ) intent ON true
  -- Aggregate photos from profile_photos ordered by position
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(pp.url ORDER BY pp.position ASC) AS photos
    FROM profile_photos pp
    WHERE pp.user_id = eu.u_id
  ) photo ON true
  -- Aggregate favorite places
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT pfp.place_id::text) AS places
    FROM profile_favorite_places pfp
    WHERE pfp.user_id = eu.u_id
  ) fav ON true
  -- Aggregate languages
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT l.key) AS langs
    FROM profile_languages pl
    JOIN languages l ON l.id = pl.language_id
    WHERE pl.user_id = eu.u_id
  ) lang ON true
  WHERE
    -- Invisible mode check (show if they liked me)
    (
      p.is_invisible = false
      OR EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = eu.u_id
          AND ui.to_user_id = viewer_id
          AND ui.action = 'like'
          AND ui.action_expires_at > NOW()
      )
    )
    -- TRUST CIRCLE FILTER: Bidirectional verified-only filtering
    -- RULE 1: If viewer has filter_only_verified = true, only show verified profiles
    AND (
      vp.filter_only_verified = false
      OR vp.filter_only_verified IS NULL
      OR p.verification_status = 'verified'
    )
    -- RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
    AND (
      p.filter_only_verified = false
      OR p.filter_only_verified IS NULL
      OR vp.verification_status = 'verified'
    )
  ORDER BY 
    -- Prioritize users who liked me
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = eu.u_id
          AND ui.to_user_id = viewer_id
          AND ui.action = 'like'
          AND ui.action_expires_at > NOW()
      ) THEN 0
      ELSE 1
    END,
    eu.u_entered_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_available_users_at_place"("p_place_id" "uuid", "viewer_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_users_at_place"("p_place_id" "uuid", "viewer_id" "uuid") IS 'Returns eligible users at a place for the viewer.
Filters: blocks, dislikes, likes, active matches, gender preferences, bidirectional age filter, invisible mode, Trust Circle.
Includes entry_type (physical/checkin_plus), university fields, and properly aggregated intentions/photos.';



CREATE OR REPLACE FUNCTION "public"."get_current_place_candidate"("p_user_id" "uuid", "user_lat" double precision, "user_lng" double precision) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result jsonb;
BEGIN
  -- Check if user already has an active check-in
  -- If yes, don't suggest new places
  IF EXISTS (
    SELECT 1 FROM user_presences
    WHERE user_id = p_user_id
      AND active = true
      AND ended_at IS NULL
      AND expires_at > NOW()
  ) THEN
    RETURN NULL; -- No suggestion if already checked in
  END IF;

  -- Return the best candidate place with full information matching places-nearby format
  -- Dismissal filtering is handled client-side
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'category', p.category,
    'latitude', p.lat,
    'longitude', p.lng,
    'formatted_address', CONCAT_WS(', ',
      CASE WHEN p.street IS NOT NULL AND p.house_number IS NOT NULL 
        THEN p.street || ', ' || p.house_number 
        ELSE p.street 
      END
    ),
    'types', ARRAY[p.category],
    'dist_meters', ST_Distance(
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
    ),
    'active_users', get_eligible_active_users_count(p.id, p_user_id),
    'preview_avatars', (
      SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
      FROM unnest((get_active_users_with_avatars(p.id, p_user_id, 3)).avatars) a
    ),
    'review', CASE 
      WHEN COALESCE(reviews.total_reviews, 0) > 0 THEN
        jsonb_build_object(
          'average', COALESCE(reviews.avg_stars, 0),
          'count', COALESCE(reviews.total_reviews, 0),
          'tags', COALESCE(reviews.top_tags, ARRAY[]::text[])
        )
      ELSE NULL
    END
  )
  INTO result
  FROM places p
  LEFT JOIN LATERAL (
    SELECT 
      AVG(psr.stars)::float as avg_stars,
      COUNT(psr.id) as total_reviews,
      ARRAY(
        SELECT t.key
        FROM place_review_tag_relations prtr
        JOIN place_review_tags t ON t.id = prtr.tag_id
        JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
        WHERE psr2.place_id = p.id
        GROUP BY t.key
        ORDER BY COUNT(*) DESC
        LIMIT 3
      ) as top_tags
    FROM place_social_reviews psr
    WHERE psr.place_id = p.id
  ) reviews ON true
  WHERE p.boundary IS NOT NULL
    AND p.active = true
    AND ST_Contains(
      p.boundary,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
    )
  ORDER BY p.relevance_score DESC
  LIMIT 1;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_current_place_candidate"("p_user_id" "uuid", "user_lat" double precision, "user_lng" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_place_candidate"("p_user_id" "uuid", "user_lat" double precision, "user_lng" double precision) IS 'Returns complete place information for detected location. Checks for active presence. Returns format compatible with PlaceDetailsBottomSheet.';



CREATE OR REPLACE FUNCTION "public"."get_eligible_active_users_count"("target_place_id" "uuid", "requesting_user_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  req_age_min integer;
  req_age_max integer;
  req_age integer;
BEGIN
  -- Get requesting user's age preferences AND their own age
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      age_range_min, 
      age_range_max,
      EXTRACT(YEAR FROM AGE(birthdate))::integer
    INTO req_age_min, req_age_max, req_age
    FROM profiles
    WHERE id = requesting_user_id;
  END IF;

  RETURN (
    SELECT COUNT(*)
    FROM user_presences up
    WHERE up.place_id = target_place_id
      AND up.active = true
      AND up.ended_at IS NULL
      AND up.expires_at > NOW()
      -- Exclude self
      AND (requesting_user_id IS NULL OR up.user_id != requesting_user_id)
      -- Exclude blocked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_blocks b 
        WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = up.user_id) 
           OR (b.blocker_id = up.user_id AND b.blocked_id = requesting_user_id)
      ))
      -- Exclude disliked users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'dislike'
          AND (
            (ui.from_user_id = requesting_user_id AND ui.to_user_id = up.user_id) 
            OR 
            (ui.from_user_id = up.user_id AND ui.to_user_id = requesting_user_id)
          )
      ))
      -- Exclude users with pending likes
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_interactions ui 
        WHERE ui.action = 'like'
          AND ui.from_user_id = requesting_user_id 
          AND ui.to_user_id = up.user_id
      ))
      -- Exclude active matched users (bidirectional)
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_matches um
        WHERE um.status = 'active'
          AND (
            (um.user_a = requesting_user_id AND um.user_b = up.user_id)
            OR 
            (um.user_a = up.user_id AND um.user_b = requesting_user_id)
          )
      ))
      -- Require matching gender preference
      AND (requesting_user_id IS NULL OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      ))
      -- BIDIRECTIONAL age filter: target user must be in MY age range
      AND (requesting_user_id IS NULL OR req_age_min IS NULL OR req_age_max IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.birthdate IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) >= req_age_min
          AND EXTRACT(YEAR FROM AGE(target_profile.birthdate)) <= req_age_max
      ))
      -- BIDIRECTIONAL age filter: I must be in TARGET user's age range
      AND (requesting_user_id IS NULL OR req_age IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND (target_profile.age_range_min IS NULL OR target_profile.age_range_max IS NULL
               OR (req_age >= target_profile.age_range_min AND req_age <= target_profile.age_range_max))
      ))
  );
END;
$$;


ALTER FUNCTION "public"."get_eligible_active_users_count"("target_place_id" "uuid", "requesting_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_eligible_active_users_count"("target_place_id" "uuid", "requesting_user_id" "uuid") IS 'Returns count of eligible active users at a place for a requesting user.
Excludes: self, blocked, disliked, liked (pending), matched users.
Filters by gender preference compatibility.';



CREATE OR REPLACE FUNCTION "public"."get_favorite_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision DEFAULT 50000, "max_results" integer DEFAULT 20, "requesting_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "city" "text", "state" "text", "country" "text", "active_users" integer, "preview_avatars" "text"[], "dist_meters" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF requesting_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH favorites AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.city,
      p.state,
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info
    FROM places p
    INNER JOIN user_favorite_places ufp ON ufp.place_id = p.id
    WHERE
      p.active = true
      AND ufp.user_id = requesting_user_id
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  )
  SELECT 
    f.id,
    f.name,
    f.category,
    f.lat,
    f.lng,
    f.street,
    f.house_number,
    f.city,
    f.state,
    f.country,
    (f.users_info).count::integer as active_users,
    (f.users_info).avatars as preview_avatars,
    f.dist_meters
  FROM favorites f
  ORDER BY (f.users_info).count DESC, f.dist_meters ASC
  LIMIT max_results;
END;
$$;


ALTER FUNCTION "public"."get_favorite_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_likes"("viewer_id" "uuid") RETURNS TABLE("pending_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
with likes as (
  select ui.from_user_id
  from user_interactions ui
  where ui.to_user_id = viewer_id
    and ui.action = 'like'
    and (ui.action_expires_at is null or ui.action_expires_at > now())
),
not_recip as (
  select distinct l.from_user_id as user_id
  from likes l
  where not exists (
    -- If the viewer has any interaction (like OR dislike) towards this user
    -- consider it handled and exclude from pending
    select 1 from user_interactions ui2
    where ui2.from_user_id = viewer_id
      and ui2.to_user_id = l.from_user_id
      and ui2.action in ('like', 'dislike')
      and (ui2.action_expires_at is null or ui2.action_expires_at > now())
  )
  and not exists (
    select 1 from user_matches m
    where ((m.user_a = viewer_id and m.user_b = l.from_user_id) or (m.user_b = viewer_id and m.user_a = l.from_user_id))
      and m.status in ('active', 'unmatched')
  )
  and not exists (
    select 1 from user_blocks ub
    where (ub.blocker_id = viewer_id and ub.blocked_id = l.from_user_id)
       or (ub.blocker_id = l.from_user_id and ub.blocked_id = viewer_id)
  )
)
select
  (select count(*)::bigint from not_recip) as pending_count
from not_recip limit 1;
$$;


ALTER FUNCTION "public"."get_pending_likes"("viewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_likes_users"("viewer_id" "uuid") RETURNS TABLE("user_id" "uuid", "name" "text", "bio" "text", "age" integer, "gender" "text", "zodiac_sign" "text", "education_level" "text", "relationship_status" "text", "height_cm" integer, "city_name" "text", "state_name" "text", "smoking_habit" "text", "job_title" "text", "company_name" "text", "favorite_places" "text"[], "languages" "text"[], "photos" "text"[], "place_id" "text")
    LANGUAGE "sql" STABLE
    AS $$
WITH pending_users AS (
  SELECT DISTINCT ON (ui.from_user_id)
    ui.from_user_id AS user_id,
    ui.place_id,
    ui.created_at
  FROM user_interactions ui
  WHERE ui.to_user_id = viewer_id
    AND ui.action = 'like'
    AND (ui.action_expires_at IS NULL OR ui.action_expires_at > NOW())

    AND NOT EXISTS (
      SELECT 1
      FROM user_interactions ui2
      WHERE ui2.from_user_id = viewer_id
        AND ui2.to_user_id = ui.from_user_id
        AND ui2.action IN ('like', 'dislike')
        AND (ui2.action_expires_at IS NULL OR ui2.action_expires_at > NOW())
    )

    AND NOT EXISTS (
      SELECT 1
      FROM user_matches m
      WHERE (
        (m.user_a = viewer_id AND m.user_b = ui.from_user_id)
        OR
        (m.user_b = viewer_id AND m.user_a = ui.from_user_id)
      )
      AND m.status IN ('active', 'unmatched')
    )

    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks ub
      WHERE
        (ub.blocker_id = viewer_id AND ub.blocked_id = ui.from_user_id)
        OR
        (ub.blocker_id = ui.from_user_id AND ub.blocked_id = viewer_id)
    )
  ORDER BY ui.from_user_id, ui.created_at DESC
)

SELECT
  p.id AS user_id,
  p.name,
  p.bio,

  date_part('year', age(p.birthdate))::int AS age,

  go.key AS gender,
  zs.key AS zodiac_sign,
  el.key AS education_level,
  rs.key AS relationship_status,
  p.height_cm,

  p.city_name,
  p.city_state AS state_name,

  sh.key AS smoking_habit,
  p.job_title,
  p.company_name,

  -- favorite places
  COALESCE(ARRAY(
    SELECT DISTINCT pfp.place_id
    FROM profile_favorite_places pfp
    WHERE pfp.user_id = p.id
    AND pfp.place_id IS NOT NULL
  ), '{}') AS favorite_places,

  -- languages
  COALESCE(ARRAY(
    SELECT DISTINCT l.key
    FROM profile_languages pl
    JOIN languages l ON l.id = pl.language_id
    WHERE pl.user_id = p.id
  ), '{}') AS languages,

  -- photos
  COALESCE(ARRAY(
    SELECT pp.url
    FROM profile_photos pp
    WHERE pp.user_id = p.id
    ORDER BY pp.position ASC
  ), '{}') AS photos,

  -- place_id (from CTE)
  pu.place_id

FROM pending_users pu
JOIN profiles p ON p.id = pu.user_id

LEFT JOIN gender_options go ON go.id = p.gender_id
LEFT JOIN education_levels el ON el.id = p.education_id
LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id

ORDER BY pu.created_at DESC;
$$;


ALTER FUNCTION "public"."get_pending_likes_users"("viewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_place_activity_candidates"() RETURNS TABLE("target_user_id" "uuid", "notification_type" "text", "target_place_id" "uuid", "target_place_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."get_place_activity_candidates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_places_for_nominatim_enrichment"("batch_size" integer DEFAULT 50) RETURNS TABLE("id" "text", "lat" double precision, "lng" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    p.id,
    p.lat,
    p.lng
  FROM places p
  WHERE NOT EXISTS (
    SELECT 1 
    FROM place_sources ps 
    WHERE ps.place_id = p.id 
      AND ps.provider = 'nominatim'
  )
  AND (
    p.street IS NULL 
    OR p.house_number IS NULL 
    OR p.neighborhood IS NULL 
    OR p.postal_code IS NULL
  )
  LIMIT batch_size;
$$;


ALTER FUNCTION "public"."get_places_for_nominatim_enrichment"("batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ranked_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "rank_by" "text" DEFAULT 'total'::"text", "max_results" integer DEFAULT 20, "requesting_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "neighborhood" "text", "city" "text", "state" "text", "country" "text", "total_checkins" integer, "monthly_checkins" integer, "total_matches" integer, "monthly_matches" integer, "review_average" double precision, "review_count" bigint, "review_tags" "text"[], "dist_meters" double precision, "rank_position" integer, "active_users" bigint, "preview_avatars" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  max_matches_val float;
  max_checkins_val float;
  use_monthly_data boolean;
BEGIN
  use_monthly_data := (rank_by = 'monthly');

  IF use_monthly_data THEN
    SELECT 
      GREATEST(MAX(p.monthly_matches), 1)::float,
      GREATEST(MAX(p.monthly_checkins), 1)::float
    INTO max_matches_val, max_checkins_val
    FROM places_view p
    WHERE st_dwithin(
      st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND (p.monthly_matches > 0 OR p.monthly_checkins > 0);
  ELSE
    SELECT 
      GREATEST(MAX(p.total_matches), 1)::float,
      GREATEST(MAX(p.total_checkins), 1)::float
    INTO max_matches_val, max_checkins_val
    FROM places_view p
    WHERE st_dwithin(
      st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND (p.total_matches > 0 OR p.total_checkins > 0);
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,  -- NEW
      p.city,
      p.state,
      p.country_code as country,
      p.total_checkins,
      p.monthly_checkins,
      p.total_matches,
      p.monthly_matches,
      p.review_average,
      p.review_count,
      p.review_tags,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      CASE 
        WHEN use_monthly_data THEN
          CASE
            WHEN rank_by = 'matches' THEN p.monthly_matches::float
            WHEN rank_by = 'checkins' THEN p.monthly_checkins::float
            ELSE 
              (0.6 * (p.monthly_matches::float / max_matches_val)) + 
              (0.4 * (p.monthly_checkins::float / max_checkins_val))
          END
        ELSE
          CASE
            WHEN rank_by = 'matches' THEN p.total_matches::float
            WHEN rank_by = 'checkins' THEN p.total_checkins::float
            ELSE 
              (0.6 * (p.total_matches::float / max_matches_val)) + 
              (0.4 * (p.total_checkins::float / max_checkins_val))
          END
      END as composite_score,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info
    FROM places_view p
    WHERE
      st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (
        (use_monthly_data AND (p.monthly_matches > 0 OR p.monthly_checkins > 0))
        OR (NOT use_monthly_data AND (p.total_matches > 0 OR p.total_checkins > 0))
      )
  )
  SELECT
    r.id,
    r.name,
    r.category,
    r.lat,
    r.lng,
    r.street,
    r.house_number,
    r.neighborhood,  -- NEW
    r.city,
    r.state,
    r.country,
    r.total_checkins,
    r.monthly_checkins,
    r.total_matches,
    r.monthly_matches,
    r.review_average,
    r.review_count,
    r.review_tags,
    r.dist_meters,
    DENSE_RANK() OVER (ORDER BY r.composite_score DESC, r.dist_meters ASC)::integer as rank_position,
    (r.users_info).count as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((r.users_info).avatars) a) as preview_avatars
  FROM ranked r
  ORDER BY r.composite_score DESC, r.dist_meters ASC
  LIMIT max_results;
END;
$$;


ALTER FUNCTION "public"."get_ranked_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "rank_by" "text", "max_results" integer, "requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision DEFAULT 50000, "max_results" integer DEFAULT 10, "requesting_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "neighborhood" "text", "city" "text", "state" "text", "country" "text", "review_average" double precision, "review_count" bigint, "review_tags" "text"[], "dist_meters" double precision, "active_users" bigint, "preview_avatars" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH places_with_counts AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,  -- NEW
      p.city,
      p.state,
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users_count
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  limited_places AS (
    SELECT *
    FROM places_with_counts pc
    WHERE pc.active_users_count > 0
    ORDER BY pc.active_users_count DESC, pc.dist_meters ASC
    LIMIT max_results
  ),
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.neighborhood,  -- NEW
    wr.city,
    wr.state,
    wr.country,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    wr.active_users_count as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars
  FROM with_reviews wr
  ORDER BY wr.active_users_count DESC, wr.dist_meters ASC;
END;
$$;


ALTER FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision DEFAULT 50000, "requesting_user_id" "uuid" DEFAULT NULL::"uuid", "page_offset" integer DEFAULT 0, "page_size" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "city" "text", "state" "text", "country" "text", "review_average" double precision, "review_count" bigint, "review_tags" "text"[], "dist_meters" double precision, "active_users" bigint, "preview_avatars" "jsonb", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  computed_total_count bigint;
  safe_offset int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
BEGIN
  -- First, compute total count of trending places (places with active users)
  SELECT COUNT(*) INTO computed_total_count
  FROM places p
  WHERE
    p.active = true
    AND st_dwithin(
      st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND get_eligible_active_users_count(p.id, requesting_user_id) > 0;

  -- Return paginated results with total_count
  RETURN QUERY
  -- Step 1: Get places with active users count only (fast)
  WITH places_with_counts AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.city,
      p.state,
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_eligible_active_users_count(p.id, requesting_user_id) as active_users_count
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
  ),
  -- Step 2: Filter to places with active users and paginate
  limited_places AS (
    SELECT *
    FROM places_with_counts pc
    WHERE pc.active_users_count > 0
    ORDER BY pc.active_users_count DESC, pc.dist_meters ASC
    LIMIT safe_page_size
    OFFSET safe_offset
  ),
  -- Step 3: Add reviews for limited results
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  -- Step 4: Add avatars only for final results + total_count
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.city,
    wr.state,
    wr.country,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    wr.active_users_count as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars,
    computed_total_count as total_count
  FROM with_reviews wr
  ORDER BY wr.active_users_count DESC, wr.dist_meters ASC;
END;
$$;


ALTER FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "requesting_user_id" "uuid", "page_offset" integer, "page_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "requesting_user_id" "uuid", "page_offset" integer, "page_size" integer) IS 'Returns places with active eligible users, sorted by active_users count.
Supports pagination via page_offset and page_size.
Returns total_count for UI counter display.
Optimized: Uses CTEs with LIMIT before expensive avatar calculations.';



CREATE OR REPLACE FUNCTION "public"."get_user_chats_for_sync"("p_user_id" "uuid", "p_since" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("chat_id" "uuid", "match_id" "uuid", "chat_created_at" timestamp with time zone, "last_message" "text", "last_message_iv" "text", "last_message_tag" "text", "last_message_at" timestamp with time zone, "unread_count" bigint, "other_user_id" "uuid", "other_user_name" "text", "other_user_photo_url" "text", "place_id" "uuid", "place_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH chat_data AS (
    SELECT 
      c.id as c_id,
      c.match_id as c_match_id,
      c.created_at as c_created_at,
      c.first_message_at as c_first_message_at,
      
      -- Last message details (subquery)
      (
        SELECT m.content_enc 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg,

      (
        SELECT m.content_iv 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg_iv,

      (
        SELECT m.content_tag 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg_tag,
      
      -- Last message timestamp
      (
        SELECT m.created_at 
        FROM messages m 
        WHERE m.chat_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
      ) as last_msg_at,
      
      -- Unread count
      (
        SELECT COUNT(*) 
        FROM messages m 
        WHERE m.chat_id = c.id 
          AND m.sender_id != p_user_id 
          AND m.read_at IS NULL
      )::BIGINT as unread_cnt,

      -- Join fields needed
      um.user_a,
      um.user_b,
      um.place_id as um_place_id,
      p.name as p_name,
      ua.name as ua_name,
      ub.name as ub_name

    FROM chats c
    INNER JOIN user_matches um ON c.match_id = um.id
    LEFT JOIN profiles ua ON um.user_a = ua.id
    LEFT JOIN profiles ub ON um.user_b = ub.id
    LEFT JOIN places p ON um.place_id = p.id
    WHERE 
      (um.user_a = p_user_id OR um.user_b = p_user_id)
      AND um.status = 'active'
      -- Removed filter: c.first_message_at IS NOT NULL
      -- Now returns ALL chats (with and without messages)
  )
  SELECT 
    cd.c_id,
    cd.c_match_id,
    cd.c_created_at,
    cd.last_msg,
    cd.last_msg_iv,
    cd.last_msg_tag,
    cd.last_msg_at,
    cd.unread_cnt,
    
    -- Other user details
    CASE 
      WHEN cd.user_a = p_user_id THEN cd.user_b
      ELSE cd.user_a
    END as other_user_id,
    
    CASE 
      WHEN cd.user_a = p_user_id THEN cd.ub_name
      ELSE cd.ua_name
    END as other_user_name,
    
    CASE 
      WHEN cd.user_a = p_user_id THEN (
        SELECT url FROM profile_photos WHERE user_id = cd.user_b ORDER BY position LIMIT 1
      )
      ELSE (
        SELECT url FROM profile_photos WHERE user_id = cd.user_a ORDER BY position LIMIT 1
      )
    END as other_user_photo_url,
    
    -- Place details
    cd.um_place_id,
    cd.p_name

  FROM chat_data cd
  WHERE 
    -- Filter by p_since (if provided)
    (p_since IS NULL OR cd.c_created_at >= p_since OR cd.last_msg_at >= p_since)
  ORDER BY 
    cd.last_msg_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_user_chats_for_sync"("p_user_id" "uuid", "p_since" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_chats_for_sync"("p_user_id" "uuid", "p_since" timestamp with time zone) IS 'Returns ALL chats (with and without messages). 
The frontend will filter to display only chats with messages in the UI.';



CREATE OR REPLACE FUNCTION "public"."get_user_favorite_places"("user_lat" double precision, "user_lng" double precision, "requesting_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "neighborhood" "text", "city" "text", "state" "text", "country" "text", "review_average" double precision, "review_count" bigint, "review_tags" "text"[], "dist_meters" double precision, "active_users" bigint, "preview_avatars" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH favorite_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,  -- NEW
      p.city,
      p.state,
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    INNER JOIN profile_favorite_places pfp ON pfp.place_id = p.id
    WHERE 
      pfp.user_id = requesting_user_id
      AND p.active = true
  ),
  with_reviews AS (
    SELECT
      fp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM favorite_places fp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = fp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = fp.id
    ) r ON true
  )
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.neighborhood,  -- NEW
    wr.city,
    wr.state,
    wr.country,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.dist_meters,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars
  FROM with_reviews wr
  ORDER BY wr.dist_meters ASC;
END;
$$;


ALTER FUNCTION "public"."get_user_favorite_places"("user_lat" double precision, "user_lng" double precision, "requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_like_for_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  other_place uuid;
  match_place uuid;
  match_place_name text;
  match_place_category text;
  new_match_id uuid;
BEGIN
  -- Só processa likes
  IF NEW.action <> 'like' THEN
    RETURN NEW;
  END IF;

  -- Buscar o like recíproco (do outro usuário)
  SELECT ui.place_id INTO other_place
  FROM user_interactions ui
  WHERE ui.action = 'like'
    AND ui.from_user_id = NEW.to_user_id
    AND ui.to_user_id = NEW.from_user_id
  ORDER BY ui.created_at DESC
  LIMIT 1;

  -- Se não existe like recíproco, não gera match
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determinar o place_id do match
  match_place := COALESCE(NEW.place_id, other_place);

  -- Buscar place_name e place_category da tabela places
  SELECT p.name, p.category
  INTO match_place_name, match_place_category
  FROM places p
  WHERE p.id = match_place;

  -- Criar ou atualizar o match
  INSERT INTO user_matches (user_a, user_b, status, matched_at, place_id, place_name, place_category)
  VALUES (
    LEAST(NEW.from_user_id, NEW.to_user_id),
    GREATEST(NEW.from_user_id, NEW.to_user_id),
    'active',
    NOW(),
    match_place,
    match_place_name,
    match_place_category
  )
  ON CONFLICT (user_a, user_b)
  DO UPDATE SET
    status = 'active',
    matched_at = NOW(),
    place_id = EXCLUDED.place_id,
    place_name = EXCLUDED.place_name,
    place_category = EXCLUDED.place_category
  RETURNING id INTO new_match_id;

  -- Criar ou atualizar chat (sem ambiguidade!)
  INSERT INTO chats (match_id, place_id)
  VALUES (new_match_id, match_place)
  ON CONFLICT (match_id)
  DO UPDATE SET
    place_id = EXCLUDED.place_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_like_for_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  SELECT public.unaccent($1)
$_$;


ALTER FUNCTION "public"."immutable_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_osm_places"("temp_table_name" "text", "max_safe_distance_m" integer DEFAULT 50) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  sql text;
BEGIN
  /*
    1) LOGAR UPDATES SUSPEITOS
    (external_id existe, mas ponto se moveu demais)
  */
  sql := format($f$
    INSERT INTO public.osm_suspicious_updates (
      place_id,
      external_id,
      old_lat,
      old_lng,
      new_lat,
      new_lng,
      distance_meters,
      osm_version,
      raw
    )
    SELECT
      p.id,
      i.external_id,
      p.lat, p.lng,
      i.lat, i.lng,
      ST_Distance(
        ST_MakePoint(p.lng, p.lat)::geography,
        ST_MakePoint(i.lng, i.lat)::geography
      ),
      i.osm_version,
      i.raw
    FROM %I i
    JOIN public.place_sources ps
      ON ps.provider = 'osm'
     AND ps.external_id = i.external_id
    JOIN public.places p
      ON p.id = ps.place_id
    WHERE NOT ST_DWithin(
      ST_MakePoint(p.lng, p.lat)::geography,
      ST_MakePoint(i.lng, i.lat)::geography,
      %s
    );
  $f$, temp_table_name, max_safe_distance_m);
  EXECUTE sql;

  /*
    2) UPDATE DE PLACES EXISTENTES (external_id conhecido + deslocamento OK)
    - Nunca sobrescreve enrichment (COALESCE)
  */
  sql := format($f$
    UPDATE public.places p
    SET
      name             = i.name,
      lat              = i.lat,
      lng              = i.lng,
      street           = COALESCE(p.street, i.street),
      house_number     = COALESCE(p.house_number, i.house_number),
      neighborhood     = COALESCE(p.neighborhood, i.neighborhood),
      city             = COALESCE(p.city, i.city),
      state            = COALESCE(p.state, i.state),
      postal_code      = COALESCE(p.postal_code, i.postal_code),
      country_code     = COALESCE(p.country_code, i.country_code),
      osm_version      = i.osm_version,
      last_osm_edit_at = now(),
      updated_at       = now()
    FROM %I i
    JOIN public.place_sources ps
      ON ps.provider = 'osm'
     AND ps.external_id = i.external_id
    WHERE p.id = ps.place_id
      AND ST_DWithin(
        ST_MakePoint(p.lng, p.lat)::geography,
        ST_MakePoint(i.lng, i.lat)::geography,
        %s
      );
  $f$, temp_table_name, max_safe_distance_m);
  EXECUTE sql;

  /*
    3) INSERIR NOVOS PLACES (external_id ainda não existe)
  */
  sql := format($f$
    INSERT INTO public.places (
      name,
      category,
      lat,
      lng,
      street,
      house_number,
      neighborhood,
      city,
      state,
      postal_code,
      country_code,
      osm_version,
      last_osm_edit_at,
      created_at,
      updated_at
    )
    SELECT
      i.name,
      i.category,
      i.lat,
      i.lng,
      i.street,
      i.house_number,
      i.neighborhood,
      i.city,
      i.state,
      i.postal_code,
      i.country_code,
      i.osm_version,
      now(),
      now(),
      now()
    FROM %I i
    LEFT JOIN public.place_sources ps
      ON ps.provider = 'osm'
     AND ps.external_id = i.external_id
    WHERE ps.external_id IS NULL;
  $f$, temp_table_name);
  EXECUTE sql;

  /*
    4) INSERIR place_sources PARA NOVOS PLACES
  */
  sql := format($f$
    INSERT INTO public.place_sources (
      place_id,
      provider,
      external_id,
      raw
    )
    SELECT
      p.id,
      'osm',
      i.external_id,
      i.raw
    FROM %I i
    JOIN public.places p
      ON p.name = i.name
     AND p.lat = i.lat
     AND p.lng = i.lng
    LEFT JOIN public.place_sources ps
      ON ps.provider = 'osm'
     AND ps.external_id = i.external_id
    WHERE ps.external_id IS NULL
    ON CONFLICT (provider, external_id)
    DO NOTHING;
  $f$, temp_table_name);
  EXECUTE sql;

END;
$_$;


ALTER FUNCTION "public"."import_osm_places"("temp_table_name" "text", "max_safe_distance_m" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "max_safe_distance_m" integer DEFAULT 50) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  sql text;
BEGIN

  /* 1) LOGAR UPDATES SUSPEITOS
     external_id existe, mas deslocamento > limite
  */
  sql := format($f$
    INSERT INTO public.osm_suspicious_updates (
      place_id,
      external_id,
      old_lat,
      old_lng,
      new_lat,
      new_lng,
      distance_meters,
      raw
    )
    SELECT
      p.id,
      i.external_id,
      p.lat,
      p.lng,
      i.lat,
      i.lng,
      ST_Distance(
        ST_MakePoint(p.lng, p.lat)::geography,
        ST_MakePoint(i.lng, i.lat)::geography
      ),
      i.raw
    FROM %I i
    JOIN public.place_sources ps
      ON ps.provider = 'osm'
      AND ps.external_id = i.external_id
    JOIN public.places p
      ON p.id = ps.place_id
    WHERE NOT ST_DWithin(
      ST_MakePoint(p.lng, p.lat)::geography,
      ST_MakePoint(i.lng, i.lat)::geography,
      %s
    );
  $f$, temp_table_name, max_safe_distance_m);
  EXECUTE sql;

  /* 2) UPDATE DE PLACES EXISTENTES
     (external_id conhecido + deslocamento aceitável)
     Nunca sobrescreve enrichment
  */
  sql := format($f$
    UPDATE public.places p
    SET
      name = i.name,
      category = i.category,
      lat = i.lat,
      lng = i.lng,
      street = COALESCE(p.street, i.street),
      house_number = COALESCE(p.house_number, i.house_number),
      neighborhood = COALESCE(p.neighborhood, i.neighborhood),
      postal_code = COALESCE(p.postal_code, i.postal_code),
      city = COALESCE(p.city, i.city),
      state = COALESCE(p.state, i.state),
      country_code = COALESCE(p.country_code, i.country_code),
      structural_score = (
        CASE WHEN i.name IS NOT NULL AND length(trim(i.name)) > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(p.street, i.street) IS NOT NULL AND length(trim(COALESCE(p.street, i.street))) > 0 THEN 2 ELSE 0 END
        + CASE WHEN COALESCE(p.house_number, i.house_number) IS NOT NULL AND length(trim(COALESCE(p.house_number, i.house_number))) > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(p.neighborhood, i.neighborhood) IS NOT NULL AND length(trim(COALESCE(p.neighborhood, i.neighborhood))) > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(p.postal_code, i.postal_code) IS NOT NULL AND length(trim(COALESCE(p.postal_code, i.postal_code))) > 0 THEN 1 ELSE 0 END
      ),
      last_osm_edit_at = now(),
      updated_at = now(),
      active = true -- Reativar caso tenha voltado
    FROM %I i
    JOIN public.place_sources ps
      ON ps.provider = 'osm'
      AND ps.external_id = i.external_id
    WHERE p.id = ps.place_id
      AND ST_DWithin(
        ST_MakePoint(p.lng, p.lat)::geography,
        ST_MakePoint(i.lng, i.lat)::geography,
        %s
      );
  $f$,
  temp_table_name,
  max_safe_distance_m
  );
  EXECUTE sql;

  /* 3) INSERIR NOVOS PLACES
     (external_id ainda não existe)
  */
  sql := format($f$
    INSERT INTO public.places (
      name,
      category,
      lat,
      lng,
      street,
      house_number,
      neighborhood,
      postal_code,
      city,
      state,
      country_code,
      structural_score,
      last_osm_edit_at,
      created_at,
      updated_at
    )
    SELECT
      i.name,
      i.category,
      i.lat,
      i.lng,
      i.street,
      i.house_number,
      i.neighborhood,
      i.postal_code,
      i.city,
      i.state,
      i.country_code,
      (
        CASE WHEN i.name IS NOT NULL AND length(trim(i.name)) > 0 THEN 1 ELSE 0 END
        + CASE WHEN i.street IS NOT NULL AND length(trim(i.street)) > 0 THEN 2 ELSE 0 END
        + CASE WHEN i.house_number IS NOT NULL AND length(trim(i.house_number)) > 0 THEN 1 ELSE 0 END
        + CASE WHEN i.neighborhood IS NOT NULL AND length(trim(i.neighborhood)) > 0 THEN 1 ELSE 0 END
        + CASE WHEN i.postal_code IS NOT NULL AND length(trim(i.postal_code)) > 0 THEN 1 ELSE 0 END
      ),
      now(),
      now(),
      now()
    FROM %I i
    LEFT JOIN public.place_sources ps
      ON ps.provider = 'osm'
      AND ps.external_id = i.external_id
    WHERE ps.external_id IS NULL;
  $f$,
  temp_table_name
  );
  EXECUTE sql;

  /* 4) CRIAR place_sources PARA NOVOS PLACES
  */
  sql := format($f$
    INSERT INTO public.place_sources (
      place_id,
      provider,
      external_id,
      raw
    )
    SELECT
      p.id,
      'osm',
      i.external_id,
      i.raw
    FROM %I i
    JOIN public.places p
      ON p.lat = i.lat
      AND p.lng = i.lng
      AND p.name = i.name
    LEFT JOIN public.place_sources ps
      ON ps.provider = 'osm'
      AND ps.external_id = i.external_id
    WHERE ps.external_id IS NULL
    ON CONFLICT (provider, place_id)
    DO NOTHING;
  $f$, temp_table_name);
  EXECUTE sql;

  /* 5) SOFT DELETE DE PLACES QUE SUMIRAM DO OSM (NA CIDADE IMPORTADA)
     Se o place é da cidade que estamos importando (verificado via temp table)
     e não está na temp table, marca como inativo.
  */
  sql := format($f$
    WITH imported_cities AS (
        SELECT DISTINCT city FROM %I WHERE city IS NOT NULL
    )
    UPDATE public.places p
    SET active = false,
        updated_at = now()
    FROM public.place_sources ps
    WHERE p.id = ps.place_id
      AND ps.provider = 'osm'
      AND p.city IN (SELECT city FROM imported_cities)
      AND ps.external_id NOT IN (SELECT external_id FROM %I)
      AND p.active = true; -- Só desativar se estiver ativo
  $f$, temp_table_name, temp_table_name);
  EXECUTE sql;

END;

$_$;


ALTER FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "max_safe_distance_m" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "city_param" "text", "state_param" "text", "country_code_param" "text", "max_safe_distance_m" integer DEFAULT 50) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
sql text;
BEGIN

/* 1) LOGAR UPDATES SUSPEITOS
external_id existe, mas deslocamento > limite
*/
sql := format($f$
INSERT INTO public.osm_suspicious_updates (
place_id,
external_id,
old_lat,
old_lng,
new_lat,
new_lng,
distance_meters,
raw
)
SELECT
p.id,
i.external_id,
p.lat,
p.lng,
i.lat,
i.lng,
ST_Distance(
ST_MakePoint(p.lng, p.lat)::geography,
ST_MakePoint(i.lng, i.lat)::geography
),
i.raw
FROM %I i
JOIN public.place_sources ps
ON ps.provider = 'osm'
AND ps.external_id = i.external_id
JOIN public.places p
ON p.id = ps.place_id
WHERE NOT ST_DWithin(
ST_MakePoint(p.lng, p.lat)::geography,
ST_MakePoint(i.lng, i.lat)::geography,
%s
);
$f$, temp_table_name, max_safe_distance_m);
EXECUTE sql;

/* 2) UPDATE DE PLACES EXISTENTES
(external_id conhecido + deslocamento aceitável)
Nunca sobrescreve enrichment
*/
sql := format($f$
UPDATE public.places p
SET
name = i.name,
category = COALESCE(p.category, i.category),
lat = i.lat,
lng = i.lng,
street = COALESCE(p.street, i.street),
house_number = COALESCE(p.house_number, i.house_number),
neighborhood = COALESCE(p.neighborhood, i.neighborhood),
postal_code = COALESCE(p.postal_code, i.postal_code),
city = COALESCE(p.city, %L),
state = COALESCE(p.state, %L),
country_code = COALESCE(p.country_code, %L),
structural_score = (
CASE WHEN i.name IS NOT NULL AND length(trim(i.name)) > 0 THEN 1 ELSE 0 END
+ CASE WHEN COALESCE(p.street, i.street) IS NOT NULL AND length(trim(COALESCE(p.street, i.street))) > 0 THEN 2 ELSE 0 END
+ CASE WHEN COALESCE(p.house_number, i.house_number) IS NOT NULL AND length(trim(COALESCE(p.house_number, i.house_number))) > 0 THEN 1 ELSE 0 END
+ CASE WHEN COALESCE(p.neighborhood, i.neighborhood) IS NOT NULL AND length(trim(COALESCE(p.neighborhood, i.neighborhood))) > 0 THEN 1 ELSE 0 END
+ CASE WHEN COALESCE(p.postal_code, i.postal_code) IS NOT NULL AND length(trim(COALESCE(p.postal_code, i.postal_code))) > 0 THEN 1 ELSE 0 END
),
last_osm_edit_at = now(),
updated_at = now()
FROM %I i
JOIN public.place_sources ps
ON ps.provider = 'osm'
AND ps.external_id = i.external_id
WHERE p.id = ps.place_id
AND ST_DWithin(
ST_MakePoint(p.lng, p.lat)::geography,
ST_MakePoint(i.lng, i.lat)::geography,
%s
);
$f$,
city_param,
state_param,
country_code_param,
temp_table_name,
max_safe_distance_m
);
EXECUTE sql;

/* 3) INSERIR NOVOS PLACES
(external_id ainda não existe)
*/
sql := format($f$
INSERT INTO public.places (
name,
category,
lat,
lng,
street,
house_number,
neighborhood,
postal_code,
city,
state,
country_code,
structural_score,
last_osm_edit_at,
created_at,
updated_at
)
SELECT
i.name,
i.category,
i.lat,
i.lng,
i.street,
i.house_number,
i.neighborhood,
i.postal_code,
%L,
%L,
%L,
(
  CASE WHEN i.name IS NOT NULL AND length(trim(i.name)) > 0 THEN 1 ELSE 0 END
  + CASE WHEN i.street IS NOT NULL AND length(trim(i.street)) > 0 THEN 2 ELSE 0 END
  + CASE WHEN i.house_number IS NOT NULL AND length(trim(i.house_number)) > 0 THEN 1 ELSE 0 END
  + CASE WHEN i.neighborhood IS NOT NULL AND length(trim(i.neighborhood)) > 0 THEN 1 ELSE 0 END
  + CASE WHEN i.postal_code IS NOT NULL AND length(trim(i.postal_code)) > 0 THEN 1 ELSE 0 END
),
now(),
now(),
now()
FROM %I i
LEFT JOIN public.place_sources ps
ON ps.provider = 'osm'
AND ps.external_id = i.external_id
WHERE ps.external_id IS NULL;
$f$,
city_param,
state_param,
country_code_param,
temp_table_name
);
EXECUTE sql;

/* 4) CRIAR place_sources PARA NOVOS PLACES
*/
sql := format($f$
INSERT INTO public.place_sources (
place_id,
provider,
external_id,
raw
)
SELECT
p.id,
'osm',
i.external_id,
i.raw
FROM %I i
JOIN public.places p
ON p.lat = i.lat
AND p.lng = i.lng
AND p.name = i.name
LEFT JOIN public.place_sources ps
ON ps.provider = 'osm'
AND ps.external_id = i.external_id
WHERE ps.external_id IS NULL
ON CONFLICT (provider, external_id)
DO NOTHING;
$f$, temp_table_name);
EXECUTE sql;

END;

$_$;


ALTER FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "city_param" "text", "state_param" "text", "country_code_param" "text", "max_safe_distance_m" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_overture_places"("temp_table_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  sql text;
BEGIN
  -- 1. LIMPEZA DE SEGURANÇA: Remove restos de colunas temporárias se existirem
  ALTER TABLE public.places DROP COLUMN IF EXISTS _temp_overture_id;

  -- 2. UPDATE: Atualiza lugares que já estão vinculados ao Overture
  sql := format($f$
    UPDATE public.places p
    SET 
      name = i.name,
      relevance_score = i.relevance_score,
      confidence = i.confidence,
      socials = i.socials,
      updated_at = now()
    FROM %I i
    JOIN public.place_sources ps ON ps.external_id = i.external_id
    WHERE ps.provider = 'overture' AND ps.place_id = p.id;
  $f$, temp_table_name);
  EXECUTE sql;

  -- 3. INSERT: Cria novos lugares e vincula (Lógica Robusta)
  -- Adiciona coluna temporária apenas para o processo de link
  ALTER TABLE public.places ADD COLUMN _temp_overture_id text;

  sql := format($f$
    -- Insere apenas se o external_id NÃO existe em place_sources
    INSERT INTO public.places (
      name, category, lat, lng, street, house_number, neighborhood, 
      postal_code, city, state, country_code, relevance_score, confidence, socials, _temp_overture_id
    )
    SELECT 
      i.name, i.category, i.lat, i.lng, i.street, i.house_number, i.neighborhood, 
      i.postal_code, i.city, i.state, i.country_code, i.relevance_score, i.confidence, i.socials, i.external_id
    FROM %I i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.place_sources ps 
      WHERE ps.provider = 'overture' AND ps.external_id = i.external_id
    );

    -- Cria o vínculo na place_sources
    INSERT INTO public.place_sources (place_id, provider, external_id, raw)
    SELECT p.id, 'overture', p._temp_overture_id, i.raw
    FROM public.places p
    JOIN %I i ON i.external_id = p._temp_overture_id
    WHERE p._temp_overture_id IS NOT NULL
    ON CONFLICT (place_id, provider) DO NOTHING;
  $f$, temp_table_name, temp_table_name);
  
  EXECUTE sql;

  -- 4. FINALIZAÇÃO: Remove a coluna temporária
  ALTER TABLE public.places DROP COLUMN _temp_overture_id;

END;
$_$;


ALTER FUNCTION "public"."import_overture_places"("temp_table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_place_checkins"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE places 
  SET 
    total_checkins = COALESCE(total_checkins, 0) + 1,
    monthly_checkins = COALESCE(monthly_checkins, 0) + 1,
    last_activity_at = now()
  WHERE id = NEW.place_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_place_checkins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_staging_to_production"("p_city_id" "uuid", "p_bbox" double precision[], "is_final_batch" boolean DEFAULT false) RETURNS TABLE("exact_updated" bigint, "exact_inserted" bigint, "duplicate_links" bigint, "soft_deleted" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exact_updated bigint := 0;
  v_exact_inserted bigint := 0;
  v_duplicate_links bigint := 0;
  v_soft_deleted bigint := 0;
  execution_start timestamptz := NOW();
BEGIN
  -- ====================================================================
  -- STEP 1: UPDATE existing places via exact overture_id match
  -- ====================================================================
  WITH updated AS (
    UPDATE places p
    SET
      name = s.name,
      category = s.category,
      lat = ST_Y(staging_wkb_to_geom(s.geom_wkb_hex)),
      lng = ST_X(staging_wkb_to_geom(s.geom_wkb_hex)),
      street = s.street,
      house_number = s.house_number,
      neighborhood = s.neighborhood,
      city = s.city,
      state = s.state,
      postal_code = s.postal_code,
      country_code = s.country_code,
      relevance_score = s.relevance_score,
      confidence = s.confidence,
      original_category = s.original_category,
      boundary = CASE 
        WHEN s.boundary_wkb_hex IS NOT NULL AND s.boundary_wkb_hex != '' 
        THEN ST_MakeValid(ST_Simplify(ST_GeomFromWKB(decode(s.boundary_wkb_hex, 'hex'), 4326), 0.00001))
        ELSE NULL 
      END,
      active = true,
      updated_at = execution_start  -- Mark as touched in this execution
    FROM staging_places s
    JOIN place_sources ps ON (
      ps.external_id = s.overture_id
      AND ps.provider = 'overture'
    )
    WHERE p.id = ps.place_id
    RETURNING p.id
  )
  SELECT count(*) INTO v_exact_updated FROM updated;

  -- ====================================================================
  -- STEP 2: INSERT new places (no match in place_sources)
  -- ====================================================================
  WITH new_places AS (
    SELECT
      s.name,
      s.category,
      ST_Y(staging_wkb_to_geom(s.geom_wkb_hex)) as lat,
      ST_X(staging_wkb_to_geom(s.geom_wkb_hex)) as lng,
      s.street,
      s.house_number,
      s.neighborhood,
      s.city,
      s.state,
      s.postal_code,
      s.country_code,
      s.relevance_score,
      s.confidence,
      s.original_category,
      s.overture_id,
      s.geom_wkb_hex,
      CASE 
        WHEN s.boundary_wkb_hex IS NOT NULL AND s.boundary_wkb_hex != '' 
        THEN ST_MakeValid(ST_Simplify(ST_GeomFromWKB(decode(s.boundary_wkb_hex, 'hex'), 4326), 0.00001))
        ELSE NULL 
      END as boundary
    FROM staging_places s
    WHERE NOT EXISTS (
      SELECT 1 FROM place_sources ps
      WHERE ps.external_id = s.overture_id
      AND ps.provider = 'overture'
    )
  ),
  inserted AS (
    INSERT INTO places (
      name, category, lat, lng, street, house_number, neighborhood,
      city, state, postal_code, country_code, relevance_score,
      confidence, original_category, boundary, active, created_at, updated_at
    )
    SELECT
      name, category, lat, lng, street, house_number, neighborhood,
      city, state, postal_code, country_code, relevance_score,
      confidence, original_category, boundary, true, execution_start, execution_start
    FROM new_places
    RETURNING id, lat, lng
  )
  INSERT INTO place_sources (place_id, provider, external_id, raw)
  SELECT 
    i.id, 
    'overture', 
    np.overture_id, 
    NULL
  FROM inserted i
  JOIN new_places np ON (
    abs(i.lat - np.lat) < 0.0000001 
    AND abs(i.lng - np.lng) < 0.0000001
  )
  ON CONFLICT (provider, external_id) DO NOTHING;

  GET DIAGNOSTICS v_exact_inserted = ROW_COUNT;

  -- ====================================================================
  -- STEP 3: Soft delete (Final batch only)
  -- FIX: Timestamp marking + bbox prevents deactivating previous batches
  -- ====================================================================
  IF is_final_batch THEN
    WITH deactivated AS (
      UPDATE places p
      SET active = false, updated_at = execution_start
      WHERE p.active = true
        -- Only Overture POIs
        AND EXISTS (
          SELECT 1 FROM place_sources ps
          WHERE ps.place_id = p.id
          AND ps.provider = 'overture'
        )
        -- NOT touched in this execution (all batches)
        AND p.updated_at < execution_start - INTERVAL '1 hour'
        -- Within city bbox (spatial filter)
        AND p.lng >= p_bbox[1] AND p.lng <= p_bbox[3]
        AND p.lat >= p_bbox[2] AND p.lat <= p_bbox[4]
      RETURNING p.id
    )
    SELECT count(*) INTO v_soft_deleted FROM deactivated;
  END IF;

  RETURN QUERY SELECT v_exact_updated, v_exact_inserted, v_duplicate_links, v_soft_deleted;
END;
$$;


ALTER FUNCTION "public"."merge_staging_to_production"("p_city_id" "uuid", "p_bbox" double precision[], "is_final_batch" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_monthly_checkins"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE places SET monthly_checkins = 0;
END;
$$;


ALTER FUNCTION "public"."reset_monthly_checkins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_monthly_matches"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE places SET monthly_matches = 0;
END;
$$;


ALTER FUNCTION "public"."reset_monthly_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[] DEFAULT ARRAY[]::"text"[], "p_photo_positions" integer[] DEFAULT ARRAY[]::integer[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[] DEFAULT ARRAY[]::"text"[], "p_photo_positions" integer[] DEFAULT ARRAY[]::integer[], "p_favorite_place_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[], "p_bio" "text" DEFAULT NULL::"text", "p_university_id" "uuid" DEFAULT NULL::"uuid", "p_university_name_custom" "text" DEFAULT NULL::"text", "p_graduation_year" integer DEFAULT NULL::integer, "p_show_university_on_home" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Upsert profile (university_id is FK to places, so name/lat/lng come from there)
  insert into public.profiles as p (
    id, name, birthdate, gender_id, age_range_min, age_range_max, bio,
    university_id, university_name_custom, graduation_year, show_university_on_home,
    updated_at
  )
  values (
    p_user_id, p_name, p_birthdate, p_gender_id, 18, 35, p_bio,
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
        age_range_max = coalesce(p.age_range_max, 35),
        -- University fields: only update if provided (not null)
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
end;
$$;


ALTER FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[], "p_favorite_place_ids" "uuid"[], "p_bio" "text", "p_university_id" "uuid", "p_university_name_custom" "text", "p_graduation_year" integer, "p_show_university_on_home" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_places_autocomplete"("query_text" "text", "user_lat" double precision DEFAULT NULL::double precision, "user_lng" double precision DEFAULT NULL::double precision, "radius_meters" double precision DEFAULT 50000, "max_results" integer DEFAULT 10, "requesting_user_id" "uuid" DEFAULT NULL::"uuid", "filter_categories" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "neighborhood" "text", "city" "text", "state" "text", "country" "text", "active_users" integer, "preview_avatars" "jsonb", "dist_meters" double precision, "relevance_score" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  normalized_query text;
BEGIN
  normalized_query := immutable_unaccent(query_text);
  
  RETURN QUERY
  WITH matched_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,  -- NEW
      p.city,
      p.state,
      p.country_code as country,
      get_eligible_active_users_count(p.id, requesting_user_id)::integer as active_users,
      NULL::jsonb as preview_avatars,
      CASE
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
          st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          )
        ELSE NULL
      END AS dist_meters,
      (1.0 - (normalized_query <<-> immutable_unaccent(p.name))) * 100.0 as relevance_score
    FROM places p
    WHERE 
      p.active = true
      AND normalized_query <% immutable_unaccent(p.name)
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
      AND (
        user_lat IS NULL 
        OR user_lng IS NULL 
        OR st_dwithin(
          st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
          st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
          radius_meters
        )
      )
  )
  SELECT * FROM matched_places mp
  ORDER BY 
    mp.relevance_score DESC,
    mp.active_users DESC
  LIMIT max_results;
END;
$$;


ALTER FUNCTION "public"."search_places_autocomplete"("query_text" "text", "user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid", "filter_categories" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[] DEFAULT NULL::"text"[], "max_results" integer DEFAULT 50, "requesting_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "neighborhood" "text", "city" "text", "state" "text", "country" "text", "total_score" integer, "active_users" bigint, "preview_avatars" "jsonb", "favorites_count" bigint, "dist_meters" double precision, "review_average" double precision, "review_count" bigint, "review_tags" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH limited_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,  -- NEW
      p.city,
      p.state,
      p.country_code as country,
      p.total_score,
      (
        SELECT count(*)
        FROM profile_favorite_places f
        WHERE f.place_id = p.id
          AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id)
      ) AS favorites_count,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    WHERE 
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) AS c))
      AND EXISTS (
        SELECT 1 FROM profile_favorite_places f 
        WHERE f.place_id = p.id 
          AND (requesting_user_id IS NULL OR f.user_id != requesting_user_id)
      )
    ORDER BY favorites_count DESC, dist_meters ASC
    LIMIT max_results
  ),
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.neighborhood,  -- NEW
    wr.city,
    wr.state,
    wr.country,
    wr.total_score,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars,
    wr.favorites_count,
    wr.dist_meters,
    wr.review_average,
    wr.review_count,
    wr.review_tags
  FROM with_reviews wr
  ORDER BY wr.favorites_count DESC, wr.dist_meters ASC;
END;
$$;


ALTER FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision DEFAULT 5000, "place_category" "text" DEFAULT NULL::"text", "max_results" integer DEFAULT 20, "requesting_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "city" "text", "state" "text", "country" "text", "active_users" integer, "preview_avatars" "text"[], "dist_meters" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH places_with_favorites AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.city,
      p.state,
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info,
      COALESCE((
        SELECT COUNT(*)
        FROM user_favorite_places ufp
        WHERE ufp.place_id = p.id
      ), 0) as favorite_count
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (place_category IS NULL OR p.category = place_category)
  )
  SELECT 
    pf.id,
    pf.name,
    pf.category,
    pf.lat,
    pf.lng,
    pf.street,
    pf.house_number,
    pf.city,
    pf.state,
    pf.country,
    (pf.users_info).count::integer as active_users,
    (pf.users_info).avatars as preview_avatars,
    pf.dist_meters
  FROM places_with_favorites pf
  ORDER BY pf.favorite_count DESC, pf.dist_meters ASC
  LIMIT max_results;
END;
$$;


ALTER FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision DEFAULT 5000, "place_category" "text" DEFAULT NULL::"text", "max_results" integer DEFAULT 20, "requesting_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "city" "text", "state" "text", "country" "text", "active_users" integer, "preview_avatars" "text"[], "dist_meters" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH nearby_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.city,
      p.state,
      p.country_code as country,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      get_active_users_with_avatars(p.id, requesting_user_id, 3) as users_info
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (place_category IS NULL OR p.category = place_category)
  )
  SELECT 
    np.id,
    np.name,
    np.category,
    np.lat,
    np.lng,
    np.street,
    np.house_number,
    np.city,
    np.state,
    np.country,
    (np.users_info).count::integer as active_users,
    (np.users_info).avatars as preview_avatars,
    np.dist_meters
  FROM nearby_places np
  ORDER BY np.dist_meters ASC
  LIMIT max_results;
END;
$$;


ALTER FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[] DEFAULT NULL::"text"[], "max_results" integer DEFAULT 60, "requesting_user_id" "uuid" DEFAULT NULL::"uuid", "sort_by" "text" DEFAULT 'relevance'::"text", "min_rating" double precision DEFAULT NULL::double precision, "page_offset" integer DEFAULT 0, "page_size" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "lat" double precision, "lng" double precision, "street" "text", "house_number" "text", "neighborhood" "text", "city" "text", "state" "text", "country" "text", "relevance_score" integer, "confidence" double precision, "socials" "jsonb", "review_average" double precision, "review_count" bigint, "review_tags" "text"[], "total_checkins" integer, "last_activity_at" timestamp with time zone, "active_users" bigint, "preview_avatars" "jsonb", "dist_meters" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  safe_offset int := GREATEST(page_offset, 0);
  safe_page_size int := GREATEST(page_size, 1);
  max_limit int := GREATEST(max_results, 0);
  remaining int := max_limit - safe_offset;
  limit_amount int := LEAST(safe_page_size, GREATEST(remaining, 0));
BEGIN
  RETURN QUERY
  WITH limited_places AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.street,
      p.house_number,
      p.neighborhood,  -- NEW
      p.city,
      p.state,
      p.country_code as country,
      p.relevance_score,
      p.confidence,
      p.socials,
      p.total_checkins,
      p.last_activity_at,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters
    FROM places p
    WHERE
      p.active = true
      AND st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      AND (filter_categories IS NULL OR lower(p.category) = ANY(SELECT lower(c) FROM unnest(filter_categories) c))
    ORDER BY
      CASE WHEN sort_by = 'distance' THEN st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) END ASC,
      CASE WHEN sort_by = 'popularity' THEN p.total_checkins END DESC,
      CASE WHEN sort_by = 'popularity' THEN p.last_activity_at END DESC,
      CASE WHEN sort_by = 'relevance' THEN p.relevance_score END DESC,
      CASE WHEN sort_by = 'relevance' THEN p.confidence END DESC,
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) ASC
    LIMIT limit_amount
    OFFSET safe_offset
  ),
  with_reviews AS (
    SELECT
      lp.*,
      COALESCE(r.avg_stars, 0)::double precision as review_average,
      COALESCE(r.review_count, 0)::bigint as review_count,
      COALESCE(r.top_tags, ARRAY[]::text[]) as review_tags
    FROM limited_places lp
    LEFT JOIN LATERAL (
      SELECT
        AVG(psr.stars)::double precision as avg_stars,
        COUNT(*)::bigint as review_count,
        ARRAY(
          SELECT t.key
          FROM place_review_tag_relations prtr
          JOIN place_review_tags t ON t.id = prtr.tag_id
          JOIN place_social_reviews psr2 ON psr2.id = prtr.review_id
          WHERE psr2.place_id = lp.id
          GROUP BY t.key
          ORDER BY COUNT(*) DESC
          LIMIT 3
        ) as top_tags
      FROM place_social_reviews psr
      WHERE psr.place_id = lp.id
    ) r ON true
  )
  SELECT
    wr.id,
    wr.name,
    wr.category,
    wr.lat,
    wr.lng,
    wr.street,
    wr.house_number,
    wr.neighborhood,  -- NEW
    wr.city,
    wr.state,
    wr.country,
    wr.relevance_score,
    wr.confidence,
    wr.socials,
    wr.review_average,
    wr.review_count,
    wr.review_tags,
    wr.total_checkins,
    wr.last_activity_at,
    get_eligible_active_users_count(wr.id, requesting_user_id) as active_users,
    (SELECT jsonb_agg(jsonb_build_object('user_id', (a).user_id, 'url', (a).url)) 
     FROM unnest((get_active_users_with_avatars(wr.id, requesting_user_id, 5)).avatars) a) as preview_avatars,
    wr.dist_meters
  FROM with_reviews wr;
END;
$$;


ALTER FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid", "sort_by" "text", "min_rating" double precision, "page_offset" integer, "page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_first_message_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Atualiza first_message_at apenas se ainda for NULL
  UPDATE chats
  SET first_message_at = COALESCE(first_message_at, NEW.created_at)
  WHERE id = NEW.chat_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_first_message_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staging_wkb_to_geom"("wkb_hex" "text") RETURNS "public"."geometry"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN ST_SetSRID(ST_GeomFromWKB(decode(wkb_hex, 'hex')), 4326);
END;
$$;


ALTER FUNCTION "public"."staging_wkb_to_geom"("wkb_hex" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."staging_wkb_to_geom"("wkb_hex" "text") IS 'Convert WKB hex string to PostGIS geometry with SRID 4326';



CREATE OR REPLACE FUNCTION "public"."trigger_handle_match_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  begin
    perform net.http_post(
      url := 'https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/handle-match-created',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0em5xY3dwdGhuYmxsZ3h4eG9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYzNDMyNywiZXhwIjoyMDc4MjEwMzI3fQ.V1ffl8ZeTgMYVuWZC0XTNNkgS4ghHEqjArAGt8S8nAs'
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


ALTER FUNCTION "public"."trigger_handle_match_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_handle_message_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  begin
    perform net.http_post(
      url := 'https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/handle-message-created',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0em5xY3dwdGhuYmxsZ3h4eG9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYzNDMyNywiZXhwIjoyMDc4MjEwMzI3fQ.V1ffl8ZeTgMYVuWZC0XTNNkgS4ghHEqjArAGt8S8nAs' 
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


ALTER FUNCTION "public"."trigger_handle_message_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_place_from_nominatim"("place_id_param" "uuid", "street_param" "text", "house_number_param" "text", "neighborhood_param" "text", "postal_code_param" "text") RETURNS "void"
    LANGUAGE "sql"
    AS $$
UPDATE public.places
SET
  street        = COALESCE(street, street_param),
  house_number  = COALESCE(house_number, house_number_param),
  neighborhood  = COALESCE(neighborhood, neighborhood_param),
  postal_code   = COALESCE(postal_code, postal_code_param),

  structural_score =
  (
    CASE WHEN name IS NOT NULL AND length(trim(name)) > 0 THEN 1 ELSE 0 END
  + CASE WHEN COALESCE(street, street_param) IS NOT NULL AND length(trim(COALESCE(street, street_param))) > 0 THEN 2 ELSE 0 END
  + CASE WHEN COALESCE(house_number, house_number_param) IS NOT NULL AND length(trim(COALESCE(house_number, house_number_param))) > 0 THEN 1 ELSE 0 END
  + CASE WHEN COALESCE(neighborhood, neighborhood_param) IS NOT NULL AND length(trim(COALESCE(neighborhood, neighborhood_param))) > 0 THEN 1 ELSE 0 END
  + CASE WHEN COALESCE(postal_code, postal_code_param) IS NOT NULL AND length(trim(COALESCE(postal_code, postal_code_param))) > 0 THEN 1 ELSE 0 END
  ),

  updated_at = now()
WHERE id = place_id_param;
$$;


ALTER FUNCTION "public"."update_place_from_nominatim"("place_id_param" "uuid", "street_param" "text", "house_number_param" "text", "neighborhood_param" "text", "postal_code_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_place_match_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update match counts for the place
  IF TG_OP = 'INSERT' AND NEW.place_id IS NOT NULL THEN
    UPDATE places 
    SET 
      total_matches = total_matches + 1,
      monthly_matches = monthly_matches + 1
    WHERE id = NEW.place_id;
  ELSIF TG_OP = 'DELETE' AND OLD.place_id IS NOT NULL THEN
    UPDATE places 
    SET 
      total_matches = GREATEST(0, total_matches - 1),
      monthly_matches = GREATEST(0, monthly_matches - 1)
    WHERE id = OLD.place_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_place_match_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."intention_options" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL,
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."intention_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_intentions" (
    "user_id" "uuid" NOT NULL,
    "option_id" integer NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."profile_intentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_photos" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "url" "text" NOT NULL,
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gender_id" integer,
    "birthdate" "date",
    "age_range_min" integer DEFAULT 18,
    "age_range_max" integer DEFAULT 35,
    "bio" "text",
    "city_name" "text",
    "city_state" "text",
    "city_country" "text",
    "city_lat" double precision,
    "city_lng" double precision,
    "education_id" integer,
    "zodiac_id" integer,
    "smoking_id" integer,
    "relationship_id" integer,
    "height_cm" integer,
    "job_title" "text",
    "company_name" "text",
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "is_invisible" boolean DEFAULT false NOT NULL,
    "filter_only_verified" boolean DEFAULT false NOT NULL,
    "university_id" "uuid",
    "university_name_custom" "text",
    "graduation_year" integer,
    "show_university_on_home" boolean DEFAULT true NOT NULL,
    CONSTRAINT "chk_graduation_year" CHECK ((("graduation_year" IS NULL) OR (("graduation_year" >= 1950) AND ("graduation_year" <= 2100)))),
    CONSTRAINT "company_name_len_check" CHECK ((("company_name" IS NULL) OR (("length"("company_name") >= 2) AND ("length"("company_name") <= 80)))),
    CONSTRAINT "job_title_len_check" CHECK ((("job_title" IS NULL) OR (("length"("job_title") >= 2) AND ("length"("job_title") <= 80)))),
    CONSTRAINT "profiles_bio_length" CHECK (("char_length"("bio") <= 500)),
    CONSTRAINT "profiles_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."verification_status" IS 'Identity verification status: unverified (default), pending (in review), verified (approved), rejected (denied)';



COMMENT ON COLUMN "public"."profiles"."is_invisible" IS 'Invisible mode: when true, user is hidden from discovery feeds unless they already liked the viewer';



COMMENT ON COLUMN "public"."profiles"."filter_only_verified" IS 'Trust Circle filter: when true, user only sees verified profiles AND is only visible to verified viewers';



COMMENT ON COLUMN "public"."profiles"."university_id" IS 'FK to places table for official universities';



COMMENT ON COLUMN "public"."profiles"."university_name_custom" IS 'Custom university name when not in places table';



COMMENT ON COLUMN "public"."profiles"."graduation_year" IS 'Year of graduation or expected graduation';



COMMENT ON COLUMN "public"."profiles"."show_university_on_home" IS 'Whether to show university on home screen';



CREATE TABLE IF NOT EXISTS "public"."user_presences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '10:00:00'::interval) NOT NULL,
    "ended_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "place_id" "uuid",
    "entry_type" "text" DEFAULT 'physical'::"text",
    CONSTRAINT "user_presences_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['physical'::"text", 'checkin_plus'::"text"])))
);


ALTER TABLE "public"."user_presences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_presences"."entry_type" IS 'How user entered: physical (in proximity) or checkin_plus (remote via Check-in+)';



CREATE OR REPLACE VIEW "public"."active_users_per_place" WITH ("security_invoker"='on') AS
 SELECT "up"."place_id",
    "up"."user_id",
    "p"."name",
    "p"."bio",
    "date_part"('year'::"text", "age"(("p"."birthdate")::timestamp with time zone)) AS "age",
    "array_remove"("array_agg"(DISTINCT "io"."key" ORDER BY "io"."key"), NULL::"text") AS "intentions",
    "array_remove"("array_agg"(DISTINCT "pp"."url" ORDER BY "pp"."url"), NULL::"text") AS "photos",
    "up"."entered_at",
    "up"."expires_at"
   FROM (((("public"."user_presences" "up"
     JOIN "public"."profiles" "p" ON (("p"."id" = "up"."user_id")))
     LEFT JOIN "public"."profile_intentions" "pi" ON (("pi"."user_id" = "up"."user_id")))
     LEFT JOIN "public"."intention_options" "io" ON (("io"."id" = "pi"."option_id")))
     LEFT JOIN "public"."profile_photos" "pp" ON (("pp"."user_id" = "up"."user_id")))
  WHERE (("up"."active" = true) AND ("up"."ended_at" IS NULL) AND ("up"."expires_at" > "now"()))
  GROUP BY "up"."place_id", "up"."user_id", "p"."name", "p"."bio", "p"."birthdate", "up"."entered_at", "up"."expires_at";


ALTER VIEW "public"."active_users_per_place" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_city_hotlist" (
    "city_id" "uuid" NOT NULL,
    "hotlist" "jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model_version" "text" DEFAULT 'gpt-4o-mini'::"text" NOT NULL,
    "venue_count" integer NOT NULL,
    "temperature" double precision DEFAULT 0.3 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_city_hotlist" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_city_hotlist" IS 'Caches AI-generated iconic venue hotlists to avoid redundant OpenAI API calls';



COMMENT ON COLUMN "public"."ai_city_hotlist"."hotlist" IS 'JSON object with categories as keys: {"bar": ["Name1", ...], "nightclub": [...]}';



COMMENT ON COLUMN "public"."ai_city_hotlist"."generated_at" IS 'Timestamp when hotlist was generated - used for 30-day cache invalidation';



COMMENT ON COLUMN "public"."ai_city_hotlist"."venue_count" IS 'Total number of venues across all categories';



CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "text" NOT NULL,
    "min_version" "text" DEFAULT '1.0.0'::"text" NOT NULL,
    "latest_version" "text" DEFAULT '1.0.0'::"text" NOT NULL,
    "store_url" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_config_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text"])))
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_config" IS 'Remote app configuration for version control. Used to enforce mandatory updates and suggest optional updates.';



COMMENT ON COLUMN "public"."app_config"."min_version" IS 'Minimum required version. Users with older versions will be blocked from using the app.';



COMMENT ON COLUMN "public"."app_config"."latest_version" IS 'Latest available version in the store. Users will be prompted to update if their version is older.';



COMMENT ON COLUMN "public"."app_config"."store_url" IS 'Native store URL (itms-apps:// for iOS, market:// for Android) for deep linking to app store.';



CREATE TABLE IF NOT EXISTS "public"."chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_message_at" timestamp with time zone,
    "place_id" "uuid"
);


ALTER TABLE "public"."chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_name" "text" NOT NULL,
    "country_code" character(2) NOT NULL,
    "geom" "public"."geometry"(MultiPolygon,4326) NOT NULL,
    "bbox" double precision[] NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "last_hydrated_at" timestamp with time zone,
    "priority_score" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retry_count" integer DEFAULT 0,
    "last_error" "text",
    "processing_started_at" timestamp with time zone,
    "processing_finished_at" timestamp with time zone,
    "lat" double precision,
    "lng" double precision,
    CONSTRAINT "cities_registry_bbox_check" CHECK (("array_length"("bbox", 1) = 4)),
    CONSTRAINT "cities_registry_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."cities_registry" OWNER TO "postgres";


COMMENT ON TABLE "public"."cities_registry" IS 'Tracks city hydration status for on-demand global expansion with lazy SWR updates';



COMMENT ON COLUMN "public"."cities_registry"."bbox" IS 'Bounding box in GIS format: [minLon, minLat, maxLon, maxLat]';



COMMENT ON COLUMN "public"."cities_registry"."last_hydrated_at" IS 'Last successful hydration timestamp for 30-day SWR logic';



COMMENT ON COLUMN "public"."cities_registry"."priority_score" IS 'Priority for revalidation based on recent activity (check-ins, matches)';



COMMENT ON COLUMN "public"."cities_registry"."retry_count" IS 'Number of processing attempts (max 3 before manual_review)';



COMMENT ON COLUMN "public"."cities_registry"."last_error" IS 'Last error message if processing failed';



COMMENT ON COLUMN "public"."cities_registry"."processing_started_at" IS 'Timestamp when worker claimed this city';



COMMENT ON COLUMN "public"."cities_registry"."processing_finished_at" IS 'Timestamp when processing completed (success or failure)';



COMMENT ON COLUMN "public"."cities_registry"."lat" IS 'Latitude used to discover this city';



COMMENT ON COLUMN "public"."cities_registry"."lng" IS 'Longitude used to discover this city';



CREATE TABLE IF NOT EXISTS "public"."education_levels" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."education_levels" OWNER TO "postgres";


COMMENT ON TABLE "public"."education_levels" IS 'Níveis educacionais com granularidade de status (em curso vs concluído)';



COMMENT ON COLUMN "public"."education_levels"."sort_order" IS 'Ordem de exibição dos níveis educacionais (10, 20, 30...)';



CREATE SEQUENCE IF NOT EXISTS "public"."education_levels_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."education_levels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."education_levels_id_seq" OWNED BY "public"."education_levels"."id";



CREATE TABLE IF NOT EXISTS "public"."gender_options" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL,
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."gender_options" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."gender_options_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."gender_options_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."gender_options_id_seq" OWNED BY "public"."gender_options"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."intention_options_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."intention_options_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."intention_options_id_seq" OWNED BY "public"."intention_options"."id";



CREATE TABLE IF NOT EXISTS "public"."languages" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL
);


ALTER TABLE "public"."languages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."languages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."languages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."languages_id_seq" OWNED BY "public"."languages"."id";



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "content_enc" "text",
    "content_iv" "text",
    "content_tag" "text"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_events" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "place_id" "uuid",
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_events_type_check" CHECK (("type" = ANY (ARRAY['favorite_activity_started'::"text", 'favorite_activity_heating'::"text", 'nearby_activity_heating'::"text", 'message_received'::"text", 'like_received'::"text", 'match_created'::"text"])))
);


ALTER TABLE "public"."notification_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notification_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notification_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notification_events_id_seq" OWNED BY "public"."notification_events"."id";



CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "user_id" "uuid" NOT NULL,
    "favorite_places" boolean DEFAULT true,
    "nearby_activity" boolean DEFAULT true,
    "messages" boolean DEFAULT true,
    "matches" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "place_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reason" "public"."place_report_reason" NOT NULL,
    "description" "text",
    "status" "public"."place_report_status" DEFAULT 'pending'::"public"."place_report_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid"
);


ALTER TABLE "public"."place_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."place_reports" IS 'User reports for place issues - for manual admin curation';



COMMENT ON COLUMN "public"."place_reports"."reason" IS 'Single reason: closed, wrong_info, does_not_exist, inappropriate, other';



COMMENT ON COLUMN "public"."place_reports"."status" IS 'Workflow status: pending (default), resolved, ignored';



CREATE TABLE IF NOT EXISTS "public"."place_review_tag_relations" (
    "review_id" "uuid" NOT NULL,
    "tag_id" integer NOT NULL
);


ALTER TABLE "public"."place_review_tag_relations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_review_tags" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."place_review_tags" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."place_review_tags_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."place_review_tags_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."place_review_tags_id_seq" OWNED BY "public"."place_review_tags"."id";



CREATE TABLE IF NOT EXISTS "public"."place_social_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "place_id" "uuid" NOT NULL,
    "stars" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "place_social_reviews_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."place_social_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_sources" (
    "place_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."place_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."place_sources" IS 'Maps external data sources to places. Multiple external IDs from the same provider can map to a single place (fuzzy dedup). The (provider, external_id) PRIMARY KEY ensures each external record is processed once, while allowing re-linking to better quality places via ON CONFLICT updates.';



CREATE TABLE IF NOT EXISTS "public"."places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "street" "text",
    "house_number" "text",
    "neighborhood" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "country_code" "text",
    "structural_score" integer DEFAULT 0 NOT NULL,
    "social_score" integer DEFAULT 0 NOT NULL,
    "total_score" integer DEFAULT 0 NOT NULL,
    "last_activity_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "active" boolean DEFAULT true,
    "relevance_score" integer DEFAULT 0,
    "confidence" double precision DEFAULT 0,
    "socials" "jsonb" DEFAULT '[]'::"jsonb",
    "total_checkins" integer DEFAULT 0,
    "original_category" "text",
    "monthly_checkins" integer DEFAULT 0 NOT NULL,
    "total_matches" integer DEFAULT 0,
    "monthly_matches" integer DEFAULT 0,
    "boundary" "public"."geometry"(Geometry,4326)
);


ALTER TABLE "public"."places" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."places_view" WITH ("security_invoker"='on') AS
 SELECT "p"."id",
    "p"."name",
    "p"."category",
    "p"."lat",
    "p"."lng",
    "p"."street",
    "p"."house_number",
    "p"."neighborhood",
    "p"."city",
    "p"."state",
    "p"."postal_code",
    "p"."country_code",
    "p"."structural_score",
    "p"."social_score",
    "p"."total_score",
    "p"."last_activity_at",
    "p"."created_at",
    "p"."updated_at",
    "p"."active",
    "p"."relevance_score",
    "p"."confidence",
    "p"."socials",
    "p"."total_checkins",
    "p"."monthly_checkins",
    "p"."total_matches",
    "p"."monthly_matches",
    "p"."original_category",
    "p"."boundary",
    COALESCE("reviews"."avg_stars", (0)::double precision) AS "review_average",
    COALESCE("reviews"."total_reviews", (0)::bigint) AS "review_count",
    COALESCE("reviews"."top_tags", ARRAY[]::"text"[]) AS "review_tags"
   FROM ("public"."places" "p"
     LEFT JOIN LATERAL ( SELECT ("avg"("psr"."stars"))::double precision AS "avg_stars",
            "count"("psr"."id") AS "total_reviews",
            ARRAY( SELECT "t"."key"
                   FROM (("public"."place_review_tag_relations" "prtr"
                     JOIN "public"."place_review_tags" "t" ON (("t"."id" = "prtr"."tag_id")))
                     JOIN "public"."place_social_reviews" "psr2" ON (("psr2"."id" = "prtr"."review_id")))
                  WHERE ("psr2"."place_id" = "p"."id")
                  GROUP BY "t"."key"
                  ORDER BY ("count"(*)) DESC
                 LIMIT 3) AS "top_tags"
           FROM "public"."place_social_reviews" "psr"
          WHERE ("psr"."place_id" = "p"."id")) "reviews" ON (true))
  WHERE ("p"."active" = true);


ALTER VIEW "public"."places_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_connect_with" (
    "user_id" "uuid" NOT NULL,
    "gender_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_connect_with" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_favorite_places" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "place_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_favorite_places" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."profile_favorite_places_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."profile_favorite_places_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."profile_favorite_places_id_seq" OWNED BY "public"."profile_favorite_places"."id";



CREATE TABLE IF NOT EXISTS "public"."profile_languages" (
    "user_id" "uuid" NOT NULL,
    "language_id" integer NOT NULL
);


ALTER TABLE "public"."profile_languages" OWNER TO "postgres";


ALTER TABLE "public"."profile_photos" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profile_photos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."relationship_status" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL
);


ALTER TABLE "public"."relationship_status" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."relationship_status_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."relationship_status_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."relationship_status_id_seq" OWNED BY "public"."relationship_status"."id";



CREATE TABLE IF NOT EXISTS "public"."smoking_habits" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL
);


ALTER TABLE "public"."smoking_habits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."smoking_habits_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."smoking_habits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."smoking_habits_id_seq" OWNED BY "public"."smoking_habits"."id";



CREATE UNLOGGED TABLE "public"."staging_places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "geom_wkb_hex" "text" NOT NULL,
    "street" "text",
    "house_number" "text",
    "neighborhood" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "country_code" "text",
    "confidence" double precision DEFAULT 0,
    "original_category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "overture_id" "text" NOT NULL,
    "overture_raw" "jsonb",
    "relevance_score" integer DEFAULT 0 NOT NULL,
    "boundary_wkb_hex" "text"
);


ALTER TABLE "public"."staging_places" OWNER TO "postgres";


COMMENT ON TABLE "public"."staging_places" IS 'UNLOGGED staging table for bulk POI imports. Uses relevance_score (structural + taxonomy + authority + scale) for quality ranking.';



COMMENT ON COLUMN "public"."staging_places"."geom_wkb_hex" IS 'Geometry in WKB hexadecimal format to preserve decimal precision';



COMMENT ON COLUMN "public"."staging_places"."overture_id" IS 'Overture Maps unique identifier for deduplication';



COMMENT ON COLUMN "public"."staging_places"."relevance_score" IS 'Composite relevance score: structural_score + taxonomy_bonus + authority_bonus + scale_bonus';



CREATE TABLE IF NOT EXISTS "public"."store_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "store" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "store_transaction_id" "text" NOT NULL,
    "app_user_token" "text",
    "raw_receipt" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "store_purchases_store_check" CHECK (("store" = ANY (ARRAY['apple'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."store_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "store" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "store_event_id" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscription_events_store_check" CHECK (("store" = ANY (ARRAY['apple'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."subscription_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_checkin_credits" (
    "user_id" "uuid" NOT NULL,
    "credits" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_checkin_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "fcm_token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_devices_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text"])))
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_devices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_devices_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_devices_id_seq" OWNED BY "public"."user_devices"."id";



CREATE TABLE IF NOT EXISTS "public"."user_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "action_expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "place_id" "uuid",
    CONSTRAINT "user_interactions_action_check" CHECK (("action" = ANY (ARRAY['like'::"text", 'dislike'::"text"])))
);


ALTER TABLE "public"."user_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "matched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unmatched_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "user_a_opened_at" timestamp with time zone,
    "user_b_opened_at" timestamp with time zone,
    "unmatched_by" "uuid",
    "place_name" "text",
    "place_category" "text",
    "place_id" "uuid",
    CONSTRAINT "user_matches_order_check" CHECK (("user_a" < "user_b")),
    CONSTRAINT "user_matches_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'unmatched'::"text"]))),
    CONSTRAINT "user_matches_status_consistency" CHECK (((("status" = 'active'::"text") AND ("unmatched_at" IS NULL)) OR (("status" = 'unmatched'::"text") AND ("unmatched_at" IS NOT NULL))))
);


ALTER TABLE "public"."user_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "handled" boolean DEFAULT false,
    "handled_at" timestamp with time zone
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "user_id" "uuid" NOT NULL,
    "store" "text" NOT NULL,
    "plan" "text" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "auto_renew" boolean DEFAULT true NOT NULL,
    "original_transaction_id" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['week'::"text", 'month'::"text", 'quarterly'::"text", 'year'::"text"]))),
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'canceled'::"text"]))),
    CONSTRAINT "user_subscriptions_store_check" CHECK (("store" = ANY (ARRAY['apple'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zodiac_signs" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL
);


ALTER TABLE "public"."zodiac_signs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."zodiac_signs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."zodiac_signs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."zodiac_signs_id_seq" OWNED BY "public"."zodiac_signs"."id";



ALTER TABLE ONLY "public"."education_levels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."education_levels_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."gender_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."gender_options_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."intention_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."intention_options_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."languages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."languages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notification_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notification_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."place_review_tags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."place_review_tags_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."profile_favorite_places" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."profile_favorite_places_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."relationship_status" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."relationship_status_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."smoking_habits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."smoking_habits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_devices" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_devices_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."zodiac_signs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zodiac_signs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_city_hotlist"
    ADD CONSTRAINT "ai_city_hotlist_pkey" PRIMARY KEY ("city_id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_match_id_key" UNIQUE ("match_id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities_registry"
    ADD CONSTRAINT "cities_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."education_levels"
    ADD CONSTRAINT "education_levels_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."education_levels"
    ADD CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gender_options"
    ADD CONSTRAINT "gender_options_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."gender_options"
    ADD CONSTRAINT "gender_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intention_options"
    ADD CONSTRAINT "intention_options_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."intention_options"
    ADD CONSTRAINT "intention_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."languages"
    ADD CONSTRAINT "languages_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."languages"
    ADD CONSTRAINT "languages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."place_reports"
    ADD CONSTRAINT "place_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_review_tag_relations"
    ADD CONSTRAINT "place_review_tag_relations_pkey" PRIMARY KEY ("review_id", "tag_id");



ALTER TABLE ONLY "public"."place_review_tags"
    ADD CONSTRAINT "place_review_tags_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."place_review_tags"
    ADD CONSTRAINT "place_review_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_social_reviews"
    ADD CONSTRAINT "place_social_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_sources"
    ADD CONSTRAINT "place_sources_pkey" PRIMARY KEY ("provider", "external_id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_connect_with"
    ADD CONSTRAINT "profile_connect_with_pkey" PRIMARY KEY ("user_id", "gender_id");



ALTER TABLE ONLY "public"."profile_favorite_places"
    ADD CONSTRAINT "profile_favorite_places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_favorite_places"
    ADD CONSTRAINT "profile_favorite_places_user_id_place_id_key" UNIQUE ("user_id", "place_id");



ALTER TABLE ONLY "public"."profile_intentions"
    ADD CONSTRAINT "profile_intentions_pkey" PRIMARY KEY ("user_id", "option_id");



ALTER TABLE ONLY "public"."profile_languages"
    ADD CONSTRAINT "profile_languages_pkey" PRIMARY KEY ("user_id", "language_id");



ALTER TABLE ONLY "public"."profile_photos"
    ADD CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationship_status"
    ADD CONSTRAINT "relationship_status_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."relationship_status"
    ADD CONSTRAINT "relationship_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smoking_habits"
    ADD CONSTRAINT "smoking_habits_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."smoking_habits"
    ADD CONSTRAINT "smoking_habits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_places"
    ADD CONSTRAINT "staging_places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_purchases"
    ADD CONSTRAINT "store_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_purchases"
    ADD CONSTRAINT "store_purchases_unique_store_tx" UNIQUE ("store", "store_transaction_id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_unique" UNIQUE ("store_event_id");



ALTER TABLE ONLY "public"."cities_registry"
    ADD CONSTRAINT "unique_city_country" UNIQUE ("city_name", "country_code");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "unique_platform" UNIQUE ("platform");



ALTER TABLE ONLY "public"."place_social_reviews"
    ADD CONSTRAINT "unique_user_place_review" UNIQUE ("user_id", "place_id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."user_checkin_credits"
    ADD CONSTRAINT "user_checkin_credits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_unique_pair" UNIQUE ("from_user_id", "to_user_id");



ALTER TABLE ONLY "public"."user_matches"
    ADD CONSTRAINT "user_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_matches"
    ADD CONSTRAINT "user_matches_unique_pair" UNIQUE ("user_a", "user_b");



ALTER TABLE ONLY "public"."user_presences"
    ADD CONSTRAINT "user_presences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."zodiac_signs"
    ADD CONSTRAINT "zodiac_signs_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."zodiac_signs"
    ADD CONSTRAINT "zodiac_signs_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_city_hotlist_generated_at_idx" ON "public"."ai_city_hotlist" USING "btree" ("generated_at" DESC);



CREATE INDEX "cities_registry_bbox_idx" ON "public"."cities_registry" USING "gist" ("public"."st_makeenvelope"("bbox"[1], "bbox"[2], "bbox"[3], "bbox"[4], 4326));



CREATE INDEX "cities_registry_geom_idx" ON "public"."cities_registry" USING "gist" ("geom");



CREATE INDEX "cities_registry_priority_idx" ON "public"."cities_registry" USING "btree" ("priority_score" DESC, "last_hydrated_at" NULLS FIRST);



CREATE INDEX "cities_registry_status_idx" ON "public"."cities_registry" USING "btree" ("status");



CREATE INDEX "idx_app_config_platform" ON "public"."app_config" USING "btree" ("platform");



CREATE INDEX "idx_chats_created_at" ON "public"."chats" USING "btree" ("created_at");



CREATE INDEX "idx_chats_match_id" ON "public"."chats" USING "btree" ("match_id");



CREATE INDEX "idx_chats_place" ON "public"."chats" USING "btree" ("place_id");



CREATE INDEX "idx_cities_geom" ON "public"."cities_registry" USING "gist" ("geom");



CREATE INDEX "idx_cities_pending" ON "public"."cities_registry" USING "btree" ("status", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "idx_education_levels_sort_order" ON "public"."education_levels" USING "btree" ("sort_order");



CREATE INDEX "idx_messages_chat_id" ON "public"."messages" USING "btree" ("chat_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_read_at" ON "public"."messages" USING "btree" ("read_at");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_notification_events_user" ON "public"."notification_events" USING "btree" ("user_id");



CREATE INDEX "idx_notification_settings_user_id" ON "public"."notification_settings" USING "btree" ("user_id");



CREATE INDEX "idx_photos_position" ON "public"."profile_photos" USING "btree" ("position");



CREATE INDEX "idx_photos_user" ON "public"."profile_photos" USING "btree" ("user_id");



CREATE INDEX "idx_place_reports_created_at" ON "public"."place_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_place_reports_place_id" ON "public"."place_reports" USING "btree" ("place_id");



CREATE INDEX "idx_place_reports_place_status" ON "public"."place_reports" USING "btree" ("place_id", "status");



CREATE INDEX "idx_place_reports_status" ON "public"."place_reports" USING "btree" ("status");



CREATE INDEX "idx_place_review_tag_relations_review" ON "public"."place_review_tag_relations" USING "btree" ("review_id");



CREATE INDEX "idx_place_review_tag_relations_tag" ON "public"."place_review_tag_relations" USING "btree" ("tag_id");



CREATE INDEX "idx_place_social_reviews_created_at" ON "public"."place_social_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_place_social_reviews_place" ON "public"."place_social_reviews" USING "btree" ("place_id");



CREATE INDEX "idx_place_social_reviews_user" ON "public"."place_social_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_place_sources_place_id" ON "public"."place_sources" USING "btree" ("place_id");



CREATE INDEX "idx_places_boundary_gist" ON "public"."places" USING "gist" ("boundary");



CREATE INDEX "idx_places_geography" ON "public"."places" USING "gist" ((("public"."st_setsrid"("public"."st_makepoint"("lng", "lat"), 4326))::"public"."geography"));



CREATE INDEX "idx_places_location" ON "public"."places" USING "gist" ("public"."st_setsrid"("public"."st_makepoint"("lng", "lat"), 4326));



COMMENT ON INDEX "public"."idx_places_location" IS 'Spatial index for proximity-based deduplication';



CREATE INDEX "idx_places_monthly_checkins" ON "public"."places" USING "btree" ("monthly_checkins" DESC);



CREATE INDEX "idx_places_monthly_matches" ON "public"."places" USING "btree" ("monthly_matches" DESC);



CREATE INDEX "idx_places_name_trgm" ON "public"."places" USING "gin" ("public"."immutable_unaccent"("name") "extensions"."gin_trgm_ops");



COMMENT ON INDEX "public"."idx_places_name_trgm" IS 'GIN trigram index on immutable_unaccent(name) for fuzzy text search with punctuation tolerance';



CREATE INDEX "idx_places_name_trgm_gist" ON "public"."places" USING "gist" ("public"."immutable_unaccent"("name") "extensions"."gist_trgm_ops");



CREATE INDEX "idx_profile_intentions_option_id" ON "public"."profile_intentions" USING "btree" ("option_id");



CREATE INDEX "idx_profile_intentions_user_id" ON "public"."profile_intentions" USING "btree" ("user_id");



CREATE INDEX "idx_profile_languages_language_id" ON "public"."profile_languages" USING "btree" ("language_id");



CREATE INDEX "idx_profile_languages_user_id" ON "public"."profile_languages" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_education_id" ON "public"."profiles" USING "btree" ("education_id");



CREATE INDEX "idx_profiles_filter_only_verified" ON "public"."profiles" USING "btree" ("filter_only_verified") WHERE ("filter_only_verified" = true);



CREATE INDEX "idx_profiles_is_invisible" ON "public"."profiles" USING "btree" ("is_invisible");



CREATE INDEX "idx_profiles_relationship_id" ON "public"."profiles" USING "btree" ("relationship_id");



CREATE INDEX "idx_profiles_smoking_id" ON "public"."profiles" USING "btree" ("smoking_id");



CREATE INDEX "idx_profiles_university_id" ON "public"."profiles" USING "btree" ("university_id");



CREATE INDEX "idx_profiles_verification_status" ON "public"."profiles" USING "btree" ("verification_status");



CREATE INDEX "idx_profiles_zodiac_id" ON "public"."profiles" USING "btree" ("zodiac_id");



CREATE INDEX "idx_store_purchases_store_sku" ON "public"."store_purchases" USING "btree" ("store", "sku");



CREATE INDEX "idx_store_purchases_user" ON "public"."store_purchases" USING "btree" ("user_id");



CREATE INDEX "idx_subscription_events_user" ON "public"."subscription_events" USING "btree" ("user_id");



CREATE INDEX "idx_ui_action" ON "public"."user_interactions" USING "btree" ("action");



CREATE INDEX "idx_ui_expires" ON "public"."user_interactions" USING "btree" ("action_expires_at");



CREATE INDEX "idx_ui_from_user" ON "public"."user_interactions" USING "btree" ("from_user_id");



CREATE INDEX "idx_ui_to_user" ON "public"."user_interactions" USING "btree" ("to_user_id");



CREATE INDEX "idx_um_status" ON "public"."user_matches" USING "btree" ("status");



CREATE INDEX "idx_um_user_a" ON "public"."user_matches" USING "btree" ("user_a");



CREATE INDEX "idx_um_user_b" ON "public"."user_matches" USING "btree" ("user_b");



CREATE INDEX "idx_user_devices_active" ON "public"."user_devices" USING "btree" ("active");



CREATE INDEX "idx_user_devices_user" ON "public"."user_devices" USING "btree" ("user_id");



CREATE INDEX "idx_user_interactions_place" ON "public"."user_interactions" USING "btree" ("place_id");



CREATE INDEX "idx_user_matches_place" ON "public"."user_matches" USING "btree" ("place_id");



CREATE INDEX "idx_user_presences_expires" ON "public"."user_presences" USING "btree" ("expires_at");



CREATE INDEX "idx_user_presences_place" ON "public"."user_presences" USING "btree" ("place_id");



CREATE INDEX "idx_user_presences_user_active" ON "public"."user_presences" USING "btree" ("user_id", "active");



CREATE INDEX "idx_user_subscriptions_status" ON "public"."user_subscriptions" USING "btree" ("user_id", "status");



CREATE INDEX "place_sources_provider_external_id_idx" ON "public"."place_sources" USING "btree" ("provider", "external_id");



CREATE INDEX "places_active_idx" ON "public"."places" USING "btree" ("active");



CREATE INDEX "places_category_idx" ON "public"."places" USING "btree" ("category");



CREATE INDEX "places_city_category_idx" ON "public"."places" USING "btree" ("city", "category");



CREATE INDEX "places_geo_idx" ON "public"."places" USING "gist" ((("public"."st_makepoint"("lng", "lat"))::"public"."geography"));



CREATE INDEX "places_total_checkins_idx" ON "public"."places" USING "btree" ("total_checkins" DESC);



CREATE INDEX "staging_places_overture_id_idx" ON "public"."staging_places" USING "btree" ("overture_id");



CREATE OR REPLACE TRIGGER "on_match_created" AFTER INSERT ON "public"."user_matches" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_handle_match_created"();



CREATE OR REPLACE TRIGGER "on_message_created" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_handle_message_created"();



CREATE OR REPLACE TRIGGER "places_updated_at" BEFORE UPDATE ON "public"."places" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_handle_like_for_match" AFTER INSERT OR UPDATE ON "public"."user_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_like_for_match"();



CREATE OR REPLACE TRIGGER "trg_increment_place_checkins" AFTER INSERT ON "public"."user_presences" FOR EACH ROW EXECUTE FUNCTION "public"."increment_place_checkins"();



CREATE OR REPLACE TRIGGER "trg_set_first_message_at" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_first_message_at"();



CREATE OR REPLACE TRIGGER "trigger_disable_invisible_on_subscription_end" AFTER UPDATE OF "status" ON "public"."user_subscriptions" FOR EACH ROW WHEN ((("old"."status" = 'active'::"text") AND ("new"."status" <> 'active'::"text"))) EXECUTE FUNCTION "public"."disable_invisible_on_subscription_end"();



CREATE OR REPLACE TRIGGER "update_place_match_count_trigger" AFTER INSERT OR DELETE ON "public"."user_matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_place_match_count"();



CREATE OR REPLACE TRIGGER "update_profile_connect_with_timestamp" BEFORE UPDATE ON "public"."profile_connect_with" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "update_profile_intentions_timestamp" BEFORE UPDATE ON "public"."profile_intentions" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



ALTER TABLE ONLY "public"."ai_city_hotlist"
    ADD CONSTRAINT "ai_city_hotlist_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities_registry"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."user_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_place_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_reports"
    ADD CONSTRAINT "place_reports_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_reports"
    ADD CONSTRAINT "place_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."place_reports"
    ADD CONSTRAINT "place_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_review_tag_relations"
    ADD CONSTRAINT "place_review_tag_relations_review_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."place_social_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_review_tag_relations"
    ADD CONSTRAINT "place_review_tag_relations_tag_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."place_review_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_social_reviews"
    ADD CONSTRAINT "place_social_reviews_place_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_social_reviews"
    ADD CONSTRAINT "place_social_reviews_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_sources"
    ADD CONSTRAINT "place_sources_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_connect_with"
    ADD CONSTRAINT "profile_connect_with_gender_id_fkey" FOREIGN KEY ("gender_id") REFERENCES "public"."gender_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_connect_with"
    ADD CONSTRAINT "profile_connect_with_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_favorite_places"
    ADD CONSTRAINT "profile_favorite_places_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_favorite_places"
    ADD CONSTRAINT "profile_favorite_places_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_intentions"
    ADD CONSTRAINT "profile_intentions_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."intention_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_intentions"
    ADD CONSTRAINT "profile_intentions_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_languages"
    ADD CONSTRAINT "profile_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_languages"
    ADD CONSTRAINT "profile_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_photos"
    ADD CONSTRAINT "profile_photos_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_education_id_fkey" FOREIGN KEY ("education_id") REFERENCES "public"."education_levels"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_gender_id_fkey" FOREIGN KEY ("gender_id") REFERENCES "public"."gender_options"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship_status"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_smoking_id_fkey" FOREIGN KEY ("smoking_id") REFERENCES "public"."smoking_habits"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."places"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_zodiac_id_fkey" FOREIGN KEY ("zodiac_id") REFERENCES "public"."zodiac_signs"("id");



ALTER TABLE ONLY "public"."store_purchases"
    ADD CONSTRAINT "store_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_checkin_credits"
    ADD CONSTRAINT "user_checkin_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_place_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_matches"
    ADD CONSTRAINT "user_matches_place_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id");



ALTER TABLE ONLY "public"."user_matches"
    ADD CONSTRAINT "user_matches_unmatched_by_fkey" FOREIGN KEY ("unmatched_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_matches"
    ADD CONSTRAINT "user_matches_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_matches"
    ADD CONSTRAINT "user_matches_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_presences"
    ADD CONSTRAINT "user_presences_place_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id");



ALTER TABLE ONLY "public"."user_presences"
    ADD CONSTRAINT "user_presences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reported_fkey" FOREIGN KEY ("reported_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public read" ON "public"."app_config" FOR SELECT USING (true);



CREATE POLICY "Allow read languages" ON "public"."languages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Delete own languages" ON "public"."profile_languages" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Insert own languages" ON "public"."profile_languages" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Read own languages" ON "public"."profile_languages" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Service role full access" ON "public"."place_reports" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create place reports" ON "public"."place_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own connect_with" ON "public"."profile_connect_with" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own favorite places" ON "public"."profile_favorite_places" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own connect_with" ON "public"."profile_connect_with" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own favorite places" ON "public"."profile_favorite_places" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own connect_with" ON "public"."profile_connect_with" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own presences" ON "public"."user_presences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own favorite places" ON "public"."profile_favorite_places" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their rows" ON "public"."profile_photos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notification settings" ON "public"."notification_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notification settings update" ON "public"."notification_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own reports" ON "public"."place_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notification settings" ON "public"."notification_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users delete their own intentions" ON "public"."profile_intentions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete their own rows" ON "public"."profile_photos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert their own intentions" ON "public"."profile_intentions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert their own rows" ON "public"."profile_photos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read only their intentions" ON "public"."profile_intentions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update their own rows" ON "public"."profile_photos" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_city_hotlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chats_update_policy" ON "public"."chats" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_matches" "m"
  WHERE (("m"."id" = "chats"."match_id") AND (("m"."user_a" = "auth"."uid"()) OR ("m"."user_b" = "auth"."uid"())) AND ("m"."status" = 'active'::"text"))))) WITH CHECK (false);



ALTER TABLE "public"."cities_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."education_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gender_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_chats_policy" ON "public"."chats" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_matches" "m"
  WHERE (("m"."id" = "chats"."match_id") AND (("m"."user_a" = "auth"."uid"()) OR ("m"."user_b" = "auth"."uid"())) AND ("m"."status" = 'active'::"text")))));



CREATE POLICY "insert_messages_policy" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."chats" "c"
     JOIN "public"."user_matches" "m" ON (("m"."id" = "c"."match_id")))
  WHERE (("c"."id" = "messages"."chat_id") AND ("m"."status" = 'active'::"text") AND (("m"."user_a" = "auth"."uid"()) OR ("m"."user_b" = "auth"."uid"())))))));



CREATE POLICY "insert_user_interactions_policy" ON "public"."user_interactions" FOR INSERT WITH CHECK ((("auth"."uid"() = "from_user_id") AND ("auth"."uid"() <> "to_user_id")));



CREATE POLICY "insert_user_matches_policy" ON "public"."user_matches" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b")));



ALTER TABLE "public"."intention_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."languages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_review_tag_relations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_review_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_social_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_connect_with" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_favorite_places" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_intentions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_languages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationship_status" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_chats_policy" ON "public"."chats" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_matches" "m"
  WHERE (("m"."id" = "chats"."match_id") AND (("m"."user_a" = "auth"."uid"()) OR ("m"."user_b" = "auth"."uid"()))))));



CREATE POLICY "select_messages_policy" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("sender_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."chats" "c"
     JOIN "public"."user_matches" "m" ON (("m"."id" = "c"."match_id")))
  WHERE (("c"."id" = "messages"."chat_id") AND ("m"."status" = 'active'::"text") AND (("m"."user_a" = "auth"."uid"()) OR ("m"."user_b" = "auth"."uid"())))))));



CREATE POLICY "select_user_interactions_policy" ON "public"."user_interactions" FOR SELECT USING ((("auth"."uid"() = "from_user_id") OR ("auth"."uid"() = "to_user_id")));



CREATE POLICY "select_user_matches_policy" ON "public"."user_matches" FOR SELECT USING ((("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b")));



ALTER TABLE "public"."smoking_habits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_places" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_user_interactions_policy" ON "public"."user_interactions" FOR UPDATE USING (("auth"."uid"() = "from_user_id")) WITH CHECK (("auth"."uid"() = "from_user_id"));



CREATE POLICY "update_user_matches_policy" ON "public"."user_matches" FOR UPDATE USING ((("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b"))) WITH CHECK ((("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b")));



ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_checkin_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_presences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zodiac_signs" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_insert_places_osm"("places_input" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_insert_places_osm"("places_input" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_insert_places_osm"("places_input" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_lock_city_for_hydration"("user_lat" double precision, "user_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_lock_city_for_hydration"("user_lat" double precision, "user_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_lock_city_for_hydration"("user_lat" double precision, "user_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_city_by_coordinates"("user_lat" double precision, "user_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."check_city_by_coordinates"("user_lat" double precision, "user_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_city_by_coordinates"("user_lat" double precision, "user_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_checkin_credit"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_checkin_credit"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_checkin_credit"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_completely"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_invisible_on_subscription_end"() TO "anon";
GRANT ALL ON FUNCTION "public"."disable_invisible_on_subscription_end"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_invisible_on_subscription_end"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enter_place"("p_user_id" "uuid", "p_place_id" "uuid", "p_user_lat" double precision, "p_user_lng" double precision, "p_is_checkin_plus" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."enter_place"("p_user_id" "uuid", "p_place_id" "uuid", "p_user_lat" double precision, "p_user_lng" double precision, "p_is_checkin_plus" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enter_place"("p_user_id" "uuid", "p_place_id" "uuid", "p_user_lat" double precision, "p_user_lng" double precision, "p_is_checkin_plus" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_city_by_coordinates"("search_lat" double precision, "search_lng" double precision, "tolerance_meters" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_city_by_coordinates"("search_lat" double precision, "search_lng" double precision, "tolerance_meters" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_city_by_coordinates"("search_lat" double precision, "search_lng" double precision, "tolerance_meters" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_user_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_user_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_user_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_users_with_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_users_with_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_users_with_avatars"("target_place_id" "uuid", "requesting_user_id" "uuid", "max_avatars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_users_with_avatars_batch"("place_ids" "uuid"[], "requesting_user_id" "uuid", "max_avatars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_users_with_avatars_batch"("place_ids" "uuid"[], "requesting_user_id" "uuid", "max_avatars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_users_with_avatars_batch"("place_ids" "uuid"[], "requesting_user_id" "uuid", "max_avatars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_users_at_place"("p_place_id" "uuid", "viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_users_at_place"("p_place_id" "uuid", "viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_users_at_place"("p_place_id" "uuid", "viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_place_candidate"("p_user_id" "uuid", "user_lat" double precision, "user_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_place_candidate"("p_user_id" "uuid", "user_lat" double precision, "user_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_place_candidate"("p_user_id" "uuid", "user_lat" double precision, "user_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_eligible_active_users_count"("target_place_id" "uuid", "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_eligible_active_users_count"("target_place_id" "uuid", "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_eligible_active_users_count"("target_place_id" "uuid", "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_favorite_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_favorite_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_favorite_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_likes"("viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_likes"("viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_likes"("viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_likes_users"("viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_likes_users"("viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_likes_users"("viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_place_activity_candidates"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_place_activity_candidates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_place_activity_candidates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_places_for_nominatim_enrichment"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_places_for_nominatim_enrichment"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_places_for_nominatim_enrichment"("batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ranked_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "rank_by" "text", "max_results" integer, "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_ranked_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "rank_by" "text", "max_results" integer, "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ranked_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "rank_by" "text", "max_results" integer, "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "requesting_user_id" "uuid", "page_offset" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "requesting_user_id" "uuid", "page_offset" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_places"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "requesting_user_id" "uuid", "page_offset" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_chats_for_sync"("p_user_id" "uuid", "p_since" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_chats_for_sync"("p_user_id" "uuid", "p_since" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_chats_for_sync"("p_user_id" "uuid", "p_since" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_favorite_places"("user_lat" double precision, "user_lng" double precision, "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_favorite_places"("user_lat" double precision, "user_lng" double precision, "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_favorite_places"("user_lat" double precision, "user_lng" double precision, "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_like_for_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_like_for_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_like_for_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."import_osm_places"("temp_table_name" "text", "max_safe_distance_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."import_osm_places"("temp_table_name" "text", "max_safe_distance_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_osm_places"("temp_table_name" "text", "max_safe_distance_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "max_safe_distance_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "max_safe_distance_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "max_safe_distance_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "city_param" "text", "state_param" "text", "country_code_param" "text", "max_safe_distance_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "city_param" "text", "state_param" "text", "country_code_param" "text", "max_safe_distance_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_osm_places_full"("temp_table_name" "text", "city_param" "text", "state_param" "text", "country_code_param" "text", "max_safe_distance_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."import_overture_places"("temp_table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."import_overture_places"("temp_table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_overture_places"("temp_table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_place_checkins"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_place_checkins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_place_checkins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_staging_to_production"("p_city_id" "uuid", "p_bbox" double precision[], "is_final_batch" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."merge_staging_to_production"("p_city_id" "uuid", "p_bbox" double precision[], "is_final_batch" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_staging_to_production"("p_city_id" "uuid", "p_bbox" double precision[], "is_final_batch" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_monthly_checkins"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_monthly_checkins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_monthly_checkins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_monthly_matches"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_monthly_matches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_monthly_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[], "p_favorite_place_ids" "uuid"[], "p_bio" "text", "p_university_id" "uuid", "p_university_name_custom" "text", "p_graduation_year" integer, "p_show_university_on_home" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[], "p_favorite_place_ids" "uuid"[], "p_bio" "text", "p_university_id" "uuid", "p_university_name_custom" "text", "p_graduation_year" integer, "p_show_university_on_home" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_onboarding_txn"("p_user_id" "uuid", "p_name" "text", "p_birthdate" "date", "p_gender_id" integer, "p_connect_ids" integer[], "p_intention_ids" integer[], "p_photo_urls" "text"[], "p_photo_positions" integer[], "p_favorite_place_ids" "uuid"[], "p_bio" "text", "p_university_id" "uuid", "p_university_name_custom" "text", "p_graduation_year" integer, "p_show_university_on_home" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_places_autocomplete"("query_text" "text", "user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid", "filter_categories" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."search_places_autocomplete"("query_text" "text", "user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid", "filter_categories" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_places_autocomplete"("query_text" "text", "user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "max_results" integer, "requesting_user_id" "uuid", "filter_categories" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_places_by_favorites"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "place_category" "text", "max_results" integer, "requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid", "sort_by" "text", "min_rating" double precision, "page_offset" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid", "sort_by" "text", "min_rating" double precision, "page_offset" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_places_nearby"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision, "filter_categories" "text"[], "max_results" integer, "requesting_user_id" "uuid", "sort_by" "text", "min_rating" double precision, "page_offset" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_first_message_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_first_message_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_first_message_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."staging_wkb_to_geom"("wkb_hex" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."staging_wkb_to_geom"("wkb_hex" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staging_wkb_to_geom"("wkb_hex" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_handle_match_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_handle_match_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_handle_match_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_handle_message_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_handle_message_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_handle_message_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_place_from_nominatim"("place_id_param" "uuid", "street_param" "text", "house_number_param" "text", "neighborhood_param" "text", "postal_code_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_place_from_nominatim"("place_id_param" "uuid", "street_param" "text", "house_number_param" "text", "neighborhood_param" "text", "postal_code_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_place_from_nominatim"("place_id_param" "uuid", "street_param" "text", "house_number_param" "text", "neighborhood_param" "text", "postal_code_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_place_match_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_place_match_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_place_match_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."intention_options" TO "anon";
GRANT ALL ON TABLE "public"."intention_options" TO "authenticated";
GRANT ALL ON TABLE "public"."intention_options" TO "service_role";



GRANT ALL ON TABLE "public"."profile_intentions" TO "anon";
GRANT ALL ON TABLE "public"."profile_intentions" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_intentions" TO "service_role";



GRANT ALL ON TABLE "public"."profile_photos" TO "anon";
GRANT ALL ON TABLE "public"."profile_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_photos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_presences" TO "anon";
GRANT ALL ON TABLE "public"."user_presences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_presences" TO "service_role";



GRANT ALL ON TABLE "public"."active_users_per_place" TO "anon";
GRANT ALL ON TABLE "public"."active_users_per_place" TO "authenticated";
GRANT ALL ON TABLE "public"."active_users_per_place" TO "service_role";



GRANT ALL ON TABLE "public"."ai_city_hotlist" TO "anon";
GRANT ALL ON TABLE "public"."ai_city_hotlist" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_city_hotlist" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."chats" TO "anon";
GRANT ALL ON TABLE "public"."chats" TO "authenticated";
GRANT ALL ON TABLE "public"."chats" TO "service_role";



GRANT ALL ON TABLE "public"."cities_registry" TO "anon";
GRANT ALL ON TABLE "public"."cities_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."cities_registry" TO "service_role";



GRANT ALL ON TABLE "public"."education_levels" TO "anon";
GRANT ALL ON TABLE "public"."education_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."education_levels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."education_levels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."education_levels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."education_levels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gender_options" TO "anon";
GRANT ALL ON TABLE "public"."gender_options" TO "authenticated";
GRANT ALL ON TABLE "public"."gender_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gender_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gender_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gender_options_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."intention_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."intention_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."intention_options_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."languages" TO "anon";
GRANT ALL ON TABLE "public"."languages" TO "authenticated";
GRANT ALL ON TABLE "public"."languages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."languages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."languages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."languages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_events" TO "anon";
GRANT ALL ON TABLE "public"."notification_events" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notification_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."place_reports" TO "anon";
GRANT ALL ON TABLE "public"."place_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."place_reports" TO "service_role";



GRANT ALL ON TABLE "public"."place_review_tag_relations" TO "anon";
GRANT ALL ON TABLE "public"."place_review_tag_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."place_review_tag_relations" TO "service_role";



GRANT ALL ON TABLE "public"."place_review_tags" TO "anon";
GRANT ALL ON TABLE "public"."place_review_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."place_review_tags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_review_tags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_review_tags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_review_tags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."place_social_reviews" TO "anon";
GRANT ALL ON TABLE "public"."place_social_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."place_social_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."place_sources" TO "anon";
GRANT ALL ON TABLE "public"."place_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."place_sources" TO "service_role";



GRANT ALL ON TABLE "public"."places" TO "anon";
GRANT ALL ON TABLE "public"."places" TO "authenticated";
GRANT ALL ON TABLE "public"."places" TO "service_role";



GRANT ALL ON TABLE "public"."places_view" TO "anon";
GRANT ALL ON TABLE "public"."places_view" TO "authenticated";
GRANT ALL ON TABLE "public"."places_view" TO "service_role";



GRANT ALL ON TABLE "public"."profile_connect_with" TO "anon";
GRANT ALL ON TABLE "public"."profile_connect_with" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_connect_with" TO "service_role";



GRANT ALL ON TABLE "public"."profile_favorite_places" TO "anon";
GRANT ALL ON TABLE "public"."profile_favorite_places" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_favorite_places" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_favorite_places_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_favorite_places_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_favorite_places_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_languages" TO "anon";
GRANT ALL ON TABLE "public"."profile_languages" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_languages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_photos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_photos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_photos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."relationship_status" TO "anon";
GRANT ALL ON TABLE "public"."relationship_status" TO "authenticated";
GRANT ALL ON TABLE "public"."relationship_status" TO "service_role";



GRANT ALL ON SEQUENCE "public"."relationship_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."relationship_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."relationship_status_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."smoking_habits" TO "anon";
GRANT ALL ON TABLE "public"."smoking_habits" TO "authenticated";
GRANT ALL ON TABLE "public"."smoking_habits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."smoking_habits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."smoking_habits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."smoking_habits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staging_places" TO "anon";
GRANT ALL ON TABLE "public"."staging_places" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_places" TO "service_role";



GRANT ALL ON TABLE "public"."store_purchases" TO "anon";
GRANT ALL ON TABLE "public"."store_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."store_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_events" TO "anon";
GRANT ALL ON TABLE "public"."subscription_events" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_checkin_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_checkin_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_checkin_credits" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_devices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_devices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_devices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_interactions" TO "anon";
GRANT ALL ON TABLE "public"."user_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_matches" TO "anon";
GRANT ALL ON TABLE "public"."user_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."user_matches" TO "service_role";



GRANT ALL ON TABLE "public"."user_reports" TO "anon";
GRANT ALL ON TABLE "public"."user_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."user_reports" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."zodiac_signs" TO "anon";
GRANT ALL ON TABLE "public"."zodiac_signs" TO "authenticated";
GRANT ALL ON TABLE "public"."zodiac_signs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."zodiac_signs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zodiac_signs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zodiac_signs_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







