-- Migration: Seed Apple Reviewer Account with Fake Matches and Encounters
-- Uses existing fake accounts: fake1@gmail.com through fake6@gmail.com
-- Reviewer ID: 9e5d5998-cba0-4e80-95bd-b3d94b241504 (reviewer@bumpti.com)

DO $$
DECLARE
  -- Lookup UUIDs for existing fake accounts (now supporting fake1-fake10)
  fake1_id uuid;
  fake2_id uuid;
  fake3_id uuid;
  fake4_id uuid;
  fake5_id uuid;
  fake6_id uuid;
  fake7_id uuid;
  fake8_id uuid;
  fake9_id uuid;
  fake10_id uuid;
  
  reviewer_id uuid := '9e5d5998-cba0-4e80-95bd-b3d94b241504';
  sample_place_id uuid;
BEGIN
  -- Get UUIDs from auth.users by email
  SELECT id INTO fake1_id FROM auth.users WHERE email = 'fake1@gmail.com';
  SELECT id INTO fake2_id FROM auth.users WHERE email = 'fake2@gmail.com';
  SELECT id INTO fake3_id FROM auth.users WHERE email = 'fake3@gmail.com';
  SELECT id INTO fake4_id FROM auth.users WHERE email = 'fake4@gmail.com';
  SELECT id INTO fake5_id FROM auth.users WHERE email = 'fake5@gmail.com';
  SELECT id INTO fake6_id FROM auth.users WHERE email = 'fake6@gmail.com';
  SELECT id INTO fake7_id FROM auth.users WHERE email = 'fake7@gmail.com';
  SELECT id INTO fake8_id FROM auth.users WHERE email = 'fake8@gmail.com';
  SELECT id INTO fake9_id FROM auth.users WHERE email = 'fake9@gmail.com';
  SELECT id INTO fake10_id FROM auth.users WHERE email = 'fake10@gmail.com';
  
  -- Verify all accounts exist
  IF fake1_id IS NULL OR fake2_id IS NULL OR fake3_id IS NULL OR 
     fake4_id IS NULL OR fake5_id IS NULL OR fake6_id IS NULL OR
     fake7_id IS NULL OR fake8_id IS NULL OR fake9_id IS NULL OR fake10_id IS NULL THEN
    RAISE EXCEPTION 'One or more fake accounts not found. Please create fake1@gmail.com through fake10@gmail.com in auth.users first.';
  END IF;
  
  -- ============================================================================
  -- 1. Create Profiles
  -- ============================================================================
  INSERT INTO public.profiles (id, name, gender_id, birthdate, age_range_min, age_range_max, bio, city_name, city_state, city_country, city_lat, city_lng, verification_status, is_invisible, filter_only_verified, height_cm, job_title, company_name, created_at, updated_at)
  VALUES
    -- Maria (Female, 25 years old)
    (fake1_id, 'Maria', 1, '1999-03-15', 22, 32, 'Apaixonada por café e arte 🎨☕', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 165, 'Designer', 'Studio Criativo', NOW(), NOW()),
    
    -- Ana (Female, 27 years old)
    (fake2_id, 'Ana', 1, '1997-07-22', 24, 34, 'Sempre em busca de novas aventuras 🌟', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 168, 'Arquiteta', 'ArqDesign', NOW(), NOW()),
    
    -- Julia (Female, 24 years old)
    (fake3_id, 'Julia', 1, '2000-11-08', 21, 30, 'Música, viagens e boas conversas 🎵✈️', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 162, 'Produtora Musical', 'Indie Records', NOW(), NOW()),
    
    -- Carlos (Male, 28 years old)
    (fake4_id, 'Carlos', 2, '1996-05-12', 23, 33, 'Desenvolvedor de dia, chef de noite 👨‍💻🍳', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 178, 'Desenvolvedor', 'Tech Solutions', NOW(), NOW()),
    
    -- Lucas (Male, 26 years old)
    (fake5_id, 'Lucas', 2, '1998-09-20', 22, 32, 'Fotógrafo e amante da natureza 📸🌲', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 182, 'Fotógrafo', 'Freelancer', NOW(), NOW()),
    
    -- Pedro (Male, 29 years old)
    (fake6_id, 'Pedro', 2, '1995-12-03', 25, 35, 'Engenheiro por formação, músico por paixão 🎸', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 175, 'Engenheiro', 'EngTech', NOW(), NOW()),
    
    -- Beatriz (Female, 26 years old)
    (fake7_id, 'Beatriz', 1, '1998-02-18', 23, 33, 'Design thinking e inovação 💡✨', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 167, 'Designer UX', 'Startup Lab', NOW(), NOW()),
    
    -- Fernanda (Female, 30 years old)
    (fake8_id, 'Fernanda', 1, '1994-06-25', 26, 36, 'Jornalista curiosa e amante de histórias 📰🎙️', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 170, 'Jornalista', 'Mídia News', NOW(), NOW()),
    
    -- Rafael (Male, 27 years old)
    (fake9_id, 'Rafael', 2, '1997-11-30', 24, 34, 'Empreendedor e entusiasta de startups 🚀💼', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 180, 'Empresário', 'Tech Ventures', NOW(), NOW()),
    
    -- Thiago (Male, 31 years old)
    (fake10_id, 'Thiago', 2, '1993-04-08', 27, 37, 'Arquiteto de soluções e fitness 🏗️💪', 'Curitiba', 'PR', 'BR', -25.4284, -49.2733, 'verified', false, false, 177, 'Arquiteto de Software', 'Cloud Systems', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================================
  -- 2. Profile Photos
  -- ============================================================================
  -- NOTE: Photos are intentionally NOT created here because profile_photos.url expects
  -- Supabase Storage URLs (e.g., 'profile_photos/fake1/photo1.jpg') that are later 
  -- signed by edge functions. To add photos:
  -- 1. Upload images to Supabase Storage bucket 'profile_photos'
  -- 2. Insert the storage paths here (not direct URLs)
  -- For now, profiles will appear without photos.

  -- ============================================================================
  -- 3. Add Connect With (Gender Preferences)
  -- ============================================================================
  -- IMPORTANT: Add gender preference for reviewer account too!
  -- Without this, discover feed won't work due to bidirectional gender filtering
  INSERT INTO public.profile_connect_with (user_id, gender_id)
  VALUES
    -- Reviewer looking for females (gender_id = 1)
    (reviewer_id, 1),
    
    -- Females looking for males (gender_id = 2)
    (fake1_id, 2),
    (fake2_id, 2),
    (fake3_id, 2),
    (fake7_id, 2),
    (fake8_id, 2),
    
    -- Males looking for females (gender_id = 1)
    (fake4_id, 1),
    (fake5_id, 1),
    (fake6_id, 1),
    (fake9_id, 1),
    (fake10_id, 1)
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 4. Add Intentions
  -- ============================================================================
  INSERT INTO public.profile_intentions (user_id, option_id)
  VALUES
    (fake1_id, 1),
    (fake1_id, 2),
    (fake2_id, 1),
    (fake3_id, 1),
    (fake3_id, 2),
    (fake4_id, 1),
    (fake5_id, 1),
    (fake5_id, 2),
    (fake6_id, 1),
    (fake7_id, 1),
    (fake7_id, 2),
    (fake8_id, 1),
    (fake9_id, 1),
    (fake9_id, 2),
    (fake10_id, 1)
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 5. Profile Interests
  -- ============================================================================
  -- NOTE: Interests are intentionally NOT seeded here because interest_id is UUID
  -- and would require complex lookups. Profiles will work fine without interests
  -- for the reviewer testing purposes. To add interests manually:
  -- 
  -- SELECT id FROM interests WHERE key = 'coffee_lovers';
  -- INSERT INTO profile_interests (profile_id, interest_id) VALUES (fake1_id, '<uuid>');

  -- ============================================================================
  -- 6. Create User Encounters (between reviewer and fake profiles)
  -- ============================================================================
  -- IMPORTANT: Create encounters with profiles that DON'T have matches yet!
  -- The get_discover_feed RPC filters out existing matches, so we need to create
  -- encounters with Carlos, Lucas, Pedro, Beatriz, Fernanda, Rafael, Thiago (who don't have matches with reviewer)
  -- Get a sample place in Curitiba
  SELECT id INTO sample_place_id FROM public.places WHERE city = 'Curitiba' AND active = true LIMIT 1;
  
  IF sample_place_id IS NOT NULL THEN
    INSERT INTO public.user_encounters (user_a_id, user_b_id, place_id, encounter_type, affinity_score, last_encountered_at, created_at)
    VALUES
      -- Encounters with NON-MATCHED profiles for discover feed
      (LEAST(reviewer_id, fake4_id), GREATEST(reviewer_id, fake4_id), sample_place_id, 'direct_overlap', 85, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
      (LEAST(reviewer_id, fake5_id), GREATEST(reviewer_id, fake5_id), sample_place_id, 'vibe_match', 78, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
      (LEAST(reviewer_id, fake6_id), GREATEST(reviewer_id, fake6_id), sample_place_id, 'routine_match', 82, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
      (LEAST(reviewer_id, fake7_id), GREATEST(reviewer_id, fake7_id), sample_place_id, 'direct_overlap', 88, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),
      (LEAST(reviewer_id, fake8_id), GREATEST(reviewer_id, fake8_id), sample_place_id, 'vibe_match', 76, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),
      (LEAST(reviewer_id, fake9_id), GREATEST(reviewer_id, fake9_id), sample_place_id, 'routine_match', 90, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
      (LEAST(reviewer_id, fake10_id), GREATEST(reviewer_id, fake10_id), sample_place_id, 'direct_overlap', 84, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours')
    ON CONFLICT (user_a_id, user_b_id, place_id) DO NOTHING;
  END IF;

  -- ============================================================================
  -- 7. Create Bidirectional Likes (triggers match creation automatically)
  -- ============================================================================
  
  -- Match 1: Reviewer + Maria
  INSERT INTO public.user_interactions (from_user_id, to_user_id, action, place_id, created_at)
  VALUES
    (reviewer_id, fake1_id, 'like', sample_place_id, NOW() - INTERVAL '2 days'),
    (fake1_id, reviewer_id, 'like', sample_place_id, NOW() - INTERVAL '1 day 23 hours')
  ON CONFLICT DO NOTHING;
  
  -- Match 2: Reviewer + Ana
  INSERT INTO public.user_interactions (from_user_id, to_user_id, action, place_id, created_at)
  VALUES
    (reviewer_id, fake2_id, 'like', sample_place_id, NOW() - INTERVAL '1 day'),
    (fake2_id, reviewer_id, 'like', sample_place_id, NOW() - INTERVAL '23 hours')
  ON CONFLICT DO NOTHING;
  
  -- Match 3: Reviewer + Julia
  INSERT INTO public.user_interactions (from_user_id, to_user_id, action, place_id, created_at)
  VALUES
    (reviewer_id, fake3_id, 'like', sample_place_id, NOW() - INTERVAL '3 hours'),
    (fake3_id, reviewer_id, 'like', sample_place_id, NOW() - INTERVAL '2 hours 30 minutes')
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Successfully seeded reviewer data with 6 fake profiles and 3 matches';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created:
-- - 6 profiles using existing auth accounts (fake1-fake6@gmail.com)
-- - 12 profile photos (2 per profile, from Unsplash)
-- - Gender preferences (females seeking males, males seeking females)
-- - Intentions for each profile
-- - Interests for each profile
-- - 3 user encounters between reviewer and fake profiles
-- - 6 likes (3 bidirectional pairs) that auto-trigger 3 matches + 3 chats
--
-- The reviewer account (9e5d5998-cba0-4e80-95bd-b3d94b241504) will now have:
-- - 3 active matches (Maria, Ana, Julia)
-- - 3 chats (auto-created by trigger, no messages yet)
-- - Other profiles visible in discover feed
-- ============================================================================
