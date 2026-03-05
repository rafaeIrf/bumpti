-- =============================================================================
-- Migration: Add get_planning_users_at_place RPC
-- =============================================================================
-- Returns eligible users who are PLANNING to go to a specific place on a
-- specific date (and optionally a specific period).
--
-- This is a dedicated path for the "Ver quem vai" feature in PlanHero,
-- separate from get_available_users_at_place (which mixes physical + planning).
--
-- Filters applied:
--   - entry_type = 'planning' (only intent-based presences)
--   - active = true, ended_at IS NULL, expires_at > NOW()
--   - planned_for = p_planned_for (exact date match)
--   - planned_period = p_planned_period (optional; NULL = any period)
--   - Excludes the viewer themselves
--   - is_eligible_match(viewer_id, candidate) — full 8-filter matrix
--   - is_invisible guard (same as regulars RPC)
--
-- Shape: same enrichment JOINs as get_eligible_regulars_at_place
-- (last updated: 20260301215500_add_social_hub_to_regulars.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_planning_users_at_place(
  p_place_id       uuid,
  p_planned_for    date,
  p_planned_period text,    -- 'morning' | 'afternoon' | 'night' | NULL (any)
  viewer_id        uuid
)
RETURNS TABLE(
  user_id              uuid,
  entry_type           text,
  entered_at           timestamptz,
  planned_for          date,
  planned_period       text,
  -- Enriched profile fields (same shape as get_eligible_regulars_at_place)
  name                 text,
  age                  int,
  bio                  text,
  intentions           text[],
  photos               text[],
  job_title            text,
  company_name         text,
  height_cm            int,
  zodiac_sign          text,
  education_level      text,
  relationship_status  text,
  smoking_habit        text,
  favorite_places      text[],
  languages            text[],
  interests            text[],
  university_id        uuid,
  university_name      text,
  university_name_custom text,
  graduation_year      int,
  show_university_on_home boolean,
  verification_status  text,
  city_name            text,
  city_state           text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
    WITH planners AS (
      -- DISTINCT ON: each user appears at most once, latest presence first
      SELECT DISTINCT ON (up.user_id)
        up.user_id                AS uid,
        up.entry_type::text       AS etype,
        up.entered_at             AS eat,
        up.planned_for            AS pfor,
        up.planned_period::text   AS pperiod
      FROM user_presences up
      WHERE up.place_id     = p_place_id
        AND up.entry_type   = 'planning'
        AND up.active       = true
        AND up.ended_at     IS NULL
        AND up.expires_at   > NOW()
        AND up.planned_for  = p_planned_for
        AND (
          p_planned_period IS NULL
          OR up.planned_period::text = p_planned_period
        )
        -- Exclude the viewer
        AND up.user_id <> viewer_id
        -- Full eligibility matrix (gender, age, blocks, etc.)
        AND is_eligible_match(viewer_id, up.user_id)
      ORDER BY up.user_id, up.entered_at DESC
    )
    SELECT
      pl.uid               AS user_id,
      pl.etype             AS entry_type,
      pl.eat               AS entered_at,
      pl.pfor              AS planned_for,
      pl.pperiod           AS planned_period,
      p.name,
      date_part('year', age(p.birthdate))::int AS age,
      p.bio,
      COALESCE(intent.intentions, ARRAY[]::text[]) AS intentions,
      COALESCE(photo.photos,      ARRAY[]::text[]) AS photos,
      p.job_title,
      p.company_name,
      p.height_cm,
      zs.key               AS zodiac_sign,
      el.key               AS education_level,
      rs.key               AS relationship_status,
      sh.key               AS smoking_habit,
      COALESCE(fav.places,     ARRAY[]::text[]) AS favorite_places,
      COALESCE(lang.langs,     ARRAY[]::text[]) AS languages,
      COALESCE(interest.interests, ARRAY[]::text[]) AS interests,
      p.university_id,
      COALESCE(univ_place.name, p.university_name_custom) AS university_name,
      p.university_name_custom,
      p.graduation_year,
      COALESCE(p.show_university_on_home, false) AS show_university_on_home,
      p.verification_status,
      p.city_name,
      p.city_state
    FROM planners pl
    JOIN profiles p ON p.id = pl.uid
    LEFT JOIN zodiac_signs       zs ON zs.id = p.zodiac_id
    LEFT JOIN education_levels   el ON el.id = p.education_id
    LEFT JOIN relationship_status rs ON rs.id = p.relationship_id
    LEFT JOIN smoking_habits     sh ON sh.id = p.smoking_id
    LEFT JOIN places         univ_place ON univ_place.id = p.university_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT io.key) AS intentions
      FROM profile_intentions pi
      JOIN intention_options io ON io.id = pi.option_id
      WHERE pi.user_id = pl.uid
    ) intent ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(pp.url ORDER BY pp.position ASC) AS photos
      FROM profile_photos pp
      WHERE pp.user_id = pl.uid
    ) photo ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT pfp2.place_id::text) AS places
      FROM profile_favorite_places pfp2
      WHERE pfp2.user_id = pl.uid
    ) fav ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT l.key) AS langs
      FROM profile_languages pla
      JOIN languages l ON l.id = pla.language_id
      WHERE pla.user_id = pl.uid
    ) lang ON true
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT i.key) AS interests
      FROM profile_interests pi2
      JOIN interests i ON i.id = pi2.interest_id
      WHERE pi2.profile_id = pl.uid
    ) interest ON true
    -- Invisible mode: only show if they liked me
    WHERE
      p.is_invisible = false
      OR EXISTS (
        SELECT 1 FROM user_interactions ui
        WHERE ui.from_user_id = pl.uid
          AND ui.to_user_id   = viewer_id
          AND ui.action       = 'like'
          AND ui.action_expires_at > NOW()
      );
END;
$$;

GRANT EXECUTE ON FUNCTION get_planning_users_at_place(uuid, date, text, uuid)
  TO authenticated, anon;

COMMENT ON FUNCTION get_planning_users_at_place IS
'Returns eligible users planning to visit a place on a specific date/period.
Filters: entry_type=planning + planned_for match + optional period match +
is_eligible_match full matrix. Excludes the viewer. Same profile enrichment
shape as get_eligible_regulars_at_place (social hubs migration as base).
Used by the get-planning-users-at-place Edge Function for the PlanHero
"Ver quem vai" flow on community plan cards.';
