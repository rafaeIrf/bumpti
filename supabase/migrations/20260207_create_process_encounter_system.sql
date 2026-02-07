-- Migration: add path_match + stored procedure + trigger for encounter processing
-- Applied: 2026-02-07

-- 1. Add 'path_match' to encounter_type CHECK constraint
ALTER TABLE public.user_encounters
  DROP CONSTRAINT user_encounters_encounter_type_check;

ALTER TABLE public.user_encounters
  ADD CONSTRAINT user_encounters_encounter_type_check
  CHECK (encounter_type IN ('direct_overlap', 'routine_match', 'vibe_match', 'path_match'));

-- 2. Stored procedure: set-based encounter detection + UPSERT
CREATE OR REPLACE FUNCTION public.calculate_and_upsert_encounters(
  p_user_id     uuid,
  p_place_id    uuid,
  p_entered_at  timestamptz,
  p_ended_at    timestamptz
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_invisible boolean;
  v_effective_end timestamptz;
  v_upsert_count integer := 0;
BEGIN
  -- Privacy guard: skip if user is invisible
  SELECT is_invisible INTO v_is_invisible
  FROM profiles WHERE id = p_user_id;

  IF v_is_invisible = true THEN
    RETURN 0;
  END IF;

  v_effective_end := COALESCE(p_ended_at, now());

  WITH
  -- A) Other users at this place in last 60 days (exclude invisible)
  place_visitors AS (
    SELECT
      up.user_id   AS other_user_id,
      up.entered_at,
      COALESCE(up.ended_at, up.expires_at) AS effective_end
    FROM user_presences up
    JOIN profiles pr ON pr.id = up.user_id
    WHERE up.place_id = p_place_id
      AND up.user_id != p_user_id
      AND up.entered_at >= now() - interval '60 days'
      AND pr.is_invisible IS NOT TRUE
  ),
  -- B) Best overlap per user
  best_overlap AS (
    SELECT
      pv.other_user_id,
      MAX(GREATEST(0, EXTRACT(EPOCH FROM
        LEAST(v_effective_end, pv.effective_end) - GREATEST(p_entered_at, pv.entered_at)
      )))::integer AS overlap_seconds
    FROM place_visitors pv
    GROUP BY pv.other_user_id
  ),
  -- C) Shared interests per candidate
  shared_interests AS (
    SELECT bo.other_user_id, COUNT(*) AS shared_count
    FROM best_overlap bo
    JOIN profile_interests pi_a ON pi_a.profile_id = p_user_id
    JOIN profile_interests pi_b ON pi_b.profile_id = bo.other_user_id AND pi_b.interest_id = pi_a.interest_id
    GROUP BY bo.other_user_id
  ),
  -- D) Shared places in last 90 days
  shared_places AS (
    SELECT up_b.user_id AS other_user_id, COUNT(DISTINCT up_b.place_id) AS shared_place_count
    FROM user_presences up_a
    JOIN user_presences up_b ON up_b.place_id = up_a.place_id AND up_b.user_id != p_user_id
    WHERE up_a.user_id = p_user_id
      AND up_a.entered_at >= now() - interval '90 days'
      AND up_b.entered_at >= now() - interval '90 days'
      AND up_b.user_id IN (SELECT other_user_id FROM best_overlap)
    GROUP BY up_b.user_id
  ),
  -- E) Score + encounter type
  scored AS (
    SELECT
      bo.other_user_id,
      bo.overlap_seconds,
      COALESCE(si.shared_count, 0) AS shared_interests,
      COALESCE(sp.shared_place_count, 0) AS shared_places,
      CASE
        WHEN bo.overlap_seconds > 0 THEN 'direct_overlap'
        WHEN COALESCE(si.shared_count, 0) >= 3 THEN 'vibe_match'
        WHEN COALESCE(sp.shared_place_count, 0) >= 2 THEN 'path_match'
        ELSE 'routine_match'
      END AS best_encounter_type,
      (CASE WHEN bo.overlap_seconds > 0 THEN 50 ELSE 0 END)
      + (CASE WHEN COALESCE(si.shared_count, 0) >= 3 THEN 40 ELSE 0 END)
      + (CASE WHEN COALESCE(sp.shared_place_count, 0) >= 2 THEN 30 ELSE 0 END)
      + 20 AS total_score
    FROM best_overlap bo
    LEFT JOIN shared_interests si ON si.other_user_id = bo.other_user_id
    LEFT JOIN shared_places sp ON sp.other_user_id = bo.other_user_id
    ORDER BY bo.overlap_seconds DESC, COALESCE(si.shared_count, 0) DESC, total_score DESC
    LIMIT 50
  )
  INSERT INTO user_encounters (user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  SELECT
    LEAST(p_user_id, s.other_user_id),
    GREATEST(p_user_id, s.other_user_id),
    p_place_id,
    s.best_encounter_type,
    s.total_score,
    jsonb_build_object('overlap_seconds', s.overlap_seconds, 'shared_interests', s.shared_interests, 'shared_places', s.shared_places),
    now()
  FROM scored s
  ON CONFLICT (user_a_id, user_b_id, place_id)
  DO UPDATE SET
    affinity_score = GREATEST(user_encounters.affinity_score, EXCLUDED.affinity_score),
    encounter_type = CASE WHEN EXCLUDED.affinity_score > user_encounters.affinity_score THEN EXCLUDED.encounter_type ELSE user_encounters.encounter_type END,
    metadata = EXCLUDED.metadata,
    last_encountered_at = now();

  GET DIAGNOSTICS v_upsert_count = ROW_COUNT;
  RETURN v_upsert_count;
END;
$$;

-- 3. Trigger: fires on checkout (active: true → false)
CREATE OR REPLACE FUNCTION public.trigger_process_encounter()
RETURNS trigger AS $$
BEGIN
  IF OLD.active = true AND NEW.active = false THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://ztznqcwpthnbllgxxxoq.supabase.co/functions/v1/process-encounter',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer service_role'
        ),
        body := jsonb_build_object(
          'record', jsonb_build_object(
            'user_id', NEW.user_id,
            'place_id', NEW.place_id,
            'entered_at', NEW.entered_at,
            'ended_at', NEW.ended_at
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'process-encounter trigger failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_presence_checkout
  AFTER UPDATE ON public.user_presences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_encounter();
