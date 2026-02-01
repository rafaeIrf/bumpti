-- =============================================================================
-- Migration: Add bidirectional verification filter to helper functions
-- =============================================================================
-- This migration:
-- 1. Updates get_active_users_with_avatars to include Trust Circle verification filter
-- 2. Updates get_eligible_active_users_count to include Trust Circle verification filter
-- 
-- Verification Logic (Bidirectional):
-- RULE 1: If viewer has filter_only_verified = true, only show verified profiles
-- RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
-- =============================================================================

-- =============================================================================
-- PART 1: Update get_active_users_with_avatars
-- =============================================================================
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
    -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified = true, only count verified profiles
    AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.verification_status = 'verified'
    ))
    -- TRUST CIRCLE FILTER RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
    AND (requesting_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM profiles target_profile
      WHERE target_profile.id = up.user_id
        AND target_profile.filter_only_verified = true
        AND (req_verification_status IS NULL OR req_verification_status != 'verified')
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
      -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified = true, only show verified profiles
      AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.verification_status = 'verified'
      ))
      -- TRUST CIRCLE FILTER RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.filter_only_verified = true
          AND (req_verification_status IS NULL OR req_verification_status != 'verified')
      ))
    ORDER BY up.entered_at DESC
    LIMIT max_avatars
  ) INTO avatar_data;

  result.avatars := avatar_data;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_users_with_avatars(uuid, uuid, integer) TO authenticated, anon;

COMMENT ON FUNCTION get_active_users_with_avatars IS 
'Returns count and avatar URLs of eligible active users at a place.
Filters: blocks, dislikes, likes, active matches, gender preferences, bidirectional age filter, Trust Circle (bidirectional verification).
Trust Circle: Respects filter_only_verified setting bidirectionally.';

-- =============================================================================
-- PART 2: Update get_eligible_active_users_count
-- =============================================================================
CREATE OR REPLACE FUNCTION get_eligible_active_users_count(
  target_place_id uuid,
  requesting_user_id uuid
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
      -- TRUST CIRCLE FILTER RULE 1: If viewer has filter_only_verified = true, only count verified profiles
      AND (requesting_user_id IS NULL OR req_filter_verified = false OR req_filter_verified IS NULL OR EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.verification_status = 'verified'
      ))
      -- TRUST CIRCLE FILTER RULE 2: If target user has filter_only_verified = true, hide from unverified viewers
      AND (requesting_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles target_profile
        WHERE target_profile.id = up.user_id
          AND target_profile.filter_only_verified = true
          AND (req_verification_status IS NULL OR req_verification_status != 'verified')
      ))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_eligible_active_users_count(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_eligible_active_users_count IS 
'Returns count of eligible active users at a place for a requesting user.
Excludes: self, blocked, disliked, liked (pending), active matched users.
Filters by: gender preference compatibility, bidirectional age filter, Trust Circle (bidirectional verification).
Trust Circle: Respects filter_only_verified setting bidirectionally.';
