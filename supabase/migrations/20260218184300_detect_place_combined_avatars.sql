-- =============================================================================
-- Migration: Update detect-place RPC to include regulars in preview_avatars
-- =============================================================================
-- Problem: get_current_place_candidate only shows active user avatars.
--   Fix: Use get_combined_place_avatars to show both active + regular avatars.
-- =============================================================================

DROP FUNCTION IF EXISTS get_current_place_candidate(uuid, float, float, text[]);

CREATE OR REPLACE FUNCTION get_current_place_candidate(
  p_user_id uuid,
  user_lat float,
  user_lng float,
  p_active_categories text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN

  -- Return the best candidate place with full information
  -- Uses get_combined_place_avatars for active + regular avatars (deduped)
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
    'preview_avatars', get_combined_place_avatars(p.id, p_user_id, 3),
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
    AND p.category = ANY(p_active_categories)
    AND ST_Contains(
      p.boundary,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
    )
  ORDER BY p.relevance_score DESC
  LIMIT 1;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_place_candidate(uuid, float, float, text[]) TO authenticated, service_role;

COMMENT ON FUNCTION get_current_place_candidate IS 
'Returns complete place information for detected location. Uses get_combined_place_avatars to show both active users and regulars. Checks for active presence and filters by active categories.';
