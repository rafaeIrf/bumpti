-- ============================================================
-- Reviewer bypass: fake users invisíveis (is_invisible = true)
-- aparecem no discover feed quando o viewer é reviewer@bumpti.com
-- ou reviewer_onboarding@bumpti.com.
--
-- A única mudança no filtro:
--   ANTES: p.is_invisible IS NOT TRUE
--   DEPOIS: (v_is_reviewer OR p.is_invisible IS NOT TRUE)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_discover_feed(
  p_viewer_id uuid,
  p_limit     integer DEFAULT 20,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE(
  encounter_id          uuid,
  other_user_id         uuid,
  place_id              uuid,
  encounter_type        text,
  affinity_score        integer,
  shared_interests_count bigint,
  metadata              jsonb,
  last_encountered_at   timestamp with time zone,
  place_name            text,
  additional_encounters jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  viewer_gender_id     integer;
  viewer_verified_only boolean;
  viewer_age_min       integer;
  viewer_age_max       integer;
  viewer_age           integer;
  v_is_reviewer        boolean := false;
BEGIN
  -- Fetch viewer preferences
  SELECT p.gender_id, p.filter_only_verified, p.age_range_min, p.age_range_max,
         EXTRACT(YEAR FROM AGE(p.birthdate))::integer
  INTO viewer_gender_id, viewer_verified_only, viewer_age_min, viewer_age_max, viewer_age
  FROM profiles p WHERE p.id = p_viewer_id;

  -- 🍎 Reviewer bypass: check if viewer is a known reviewer account
  -- SECURITY DEFINER allows reading auth.users safely
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id    = p_viewer_id
      AND lower(email) IN ('reviewer@bumpti.com', 'reviewer_onboarding@bumpti.com')
  ) INTO v_is_reviewer;

  RETURN QUERY
  WITH per_type AS (
    -----------------------------------------------------------------------
    -- Pass 1: deduplicate per (other_user_id, encounter_type)
    -- Keeps the encounter with the highest affinity_score, then most recent.
    -----------------------------------------------------------------------
    SELECT DISTINCT ON (
      CASE WHEN e.user_a_id = p_viewer_id THEN e.user_b_id ELSE e.user_a_id END,
      e.encounter_type
    )
      e.id                                                                       AS encounter_id,
      CASE WHEN e.user_a_id = p_viewer_id THEN e.user_b_id ELSE e.user_a_id END AS other_user_id,
      e.place_id,
      e.encounter_type,
      e.affinity_score,
      e.metadata,
      e.last_encountered_at
    FROM public.user_encounters e
    WHERE e.user_a_id = p_viewer_id OR e.user_b_id = p_viewer_id
    ORDER BY
      CASE WHEN e.user_a_id = p_viewer_id THEN e.user_b_id ELSE e.user_a_id END,
      e.encounter_type,
      e.affinity_score DESC,
      e.last_encountered_at DESC
  ),
  prioritized AS (
    -----------------------------------------------------------------------
    -- Pass 2: ONE row per other_user_id — pick the highest-priority type.
    -- Hierarchy: direct_overlap (1) > vibe_match (2) > anything else (3)
    -- Also collect the "losing" encounter types as additional_encounters JSONB.
    -----------------------------------------------------------------------
    SELECT DISTINCT ON (pt.other_user_id)
      pt.*,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'type',           sub.encounter_type,
          'place_name',     pl_sub.name,
          'affinity_score', sub.affinity_score
        ) ORDER BY sub.affinity_score DESC)
        FROM per_type sub
        LEFT JOIN public.places pl_sub ON pl_sub.id = sub.place_id
        WHERE sub.other_user_id = pt.other_user_id
          AND sub.encounter_id  != pt.encounter_id        -- exclude the winner
      ) AS additional_encounters
    FROM per_type pt
    ORDER BY
      pt.other_user_id,
      CASE pt.encounter_type
        WHEN 'direct_overlap' THEN 1
        WHEN 'vibe_match'     THEN 2
        ELSE 3
      END,
      pt.affinity_score DESC,
      pt.last_encountered_at DESC
  )
  -----------------------------------------------------------------------
  -- Final SELECT: join profile + place + shared interests + 8-filter matrix
  -----------------------------------------------------------------------
  SELECT
    pr.encounter_id,
    pr.other_user_id,
    pr.place_id,
    pr.encounter_type,
    pr.affinity_score,
    COALESCE(si.cnt, 0)  AS shared_interests_count,
    pr.metadata,
    pr.last_encountered_at,
    pl.name              AS place_name,
    pr.additional_encounters
  FROM prioritized pr
  JOIN   public.profiles p  ON p.id  = pr.other_user_id
  LEFT JOIN public.places pl ON pl.id = pr.place_id
  -- Shared interests (live calculation)
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.profile_interests pi_a
    JOIN public.profile_interests pi_b ON pi_a.interest_id = pi_b.interest_id
    WHERE pi_a.profile_id = p_viewer_id AND pi_b.profile_id = pr.other_user_id
  ) si ON true
  WHERE
    -- 1. Hide invisible users
    --    🍎 Reviewer bypass: reviewer sees invisible fake users too
    (v_is_reviewer OR p.is_invisible IS NOT TRUE)
    -- 2. Hide users the viewer already liked/disliked (non-expired)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_interactions ui
      WHERE ui.from_user_id = p_viewer_id AND ui.to_user_id = pr.other_user_id
        AND ui.action IN ('like', 'dislike')
        AND (ui.action_expires_at IS NULL OR ui.action_expires_at > now())
    )
    -- 3. Hide users who disliked the viewer (bidirectional, non-expired)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_interactions ui
      WHERE ui.from_user_id = pr.other_user_id AND ui.to_user_id = p_viewer_id
        AND ui.action = 'dislike'
        AND (ui.action_expires_at IS NULL OR ui.action_expires_at > now())
    )
    -- 4. Hide blocked users (bidirectional)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = p_viewer_id AND ub.blocked_id = pr.other_user_id)
         OR (ub.blocker_id = pr.other_user_id AND ub.blocked_id = p_viewer_id)
    )
    -- 5. Hide existing matches
    AND NOT EXISTS (
      SELECT 1 FROM public.user_matches m
      WHERE (m.user_a = p_viewer_id AND m.user_b = pr.other_user_id)
         OR (m.user_a = pr.other_user_id AND m.user_b = p_viewer_id)
    )
    -- 6. Gender preference bidirectional (NULL-safe)
    -- RULE 1: I must want to connect with target's gender
    AND (
      NOT EXISTS (SELECT 1 FROM public.profile_connect_with WHERE user_id = p_viewer_id)
      OR EXISTS (
        SELECT 1 FROM public.profile_connect_with pcw
        WHERE pcw.user_id = p_viewer_id AND pcw.gender_id = p.gender_id
      )
    )
    -- RULE 2: Target must want to connect with my gender
    AND (
      NOT EXISTS (SELECT 1 FROM public.profile_connect_with WHERE user_id = pr.other_user_id)
      OR EXISTS (
        SELECT 1 FROM public.profile_connect_with pcw
        WHERE pcw.user_id = pr.other_user_id AND pcw.gender_id = viewer_gender_id
      )
    )
    -- 7. Age range bidirectional
    AND EXTRACT(YEAR FROM AGE(p.birthdate))::integer BETWEEN viewer_age_min AND viewer_age_max
    AND viewer_age BETWEEN p.age_range_min AND p.age_range_max
    -- 8. Verified-only filter (if viewer has it active)
    AND (
      viewer_verified_only = false
      OR p.verification_status = 'verified'
    )
  ORDER BY pr.affinity_score DESC, pr.last_encountered_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
