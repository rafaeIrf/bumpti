-- Fix duplicate avatars: use DISTINCT ON (user_id) to ensure one avatar per user
-- This fixes cases where profile_photos has multiple rows with position=0 for the same user

-- 1. Fix get_regulars_avatars_at_place
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
        jsonb_build_object('user_id', r.user_id, 'url', pp.url) as avatar_row
      FROM get_eligible_regulars_at_place(target_place_id, requesting_user_id) r
      INNER JOIN profile_photos pp ON pp.user_id = r.user_id
      WHERE pp.url IS NOT NULL
      ORDER BY r.user_id, pp.position ASC
      LIMIT max_avatars
    ) sub
  );
END;
$$;

-- 2. Fix get_active_users_with_avatars avatar section to use DISTINCT ON (user_id)
-- Prevents duplicates when a user has multiple photos in profile_photos
CREATE OR REPLACE FUNCTION get_active_users_with_avatars(
  target_place_id uuid,
  requesting_user_id uuid DEFAULT NULL,
  max_avatars integer DEFAULT 5
)
RETURNS active_users_info
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result active_users_info;
  avatar_data user_avatar[];
  req_age_min integer;
  req_age_max integer;
  req_age integer;
  req_filter_verified boolean;
  req_verification_status text;
BEGIN
  -- Get requesting user's age preferences, age, AND verification settings
  IF requesting_user_id IS NOT NULL THEN
    SELECT 
      age_range_min, 
      age_range_max,
      EXTRACT(YEAR FROM AGE(birthdate))::integer,
      filter_only_verified,
      verification_status
    INTO req_age_min, req_age_max, req_age, req_filter_verified, req_verification_status
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
    AND (requesting_user_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = up.user_id)
      OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles rp ON rp.id = requesting_user_id
        WHERE pcw.user_id = up.user_id
          AND pcw.gender_id = rp.gender_id
      )
    )
    AND (requesting_user_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = requesting_user_id)
      OR EXISTS (
        SELECT 1 FROM profile_connect_with pcw
        INNER JOIN profiles tp ON tp.id = up.user_id
        WHERE pcw.user_id = requesting_user_id
          AND pcw.gender_id = tp.gender_id
      )
    )
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
    AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.verification_status = 'verified'
    ))
    AND (requesting_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.filter_only_verified = true
        AND (req_verification_status IS NULL OR req_verification_status != 'verified')
    ));

  -- Get avatar URLs with user_id — DISTINCT ON user_id to prevent duplicates
  -- when a user has multiple photos (multiple rows in profile_photos)
  SELECT ARRAY(
    SELECT ROW(sub.user_id, sub.url)::user_avatar
    FROM (
      SELECT DISTINCT ON (up.user_id)
        up.user_id,
        pp.url
      FROM user_presences up
      INNER JOIN profile_photos pp ON pp.user_id = up.user_id
      WHERE up.place_id = target_place_id
        AND up.active = true
        AND up.ended_at IS NULL
        AND up.expires_at > NOW()
        AND pp.url IS NOT NULL
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
        AND (requesting_user_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = up.user_id)
          OR EXISTS (
            SELECT 1 FROM profile_connect_with pcw
            INNER JOIN profiles rp ON rp.id = requesting_user_id
            WHERE pcw.user_id = up.user_id
              AND pcw.gender_id = rp.gender_id
          )
        )
        AND (requesting_user_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM profile_connect_with WHERE user_id = requesting_user_id)
          OR EXISTS (
            SELECT 1 FROM profile_connect_with pcw
            INNER JOIN profiles tp ON tp.id = up.user_id
            WHERE pcw.user_id = requesting_user_id
              AND pcw.gender_id = tp.gender_id
          )
        )
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
        AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
          SELECT 1 FROM profiles target_profile
          WHERE target_profile.id = up.user_id
            AND target_profile.verification_status = 'verified'
        ))
        AND (requesting_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM profiles target_profile
          WHERE target_profile.id = up.user_id
            AND target_profile.filter_only_verified = true
            AND (req_verification_status IS NULL OR req_verification_status != 'verified')
        ))
      ORDER BY up.user_id, pp.position ASC
      LIMIT max_avatars
    ) sub
  ) INTO avatar_data;

  result.avatars := avatar_data;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_users_with_avatars(uuid, uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_regulars_avatars_at_place(uuid, uuid, integer) TO authenticated, anon;
