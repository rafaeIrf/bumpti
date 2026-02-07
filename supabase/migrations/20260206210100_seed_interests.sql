-- =====================================================
-- Seed: Categorized Interests (REORGANIZED)
-- Description: Optimized structure with 7 categories and 52 interests
-- Note: Translation keys reference i18n files (pt.json, en.json, es.json)
-- Note: Zero emoji duplications, semantically coherent grouping
-- =====================================================

-- -----------------------------------------------------
-- Category 1: Gastronomia & Paladar (cat_gastronomy) - 8 items
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('brunch_time', 'cat_gastronomy', '🥐', 10),
  ('coffee_lovers', 'cat_gastronomy', '☕', 20),
  ('burger_beer', 'cat_gastronomy', '🍔', 30),
  ('sushi_experience', 'cat_gastronomy', '🍣', 40),
  ('wine_talks', 'cat_gastronomy', '🍷', 50),
  ('healthy_vibe', 'cat_gastronomy', '🥗', 60),
  ('street_food', 'cat_gastronomy', '🌮', 70),
  ('italian_dinner', 'cat_gastronomy', '🍝', 80),
  ('asian_cuisine', 'cat_gastronomy', '🍜', 90),
  ('nordestina', 'cat_gastronomy', '🫘', 100),
  ('churrasco', 'cat_gastronomy', '🥩', 110),
  ('desserts', 'cat_gastronomy', '🍫', 120),
  ('cocktails', 'cat_gastronomy', '🍹', 130);

-- -----------------------------------------------------
-- Category 2: Noite & Social (cat_nightlife) - 11 items
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('happy_hour', 'cat_nightlife', '🍻', 210),
  ('electronic_vibe', 'cat_nightlife', '🎧', 220),
  ('samba_pagode', 'cat_nightlife', '🪘', 230),
  ('rooftop_drinks', 'cat_nightlife', '🍸', 240),
  ('underground_clubs', 'cat_nightlife', '💃', 250),
  ('karaoke_night', 'cat_nightlife', '🎤', 260),
  ('live_music', 'cat_nightlife', '🎸', 270),
  ('sertanejo', 'cat_nightlife', '🤠', 280),
  ('rock_bar', 'cat_nightlife', '🤘', 290),
  ('funk_baile', 'cat_nightlife', '🔊', 300),
  ('open_bar', 'cat_nightlife', '🥂', 310);

-- -----------------------------------------------------
-- Category 3: Movimento & Esportes (cat_fitness) - 12 items
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('beach_tennis', 'cat_fitness', '🎾', 310),
  ('gym_beast', 'cat_fitness', '🏋️♂️', 320),
  ('running_crew', 'cat_fitness', '🏃♂️', 330),
  ('cycling_life', 'cat_fitness', '🚴♂️', 340),
  ('yoga_alignment', 'cat_fitness', '🧘', 350),
  ('crossfit_community', 'cat_fitness', '🤸♂️', 360),
  ('skate_longboard', 'cat_fitness', '🛹', 370),
  ('futebol', 'cat_fitness', '⚽', 380),
  ('futevolei', 'cat_fitness', '🏐', 390),
  ('surf', 'cat_fitness', '🏄', 400),
  ('swimming', 'cat_fitness', '🏊', 410),
  ('martial_arts', 'cat_fitness', '🥊', 420);

-- -----------------------------------------------------
-- Category 4: Estilo de Vida & Conexão (cat_lifestyle) - 11 items
-- Added: networking_pro (from cat_events)
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('pet_friendly', 'cat_lifestyle', '🐶', 410),
  ('tech_innovation', 'cat_lifestyle', '💻', 420),
  ('content_creators', 'cat_lifestyle', '📸', 430),
  ('remote_work', 'cat_lifestyle', '👨💻', 440),
  ('travel_addict', 'cat_lifestyle', '✈️', 450),
  ('gaming_culture', 'cat_lifestyle', '🎮', 460),
  ('fashion_style', 'cat_lifestyle', '👟', 470),
  ('networking_pro', 'cat_lifestyle', '🤝', 480),
  ('astrology', 'cat_lifestyle', '🔮', 490),
  ('self_care', 'cat_lifestyle', '🧖', 500),
  ('vinyl_music', 'cat_lifestyle', '🎵', 520);

