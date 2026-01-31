-- Add postgraduate education options
-- Adds "Fazendo pós graduação" and "Pós concluída" to education_levels

INSERT INTO education_levels (key, sort_order) VALUES
  ('postgraduate_student', 35),  -- Between graduate (30) and masters_student (40)
  ('postgraduate_degree', 45);   -- Between masters_student (40) and masters_degree (50)
