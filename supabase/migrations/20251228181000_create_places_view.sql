-- Create generic places_view with review aggregation
-- This view can be used across the app to get place data with review stats

CREATE OR REPLACE VIEW places_view AS
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
  p.country_code,
  p.total_score,
  p.created_at,
  p.updated_at,
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
) reviews ON true;

-- Grant access to the view
GRANT SELECT ON places_view TO authenticated;
GRANT SELECT ON places_view TO anon;