-- -----------------------------------------------------
-- Category 5: Arte, Cultura & Conhecimento (cat_culture) - 10 items
-- Merged: entire cat_knowledge category
-- Added: theater_standup (from cat_events)
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('museum_expo', 'cat_culture', '🖼️', 510),
  ('book_club', 'cat_culture', '📚', 520),
  ('cinema_indie', 'cat_culture', '🎬', 530),
  ('language_exchange', 'cat_culture', '🗣️', 540),
  ('photography_walk', 'cat_culture', '📷', 550),
  ('street_art', 'cat_culture', '🎨', 560),
  ('library_focus', 'cat_culture', '🤫', 570),
  ('coffee_study', 'cat_culture', '📖', 580),
  ('research_innovation', 'cat_culture', '🔬', 590),
  ('theater_standup', 'cat_culture', '🎭', 600),
  ('podcast_lover', 'cat_culture', '🎙️', 610),
  ('anime_manga', 'cat_culture', '🎌', 620),
  ('board_games', 'cat_culture', '🎲', 630);

-- -----------------------------------------------------
-- Category 6: Natureza & Lazer (cat_outdoors) - 9 items
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('hiking_trail', 'cat_outdoors', '🥾', 610),
  ('sunset_lover', 'cat_outdoors', '🌅', 620),
  ('picnic_park', 'cat_outdoors', '🧺', 630),
  ('beach_vibe', 'cat_outdoors', '🏖️', 640),
  ('camping_life', 'cat_outdoors', '🏕️', 650),
  ('climbing', 'cat_outdoors', '🧗', 660),
  ('road_trip', 'cat_outdoors', '🚗', 670),
  ('gardening', 'cat_outdoors', '🌿', 680),
  ('fishing', 'cat_outdoors', '🎣', 690);

-- -----------------------------------------------------
-- Category 7: Eventos & Ao Vivo (cat_events) - 7 items
-- Merged: entire cat_stadium category
-- Removed: duplicate concerts (kept live_music in cat_nightlife)
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('match_day', 'cat_events', '⚽', 710),
  ('sports_fan', 'cat_events', '🏆', 720),
  ('arena_shows', 'cat_events', '🏟️', 730),
  ('festivals_concerts', 'cat_events', '🎉', 740),
  ('exhibitions_fairs', 'cat_events', '🎟️', 750),
  ('sports_bar', 'cat_events', '🍺', 760),
  ('tech_meetups', 'cat_events', '🚀', 770),
  ('carnival', 'cat_events', '🎊', 780),
  ('food_festivals', 'cat_events', '🍽️', 790);

-- -----------------------------------------------------
-- Category 8: Valores & Causas (cat_values) - 10 items
-- NEW category
-- -----------------------------------------------------
INSERT INTO interests (key, category_key, icon_name, position) VALUES
  ('lgbtq_ally', 'cat_values', '🏳️‍🌈', 810),
  ('sustainability', 'cat_values', '♻️', 820),
  ('animal_cause', 'cat_values', '🐾', 830),
  ('feminism', 'cat_values', '✊', 840),
  ('volunteering', 'cat_values', '💛', 850),
  ('mental_health', 'cat_values', '🧠', 860),
  ('body_positive', 'cat_values', '💪', 870),
  ('vegan_lifestyle', 'cat_values', '🌱', 880),
  ('faith_spirituality', 'cat_values', '🙏', 890),
  ('antiracism', 'cat_values', '✊🏾', 900);

-- -----------------------------------------------------
-- Summary Statistics
-- -----------------------------------------------------
-- Total: 88 interests across 8 categories
-- Distribution:
--   cat_gastronomy: 13 items
--   cat_nightlife: 11 items
--   cat_fitness: 12 items
--   cat_lifestyle: 11 items
--   cat_culture: 13 items
--   cat_outdoors: 9 items
--   cat_events: 9 items
--   cat_values: 10 items
-- 
-- Verification query:
-- SELECT category_key, COUNT(*) as total 
-- FROM interests 
-- GROUP BY category_key 
-- ORDER BY category_key;
