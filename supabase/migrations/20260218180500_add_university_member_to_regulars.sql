-- =============================================================================
-- Migration: Add university_member as 3rd source for regulars
-- =============================================================================
-- When a user sets a university_id on their profile, they automatically become
-- a "regular" at that place. This has NO expiration — unlike past_visitor (60 days),
-- the user remains a regular as long as university_id is set on their profile.
-- Removing the university from their profile removes them as a regular via this source.
--
-- Priority order (DISTINCT ON keeps highest priority per user):
--   1. past_visitor  — had a check-in in the last 60 days
--   2. favorite      — favorited the place
--   3. university_member — has this place as their university (never expires)
--
-- Base: 20260218144300_refactor_rpcs_use_is_eligible_match.sql
-- =============================================================================

-- Must DROP first because return type is a complex TABLE
DROP FUNCTION IF EXISTS get_eligible_regulars_at_place(uuid, uuid);

CREATE OR REPLACE FUNCTION get_eligible_regulars_at_place(
  target_place_id uuid,
  requesting_user_id uuid
)
RETURNS TABLE(
  user_id uuid,
  entry_type text,
  entered_at timestamptz,
  -- Enriched profile fields
  name text,
  age int,
  bio text,
  intentions text[],
  photos text[],
  job_title text,
  company_name text,
  height_cm int,
  zodiac_sign text,
  education_level text,
  relationship_status text,
  smoking_habit text,
  favorite_places text[],
  languages text[],
  interests text[],
  university_id uuid,
  university_name text,
  university_name_custom text,
  graduation_year int,
  show_university_on_home boolean,
  verification_status text,
  city_name text,
  city_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
    WITH eligible_regulars AS (
      -- DISTINCT ON ensures each user appears only once, prioritized by source
      SELECT DISTINCT ON (candidates.uid)
        candidates.uid,
        candidates.etype,
        candidates.eat
      FROM (
        -- Source 1: Past check-ins (last 60 days, inactive presences)
        SELECT
          up.user_id AS uid,
          'past_visitor'::text AS etype,
          up.entered_at AS eat,
          1 AS priority
        FROM user_presences up
        WHERE up.place_id = target_place_id
          AND up.active = false
          AND up.entered_at > NOW() - INTERVAL '60 days'
          AND NOT EXISTS (
            SELECT 1 FROM user_presences active_up
            WHERE active_up.user_id = up.user_id
              AND active_up.place_id = target_place_id
              AND active_up.active = true
              AND active_up.ended_at IS NULL
              AND active_up.expires_at > NOW()
          )

        UNION ALL

        -- Source 2: Users who favorited this place
        SELECT
          pfp.user_id AS uid,
          'favorite'::text AS etype,
          pfp.created_at AS eat,
          2 AS priority
        FROM profile_favorite_places pfp
        WHERE pfp.place_id = target_place_id
          AND NOT EXISTS (
            SELECT 1 FROM user_presences active_up
            WHERE active_up.user_id = pfp.user_id
              AND active_up.place_id = target_place_id
              AND active_up.active = true
              AND active_up.ended_at IS NULL
              AND active_up.expires_at > NOW()
          )

        UNION ALL

        -- Source 3: Users whose university is this place (NEVER expires)
        -- User remains a regular as long as profiles.university_id = target_place_id.
        -- Removing the university from their profile removes this source automatically.
        SELECT
          p.id AS uid,
          'university_member'::text AS etype,
          p.updated_at AS eat,
          3 AS priority  -- lowest priority (past_visitor & favorite win)
        FROM profiles p
        WHERE p.university_id = target_place_id
          AND NOT EXISTS (
            SELECT 1 FROM user_presences active_up
            WHERE active_up.user_id = p.id
              AND active_up.place_id = target_place_id
              AND active_up.active = true
              AND active_up.ended_at IS NULL
              AND active_up.expires_at > NOW()
          )
      ) candidates
      WHERE
        (requesting_user_id IS NULL
         OR is_eligible_match(requesting_user_id, candidates.uid))
      ORDER BY candidates.uid, candidates.priority ASC, candidates.eat DESC
    )
    -- Now JOIN with profile data
    SELECT
      er.uid AS user_id,
      er.etype AS entry_type,
      er.eat AS entered_at,
      p.name,
      date_part('year', age(p.birthdate))::int AS age,
      p.bio,
      COALESCE(intent.intentions, ARRAY[]::text[]) AS intentions,
      COALESCE(photo.photos, ARRAY[]::text[]) AS photos,
      p.job_title,
      p.company_name,
      p.height_cm,
      zs.key AS zodiac_sign,
      el.key AS education_level,
      rs.key AS relationship_status,
      sh.key AS smoking_habit,
      COALESCE(fav.places, ARRAY[]::text[]) AS favorite_places,
      COALESCE(lang.langs, ARRAY[]::text[]) AS languages,
      COALESCE(interest.interests, ARRAY[]::text[]) AS interests,
      p.university_id,
      COALESCE(univ_place.name, p.university_name_custom) AS university_name,
      p.university_name_custom,
      p.graduation_year,
      COALESCE(p.show_university_on_home, false) AS show_university_on_home,
      p.verification_status,
      p.city_name,
      p.city_state
    FROM eligible_regulars er
    JOIN profiles p ON p.id = er.uid
    LEFT JOIN zodiac_signs zs ON zs.id = p.zodiac_id
    LEFT JOIN education_levels el ON el.id = p.education_id
    LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
    LEFT JOIN smoking_habits sh ON sh.id = p.smoking_id
    LEFT JOIN places univ_place ON univ_place.id = p.university_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT io.key) AS intentions
      FROM profile_intentions pi
      JOIN intention_options io ON io.id = pi.option_id
      WHERE pi.user_id = er.uid
    ) intent ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(pp.url ORDER BY pp.position ASC) AS photos
      FROM profile_photos pp
      WHERE pp.user_id = er.uid
    ) photo ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT pfp2.place_id::text) AS places
      FROM profile_favorite_places pfp2
      WHERE pfp2.user_id = er.uid
    ) fav ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT l.key) AS langs
      FROM profile_languages pl
      JOIN languages l ON l.id = pl.language_id
      WHERE pl.user_id = er.uid
    ) lang ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT i.key) AS interests
      FROM profile_interests pi2
      JOIN interests i ON i.id = pi2.interest_id
      WHERE pi2.profile_id = er.uid
    ) interest ON true
    -- Invisible mode: only show if they liked me
    WHERE
      p.is_invisible = false
      OR EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = er.uid
          AND ui.to_user_id = requesting_user_id
          AND ui.action = 'like'
          AND ui.action_expires_at > NOW()
      );
END;
$$;

GRANT EXECUTE ON FUNCTION get_eligible_regulars_at_place(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION get_eligible_regulars_at_place IS
'Returns enriched regulars at a place using is_eligible_match shared helper.
Sources: past check-ins (60 days) + favorites + university members (never expires).
Active users excluded. Priority: past_visitor > favorite > university_member.
Returns full profile data (same shape as get_available_users_at_place).';
