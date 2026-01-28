-- Migration: Add university-related columns to profiles
-- Feature: Meu Campus - Allow users to link their profile to a university

-- Add university-related columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS university_name_custom text,
ADD COLUMN IF NOT EXISTS graduation_year integer,
ADD COLUMN IF NOT EXISTS show_university_on_home boolean NOT NULL DEFAULT true;

-- Create index for academic community queries
CREATE INDEX IF NOT EXISTS idx_profiles_university_id ON public.profiles(university_id);

-- Add constraint for graduation year range
ALTER TABLE public.profiles
ADD CONSTRAINT chk_graduation_year 
CHECK (graduation_year IS NULL OR (graduation_year >= 1950 AND graduation_year <= 2100));

-- Documentation
COMMENT ON COLUMN public.profiles.university_id IS 'FK to places table for official universities';
COMMENT ON COLUMN public.profiles.university_name_custom IS 'Custom university name when not in places table';
COMMENT ON COLUMN public.profiles.graduation_year IS 'Year of graduation or expected graduation';
COMMENT ON COLUMN public.profiles.show_university_on_home IS 'Whether to show university on home screen';
