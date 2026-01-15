-- Cleanup script for stale processing cities
-- Run this as a cron job (every hour) or manually to recover from crashed workers

-- Reset cities that have been processing for over 1 hour
-- These are likely from crashed workers or network issues
UPDATE cities_registry
SET status = 'pending',
    retry_count = GREATEST(retry_count - 1, 0),  -- Decrement but never go negative
    last_error = CONCAT(
        'Reset from stale processing state. ',
        'Original error: ', COALESCE(last_error, 'none')
    )
WHERE status = 'processing'
  AND processing_started_at < NOW() - INTERVAL '1 hour';

-- Optionally: Log what was reset (for monitoring)
SELECT 
    id,
    city_name,
    retry_count,
    processing_started_at,
    EXTRACT(EPOCH FROM (NOW() - processing_started_at))/60 as minutes_stuck
FROM cities_registry
WHERE status = 'pending'
  AND last_error LIKE 'Reset from stale%'
ORDER BY processing_started_at DESC
LIMIT 10;
