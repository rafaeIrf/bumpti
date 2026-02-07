
-- Add match_origin and match_metadata columns to user_matches
ALTER TABLE public.user_matches
  ADD COLUMN IF NOT EXISTS match_origin TEXT,
  ADD COLUMN IF NOT EXISTS match_metadata JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.user_matches.match_origin IS 'Encounter type that led to this match: live, direct_overlap, vibe_match, routine_match, path_match';
COMMENT ON COLUMN public.user_matches.match_metadata IS 'Additional context about the match origin (e.g., additional_encounters from dedup)';

-- Update the handle_like_for_match function to capture encounter type
CREATE OR REPLACE FUNCTION public.handle_like_for_match()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  other_place uuid;
  match_place uuid;
  match_place_name text;
  match_place_category text;
  new_match_id uuid;
  encounter_origin text;
  encounter_meta jsonb;
BEGIN
  -- Only process likes
  IF NEW.action <> 'like' THEN
    RETURN NEW;
  END IF;

  -- Find reciprocal like (from the other user)
  SELECT ui.place_id INTO other_place
  FROM user_interactions ui
  WHERE ui.action = 'like'
    AND ui.from_user_id = NEW.to_user_id
    AND ui.to_user_id = NEW.from_user_id
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

  -- Capture encounter type data from Discover system
  SELECT ue.encounter_type, ue.metadata
  INTO encounter_origin, encounter_meta
  FROM user_encounters ue
  WHERE (
    (ue.user_a_id = LEAST(NEW.from_user_id, NEW.to_user_id) AND ue.user_b_id = GREATEST(NEW.from_user_id, NEW.to_user_id))
  )
  ORDER BY ue.affinity_score DESC
  LIMIT 1;

  -- Fallback: no encounter record + place exists = live match (both at location now)
  IF encounter_origin IS NULL AND match_place IS NOT NULL THEN
    encounter_origin := 'live';
  END IF;

  -- Create or update the match
  INSERT INTO user_matches (user_a, user_b, status, matched_at, place_id, place_name, place_category, match_origin, match_metadata)
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
    status = 'active',
    matched_at = NOW(),
    place_id = EXCLUDED.place_id,
    place_name = EXCLUDED.place_name,
    place_category = EXCLUDED.place_category,
    match_origin = EXCLUDED.match_origin,
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
  DO UPDATE SET
    place_id = EXCLUDED.place_id;

  RETURN NEW;
END;
$function$;
