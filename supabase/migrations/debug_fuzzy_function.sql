-- Debug query to verify merge_staging_to_production is using fuzzy matching
-- Run this to check if the function was updated correctly in the database

-- 1. Check if immutable_unaccent function exists
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'immutable_unaccent';

-- 2. Check if merge_staging_to_production uses immutable_unaccent
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'merge_staging_to_production'
  AND routine_type = 'FUNCTION'
  AND routine_definition LIKE '%immutable_unaccent%';

-- 3. If the above returns nothing, the function wasn't updated. Check current definition:
SELECT pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname = 'merge_staging_to_production';

-- 4. Manually test fuzzy matching logic
SELECT 
  similarity(immutable_unaccent(lower('Parque Bacacheri')), immutable_unaccent(lower('PARQUE BACACHERI'))) as exact_match,
  similarity(immutable_unaccent(lower('Parque Bacacheri')), immutable_unaccent(lower('Parque Bacacheri'))) as same_case,
  similarity(immutable_unaccent(lower('Parque Bacacheri')), immutable_unaccent(lower('Córrego do Parque Bacacheri'))) as variant_match;

-- Expected results:
-- exact_match: 1.0
-- same_case: 1.0  
-- variant_match: ~0.72-0.8
