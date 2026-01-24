-- =====================================================
-- ADMIN SQL QUERIES FOR PLACE REPORTS
-- Manual curation dashboard queries
-- =====================================================

-- =====================================================
-- 1. LIST PLACES WITH MOST PENDING REPORTS
-- Use this to prioritize which places need attention
-- =====================================================
SELECT 
    p.name AS place_name,
    p.id AS place_id,
    COUNT(pr.id) AS pending_reports_count,
    MAX(pr.created_at) AS most_recent_report
FROM places p
INNER JOIN place_reports pr ON p.id = pr.place_id
WHERE pr.status = 'pending'
GROUP BY p.id, p.name
ORDER BY pending_reports_count DESC, most_recent_report DESC
LIMIT 50;


-- =====================================================
-- 2. VIEW ALL REPORTS FOR A SPECIFIC PLACE
-- Replace 'PLACE_UUID_HERE' with the actual place_id
-- =====================================================
SELECT 
    pr.id AS report_id,
    pr.reason,
    pr.description,
    pr.proposed_data,
    pr.status,
    pr.created_at,
    prof.name AS reporter_name,
    prof.id AS reporter_id
FROM place_reports pr
INNER JOIN profiles prof ON pr.user_id = prof.id
WHERE pr.place_id = 'PLACE_UUID_HERE'
ORDER BY pr.created_at DESC;


-- =====================================================
-- 3. VIEW ALL PENDING REPORTS WITH DETAILS
-- Full list of pending reports for review
-- =====================================================
SELECT 
    pr.id AS report_id,
    p.name AS place_name,
    p.address AS place_address,
    pr.reason,
    pr.description,
    pr.proposed_data,
    pr.created_at,
    prof.name AS reporter_name
FROM place_reports pr
INNER JOIN places p ON pr.place_id = p.id
INNER JOIN profiles prof ON pr.user_id = prof.id
WHERE pr.status = 'pending'
ORDER BY pr.created_at DESC
LIMIT 100;


-- =====================================================
-- 4. MARK REPORT AS RESOLVED
-- Replace 'REPORT_UUID_HERE' and 'ADMIN_UUID_HERE'
-- =====================================================
UPDATE place_reports
SET 
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = 'ADMIN_UUID_HERE'
WHERE id = 'REPORT_UUID_HERE';


-- =====================================================
-- 5. MARK REPORT AS IGNORED
-- Use when report is spam or invalid
-- Replace 'REPORT_UUID_HERE' and 'ADMIN_UUID_HERE'
-- =====================================================
UPDATE place_reports
SET 
    status = 'ignored',
    resolved_at = NOW(),
    resolved_by = 'ADMIN_UUID_HERE'
WHERE id = 'REPORT_UUID_HERE';


-- =====================================================
-- 6. BULK UPDATE: MARK ALL REPORTS FOR A PLACE AS RESOLVED
-- Use after fixing a place's information
-- Replace 'PLACE_UUID_HERE' and 'ADMIN_UUID_HERE'
-- =====================================================
UPDATE place_reports
SET 
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = 'ADMIN_UUID_HERE'
WHERE place_id = 'PLACE_UUID_HERE'
  AND status = 'pending';


-- =====================================================
-- 7. REPORT STATISTICS
-- Overview of report system health
-- =====================================================
SELECT 
    status,
    COUNT(*) AS count,
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest
FROM place_reports
GROUP BY status
ORDER BY status;


-- =====================================================
-- 8. MOST REPORTED REASONS (OVERALL)
-- Understand what issues are most common
-- =====================================================
SELECT 
    reason,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM place_reports
GROUP BY reason
ORDER BY count DESC;


-- =====================================================
-- 9. RECENT REPORTS (LAST 7 DAYS)
-- Quick view of recent activity
-- =====================================================
SELECT 
    pr.id,
    p.name AS place_name,
    pr.reason,
    pr.description,
    pr.status,
    pr.created_at
FROM place_reports pr
INNER JOIN places p ON pr.place_id = p.id
WHERE pr.created_at >= NOW() - INTERVAL '7 days'
ORDER BY pr.created_at DESC;


-- =====================================================
-- 10. FREQUENT REPORTERS
-- Identify users who report frequently (could be helpful or spam)
-- =====================================================
SELECT 
    prof.name AS user_name,
    prof.id AS user_id,
    COUNT(*) AS total_reports,
    SUM(CASE WHEN pr.status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
    SUM(CASE WHEN pr.status = 'ignored' THEN 1 ELSE 0 END) AS ignored_count
FROM place_reports pr
INNER JOIN profiles prof ON pr.user_id = prof.id
GROUP BY prof.id, prof.name
HAVING COUNT(*) >= 3
ORDER BY total_reports DESC;
