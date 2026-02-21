-- =============================================================================
-- Migration: Enrich match_origin using both users' presence context
-- =============================================================================
-- match_origin values (new):
--   live      – both physically present (physical × physical)
--   regular   – both frequent this place (past_visitor/favorite × same)
--   planning  – both planning to go (planning/checkin_plus × same)
--   mixed     – different contexts (one live, one regular, etc.)
--
-- Entry-type → normalized origin mapping:
--   physical        → live
--   checkin_plus    → planning
--   planning        → planning
--   past_visitor    → regular
--   favorite        → regular
--
-- Combination rule (symmetric):
--   A == B  → use A   (pure pair)
--   A != B  → mixed   (e.g. one live, one regular)
--   no override on either side → live (original behaviour preserved)
-- =============================================================================

-- 1. Add match_origin_override column to user_interactions
ALTER TABLE public.user_interactions
  ADD COLUMN IF NOT EXISTS match_origin_override TEXT;

COMMENT ON COLUMN public.user_interactions.match_origin_override IS
'Raw entry_type of the TARGET user at like-time, sent by the mobile client.
 Used to compute the combined match_origin in handle_like_for_match.
 Valid values: physical, checkin_plus, planning, past_visitor, favorite.';

-- 2. Pure mapping helper (IMMUTABLE → cacheable by PG planner)
CREATE OR REPLACE FUNCTION public.entry_type_to_match_origin(entry_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE entry_type
    WHEN 'past_visitor'  THEN 'regular'
    WHEN 'favorite'      THEN 'regular'
    WHEN 'planning'      THEN 'planning'
    WHEN 'checkin_plus'  THEN 'planning'
    WHEN 'physical'      THEN 'live'
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.entry_type_to_match_origin(TEXT) IS
'Maps user_presences.entry_type to its normalized match_origin.
 Returns NULL for unknown values; callers should COALESCE to a default.';

-- 3. Update handle_like_for_match to compute combined origin from both sides.
--    The only change vs the previous version is in the fallback block
--    (encounter_origin IS NULL path): we now look at both interactions'
--    match_origin_override and combine them.
CREATE OR REPLACE FUNCTION public.handle_like_for_match()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  other_place            uuid;
  other_override         TEXT;
  match_place            uuid;
  match_place_name       text;
  match_place_category   text;
  new_match_id           uuid;
  encounter_origin       text;
  encounter_meta         jsonb;
  a_origin               text;
  b_origin               text;
BEGIN
  -- Only process likes
  IF NEW.action <> 'like' THEN
    RETURN NEW;
  END IF;

  -- Find reciprocal like (from the other user); also grab their override
  SELECT ui.place_id, ui.match_origin_override
  INTO other_place, other_override
  FROM user_interactions ui
  WHERE ui.action = 'like'
    AND ui.from_user_id = NEW.to_user_id
    AND ui.to_user_id   = NEW.from_user_id
  ORDER BY ui.created_at DESC
  LIMIT 1;

  -- No reciprocal like = no match
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine the place_id for the match
  match_place := COALESCE(NEW.place_id, other_place);

  -- Fetch place_name and place_category from places table
  SELECT p.name, p.category
  INTO match_place_name, match_place_category
  FROM places p
  WHERE p.id = match_place;

  -- Capture encounter type data from Discover system (has priority over override)
  SELECT ue.encounter_type, ue.metadata
  INTO encounter_origin, encounter_meta
  FROM user_encounters ue
  WHERE (
    ue.user_a_id = LEAST(NEW.from_user_id, NEW.to_user_id)
    AND ue.user_b_id = GREATEST(NEW.from_user_id, NEW.to_user_id)
  )
  ORDER BY ue.affinity_score DESC
  LIMIT 1;

  -- Fallback: no encounter record + place known.
  -- Combine both users' entry_type hints to determine the most accurate origin:
  --   same normalized type on both sides  → use that type  (live / regular / planning)
  --   different types (or one missing)    → 'mixed'
  --   neither side provided a hint        → 'live' (original behaviour)
  IF encounter_origin IS NULL AND match_place IS NOT NULL THEN

    -- Normalize each side (NULL entry_type → treat as 'live')
    a_origin := COALESCE(public.entry_type_to_match_origin(NEW.match_origin_override),  'live');
    b_origin := COALESCE(public.entry_type_to_match_origin(other_override),              'live');

    encounter_origin := CASE
      WHEN a_origin = b_origin THEN a_origin  -- pure pair: live/regular/planning
      ELSE 'mixed'                            -- different contexts
    END;

  END IF;

  -- Create or update the match
  INSERT INTO user_matches (
    user_a, user_b, status, matched_at,
    place_id, place_name, place_category,
    match_origin, match_metadata
  )
  VALUES (
    LEAST(NEW.from_user_id, NEW.to_user_id),
    GREATEST(NEW.from_user_id, NEW.to_user_id),
    'active',
    NOW(),
    match_place,
    match_place_name,
    match_place_category,
    encounter_origin,
    encounter_meta
  )
  ON CONFLICT (user_a, user_b)
  DO UPDATE SET
    status         = 'active',
    matched_at     = NOW(),
    place_id       = EXCLUDED.place_id,
    place_name     = EXCLUDED.place_name,
    place_category = EXCLUDED.place_category,
    match_origin   = EXCLUDED.match_origin,
    match_metadata = EXCLUDED.match_metadata;

  -- Get the match ID (whether inserted or updated)
  SELECT id INTO new_match_id
  FROM user_matches
  WHERE user_a = LEAST(NEW.from_user_id, NEW.to_user_id)
    AND user_b = GREATEST(NEW.from_user_id, NEW.to_user_id);

  -- Create or update chat
  INSERT INTO chats (match_id, place_id)
  VALUES (new_match_id, match_place)
  ON CONFLICT (match_id)
  DO UPDATE SET place_id = EXCLUDED.place_id;

  RETURN NEW;
END;
$function$;

-- 4. Document the full set of valid match_origin values
COMMENT ON COLUMN public.user_matches.match_origin IS
'How the match originated:
  live           – both physically present now (physical × physical)
  regular        – both frequent this place (past_visitor/favorite × same)
  planning       – both planning to visit (planning/checkin_plus × same)
  mixed          – different presence contexts (e.g. one live, one regular)
  direct_overlap – previously at the same place (encounter-based)
  vibe_match     – shared interests / vibes (encounter-based)
  routine_match  – same routine / places (encounter-based)
  path_match     – paths crossed (encounter-based)';
