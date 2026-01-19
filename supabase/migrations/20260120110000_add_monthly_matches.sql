-- =============================================================================
-- Migration: Add monthly_matches for temporal ranking differentiation
-- =============================================================================
-- This migration enables proper "Mês" vs "Geral" filtering in +Frequentados
-- by tracking matches on a monthly basis, following the monthly_checkins pattern.

-- Step 1: Add monthly_matches column to places table
ALTER TABLE places ADD COLUMN IF NOT EXISTS monthly_matches int DEFAULT 0;

-- Step 2: Create index for efficient sorting by monthly_matches
CREATE INDEX IF NOT EXISTS idx_places_monthly_matches ON places (monthly_matches DESC);

-- Step 3: Update trigger function to increment/decrement monthly_matches
-- This function already handles total_matches, now adding monthly_matches
CREATE OR REPLACE FUNCTION update_place_match_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger already exists from previous migration, no need to recreate

-- Step 4: Create monthly reset function
CREATE OR REPLACE FUNCTION reset_monthly_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE places SET monthly_matches = 0;
END;
$$;

-- Step 5: Schedule cron job for monthly reset (1st of each month at midnight UTC)
-- First, remove existing job if it exists to avoid duplicates
SELECT cron.unschedule('reset-monthly-matches') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reset-monthly-matches'
);

-- Schedule the new job
SELECT cron.schedule(
  'reset-monthly-matches',
  '0 0 1 * *',
  $$SELECT reset_monthly_matches()$$
);

-- Step 6: Update places_view to include monthly_matches
DROP VIEW IF EXISTS places_view;
CREATE OR REPLACE VIEW places_view AS
SELECT
  p.id,
  p.name,
  p.category,
  p.lat,
  p.lng,
  p.street,
  p.house_number,
  p.neighborhood,
  p.city,
  p.state,
  p.postal_code,
  p.country_code,
  p.structural_score,
  p.social_score,
  p.total_score,
  p.last_activity_at,
  p.created_at,
  p.updated_at,
  p.active,
  p.relevance_score,
  p.confidence,
  p.socials,
  p.total_checkins,
  p.monthly_checkins,
  p.total_matches,
  p.monthly_matches,
  p.original_category,
  COALESCE(reviews.avg_stars, 0)::float as review_average,
  COALESCE(reviews.total_reviews, 0)::bigint as review_count,
  COALESCE(reviews.top_tags, ARRAY[]::text[]) as review_tags
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
WHERE p.active = true;

-- Step 7: Update get_ranked_places RPC to use monthly vs total based on rank_by
-- Drop existing function to allow signature changes
DROP FUNCTION IF EXISTS get_ranked_places(float, float, float, text, int, uuid);

CREATE OR REPLACE FUNCTION get_ranked_places(
  user_lat float,
  user_lng float,
  radius_meters float default 50000,
  rank_by text default 'composite', -- 'monthly', 'total', 'composite', 'matches', or 'checkins'
  max_results int default 20,
  requesting_user_id uuid default null
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  lat float,
  lng float,
  street text,
  house_number text,
  city text,
  state text,
  country text,
  total_checkins int,
  monthly_checkins int,
  total_matches int,
  monthly_matches int,
  review_average float,
  review_count bigint,
  review_tags text[],
  dist_meters float,
  rank_position bigint,
  active_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_matches_val float;
  max_checkins_val float;
  use_monthly_data boolean;
BEGIN
  -- Determine if we should use monthly or total data
  use_monthly_data := (rank_by = 'monthly');

  -- Calculate max values for normalization within the radius
  -- Use monthly or total counters based on rank_by
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
      -- Composite score: 60% matches + 40% checkins (normalized)
      -- Use monthly or total counters based on rank_by
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
      -- Active users subquery (personalized filtering)
      (
        SELECT COUNT(*)::bigint
        FROM user_presences up
        WHERE up.place_id = p.id
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
            SELECT 1 FROM user_matches um
            WHERE um.status = 'matched'
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
      ) as active_users
    FROM places_view p
    WHERE
      st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      -- Include places with either matches or checkins (monthly or total based on rank_by)
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
    DENSE_RANK() OVER (ORDER BY r.composite_score DESC, r.dist_meters ASC) as rank_position,
    r.active_users
  FROM ranked r
  ORDER BY r.composite_score DESC, r.dist_meters ASC
  LIMIT max_results;
END;
$$;
