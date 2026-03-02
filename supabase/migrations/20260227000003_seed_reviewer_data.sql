-- ============================================================
-- Seed reviewer: encounters com fake users
--
-- Garante que o RPC get_discover_feed retorne os fake users
-- nas seções direct_overlap/vibe_match/path_match quando o
-- reviewer fizer check-in (o bypass de is_invisible é feito
-- pela migration 000001).
--
-- NÃO adicionamos profile_favorite_places nem interesses para
-- evitar que os fake users apareçam para usuários reais.
--
-- reviewer_id : 9e5d5998-cba0-4e80-95bd-b3d94b241504
-- place_id    : 3eeaa194-1a92-41e0-912e-922a48900028
-- Constraint  : user_a_id < user_b_id (lexicographic)
-- ============================================================

DO $$
DECLARE
  v_reviewer UUID := '9e5d5998-cba0-4e80-95bd-b3d94b241504';
  v_place    UUID := '3eeaa194-1a92-41e0-912e-922a48900028';
BEGIN

  -- Ana (7399141d) < reviewer (9e5d5998)
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), '7399141d-4cb6-4982-aaf0-6e03cef4fe8b', v_reviewer, v_place, 'direct_overlap', 90, '{}', now())
  ON CONFLICT DO NOTHING;

  -- Fernanda (2903e31d) < reviewer (9e5d5998)
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), '2903e31d-4071-4ad1-ba23-2fb3dbd25933', v_reviewer, v_place, 'direct_overlap', 85, '{}', now() - interval '30 minutes')
  ON CONFLICT DO NOTHING;

  -- Beatriz (91d13ae6) < reviewer (9e5d5998)
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), '91d13ae6-8eae-47b4-8cad-853411b671d9', v_reviewer, v_place, 'vibe_match', 80, '{}', now() - interval '1 hour')
  ON CONFLICT DO NOTHING;

  -- Thiago (f018aaec) > reviewer (9e5d5998) → reviewer é user_a
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), v_reviewer, 'f018aaec-35b9-438c-90f2-4b6e62945ab3', v_place, 'vibe_match', 75, '{}', now() - interval '1 hour 30 minutes')
  ON CONFLICT DO NOTHING;

  -- Rafael (4f0b8872) < reviewer (9e5d5998)
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), '4f0b8872-cc6a-4301-b4f7-a18dd1259180', v_reviewer, v_place, 'vibe_match', 70, '{}', now() - interval '2 hours')
  ON CONFLICT DO NOTHING;

  -- Julia (161478e7) < reviewer (9e5d5998)
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), '161478e7-bf4a-4f6c-864f-34663a9503ec', v_reviewer, v_place, 'path_match', 65, '{}', now() - interval '2 hours 30 minutes')
  ON CONFLICT DO NOTHING;

  -- Pedro (1f65a02d) < reviewer (9e5d5998)
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), '1f65a02d-5715-4be8-b71a-0a7d8f79d6ac', v_reviewer, v_place, 'path_match', 60, '{}', now() - interval '3 hours')
  ON CONFLICT DO NOTHING;

  -- Lucas (d7d3d0c6) > reviewer (9e5d5998) → reviewer é user_a
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), v_reviewer, 'd7d3d0c6-5639-4857-8eda-005a9dcae592', v_place, 'path_match', 55, '{}', now() - interval '3 hours 30 minutes')
  ON CONFLICT DO NOTHING;

  -- Carlos (7d2151e1) < reviewer (9e5d5998)
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), '7d2151e1-d890-45e3-a9a6-963f6a99fee1', v_reviewer, v_place, 'path_match', 50, '{}', now() - interval '4 hours')
  ON CONFLICT DO NOTHING;

  -- Maria (a992fa02) > reviewer (9e5d5998) → reviewer é user_a
  INSERT INTO public.user_encounters (id, user_a_id, user_b_id, place_id, encounter_type, affinity_score, metadata, last_encountered_at)
  VALUES (gen_random_uuid(), v_reviewer, 'a992fa02-3f98-462c-b8f1-6aa0cdd17230', v_place, 'path_match', 45, '{}', now() - interval '4 hours 30 minutes')
  ON CONFLICT DO NOTHING;

END $$;
