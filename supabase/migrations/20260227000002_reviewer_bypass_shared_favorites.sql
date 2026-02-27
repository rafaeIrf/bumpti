-- ============================================================
-- Reviewer bypass: atualiza get_shared_favorite_users para
-- detectar o reviewer via auth.users.email em vez de UUID hardcoded.
-- UUID hardcoded quebra se o reviewer mudar de conta.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shared_favorite_users(
  p_viewer_id  uuid,
  p_min_shared integer          DEFAULT 1,
  p_limit      integer          DEFAULT 20,
  p_offset     integer          DEFAULT 0,
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL
)
RETURNS TABLE(
  other_user_id          uuid,
  shared_count           integer,
  shared_place_ids       uuid[],
  shared_place_names     text[],
  other_name             text,
  other_age              integer,
  other_photos           text[],
  other_verification_status text,
  other_bio              text,
  shared_interest_keys   text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  viewer_lat   double precision;
  viewer_lng   double precision;
  is_reviewer  boolean;
BEGIN
  -- Reviewer bypass: check via auth.users email (not hardcoded UUID)
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id    = p_viewer_id
      AND lower(email) IN ('reviewer@bumpti.com', 'reviewer_onboarding@bumpti.com')
  ) INTO is_reviewer;

  -- Use provided lat/lng or fall back to profile's stored location
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    viewer_lat := p_lat;
    viewer_lng := p_lng;
  ELSE
    SELECT p.last_lat, p.last_lng
    INTO viewer_lat, viewer_lng
    FROM profiles p
    WHERE p.id = p_viewer_id;
  END IF;

  RETURN QUERY
  WITH
  ---------------------------------------------------------------------------
  -- Source A: Shared favorite places (existing logic)
  ---------------------------------------------------------------------------
  fav_matches AS (
    SELECT
      pfp_other.user_id                           AS uid,
      COUNT(*)::integer                            AS cnt,
      ARRAY_AGG(pfp_other.place_id)                AS pids,
      ARRAY_AGG(pl.name)                           AS pnames,
      '{}'::text[]                                 AS ikeys
    FROM profile_favorite_places pfp_me
    INNER JOIN profile_favorite_places pfp_other
      ON pfp_other.place_id = pfp_me.place_id
      AND pfp_other.user_id != p_viewer_id
    INNER JOIN places pl
      ON pl.id = pfp_me.place_id
    INNER JOIN profiles tp
      ON tp.id = pfp_other.user_id
    WHERE pfp_me.user_id = p_viewer_id
      AND (tp.is_invisible IS NOT TRUE OR is_reviewer)
    GROUP BY pfp_other.user_id
    HAVING COUNT(*) >= p_min_shared
  ),
  ---------------------------------------------------------------------------
  -- Source B: Shared interests (vibes), filtered by proximity
  ---------------------------------------------------------------------------
  int_matches AS (
    SELECT
      pi_other.profile_id                         AS uid,
      COUNT(*)::integer                            AS cnt,
      '{}'::uuid[]                                 AS pids,
      '{}'::text[]                                 AS pnames,
      ARRAY_AGG(i.key)                             AS ikeys
    FROM profile_interests pi_me
    INNER JOIN profile_interests pi_other
      ON pi_other.interest_id = pi_me.interest_id
      AND pi_other.profile_id != p_viewer_id
    INNER JOIN profiles tp
      ON tp.id = pi_other.profile_id
    INNER JOIN interests i
      ON i.id = pi_me.interest_id
    WHERE pi_me.profile_id = p_viewer_id
      AND (tp.is_invisible IS NOT TRUE OR is_reviewer)
      AND (
        (viewer_lat IS NULL OR viewer_lng IS NULL)
        OR (
          tp.last_lat IS NOT NULL
          AND tp.last_lng IS NOT NULL
          AND st_dwithin(
            st_setsrid(st_makepoint(tp.last_lng, tp.last_lat), 4326)::geography,
            st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography,
            50000
          )
        )
      )
    GROUP BY pi_other.profile_id
    HAVING COUNT(*) >= 1
  ),
  ---------------------------------------------------------------------------
  -- Merge: union both sources, dedup by user
  ---------------------------------------------------------------------------
  all_rows AS (
    SELECT uid, cnt, pids, pnames, ikeys FROM fav_matches
    UNION ALL
    SELECT uid, cnt, pids, pnames, ikeys FROM int_matches
  ),
  combined AS (
    SELECT
      a.uid,
      SUM(a.cnt)::integer                           AS total_score,
      COALESCE(
        (SELECT ar.pids FROM all_rows ar WHERE ar.uid = a.uid AND ar.pids != '{}'::uuid[] LIMIT 1),
        '{}'::uuid[]
      )                                            AS pids,
      COALESCE(
        (SELECT ar.pnames FROM all_rows ar WHERE ar.uid = a.uid AND ar.pnames != '{}'::text[] LIMIT 1),
        '{}'::text[]
      )                                            AS pnames,
      COALESCE(
        (SELECT ar.ikeys FROM all_rows ar WHERE ar.uid = a.uid AND ar.ikeys != '{}'::text[] LIMIT 1),
        '{}'::text[]
      )                                            AS ikeys
    FROM all_rows a
    GROUP BY a.uid
  )
  ---------------------------------------------------------------------------
  -- Final: enrich with profile data + eligibility filter
  ---------------------------------------------------------------------------
  SELECT
    c.uid                                           AS other_user_id,
    c.total_score                                   AS shared_count,
    c.pids                                          AS shared_place_ids,
    c.pnames                                        AS shared_place_names,
    tp.name                                         AS other_name,
    EXTRACT(YEAR FROM AGE(tp.birthdate))::integer   AS other_age,
    COALESCE(ARRAY(
      SELECT pp.url FROM profile_photos pp
      WHERE pp.user_id = c.uid
      ORDER BY pp.position ASC
    ), '{}'::text[])                                AS other_photos,
    tp.verification_status                          AS other_verification_status,
    tp.bio                                          AS other_bio,
    c.ikeys                                         AS shared_interest_keys
  FROM combined c
  INNER JOIN profiles tp ON tp.id = c.uid
  WHERE is_eligible_match(p_viewer_id, c.uid)
  ORDER BY c.total_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
