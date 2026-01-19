-- Social Ranking Feature: Add monthly_checkins and create get_ranked_places RPC
-- This migration adds monthly checkin tracking and a dedicated ranking RPC

-- =============================================================================
-- PART 1: Schema Evolution - Add monthly_checkins column
-- =============================================================================

-- Add monthly_checkins column to places table
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS monthly_checkins INTEGER DEFAULT 0 NOT NULL;

-- Add index for efficient sorting by monthly_checkins
CREATE INDEX IF NOT EXISTS idx_places_monthly_checkins 
ON places (monthly_checkins DESC);

-- =============================================================================
-- PART 2: Update trigger to increment both counters
-- =============================================================================

-- Update the increment_place_checkins function to also increment monthly_checkins
CREATE OR REPLACE FUNCTION increment_place_checkins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- =============================================================================
-- PART 3: Monthly reset CRON job (runs on 1st of each month at midnight UTC)
-- =============================================================================

-- Create the reset function
CREATE OR REPLACE FUNCTION reset_monthly_checkins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE places SET monthly_checkins = 0;
END;
$$;

-- Schedule the CRON job (runs at 00:00 on the 1st of every month)
-- Using pg_cron extension which is already enabled
SELECT cron.schedule(
  'reset-monthly-checkins',
  '0 0 1 * *',
  $$SELECT reset_monthly_checkins()$$
);

-- =============================================================================
-- PART 4: Update places_view to include monthly_checkins
-- =============================================================================

-- First, check if the view exists and drop it to recreate with new column
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
  p.original_category,
  COALESCE(pr.avg_rating, 0) AS review_average,
  COALESCE(pr.review_count, 0) AS review_count,
  pr.top_tags AS review_tags
FROM places p
LEFT JOIN LATERAL (
  SELECT
    AVG(r.stars)::float AS avg_rating,
    COUNT(*)::bigint AS review_count,
    (SELECT array_agg(t.tag)
     FROM (
       SELECT unnest(r2.tags) AS tag
       FROM place_reviews r2
       WHERE r2.place_id = p.id
       GROUP BY unnest(r2.tags)
       ORDER BY COUNT(*) DESC
       LIMIT 3
     ) t
    ) AS top_tags
  FROM place_reviews r
  WHERE r.place_id = p.id
) pr ON true
WHERE p.active = true;

-- =============================================================================
-- PART 5: Create dedicated get_ranked_places RPC
-- This RPC returns places ranked by check-ins for the "Mais Frequentados" feature
-- =============================================================================

CREATE OR REPLACE FUNCTION get_ranked_places(
  user_lat float,
  user_lng float,
  radius_meters float default 50000,
  rank_by text default 'monthly', -- 'monthly' or 'total'
  max_results int default 20
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
  dist_meters float,
  rank_position bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
      st_distance(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) AS dist_meters,
      CASE 
        WHEN rank_by = 'monthly' THEN 
          DENSE_RANK() OVER (ORDER BY p.monthly_checkins DESC, st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          ) ASC)
        ELSE 
          DENSE_RANK() OVER (ORDER BY p.total_checkins DESC, st_distance(
            st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
            st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
          ) ASC)
      END as rank_position
    FROM places p
    WHERE
      st_dwithin(
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_meters
      )
      -- Only include places with checkins
      AND (
        (rank_by = 'monthly' AND p.monthly_checkins > 0)
        OR (rank_by != 'monthly' AND p.total_checkins > 0)
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
    r.dist_meters,
    r.rank_position
  FROM ranked r
  ORDER BY r.rank_position ASC
  LIMIT max_results;
END;
$$;
