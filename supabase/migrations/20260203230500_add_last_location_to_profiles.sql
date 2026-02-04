-- =============================================================================
-- Migration: Add Last Known Location to Profiles
-- =============================================================================
-- Purpose: Track user's last known location for nearby activity notifications
-- Design: Uses GPS coordinates updated from mobile app, independent of check-ins
-- =============================================================================

-- Add location tracking columns to profiles
ALTER TABLE "public"."profiles" 
  ADD COLUMN IF NOT EXISTS "last_lat" double precision,
  ADD COLUMN IF NOT EXISTS "last_lng" double precision,
  ADD COLUMN IF NOT EXISTS "last_location_updated_at" timestamp with time zone;

-- Add index for geospatial queries (PostGIS spatial index)
CREATE INDEX IF NOT EXISTS "idx_profiles_last_location" 
  ON "public"."profiles" 
  USING gist (ST_SetSRID(ST_MakePoint("last_lng", "last_lat"), 4326))
  WHERE "last_lat" IS NOT NULL AND "last_lng" IS NOT NULL;

-- Add index for timestamp filtering
CREATE INDEX IF NOT EXISTS "idx_profiles_last_location_updated_at" 
  ON "public"."profiles" ("last_location_updated_at")
  WHERE "last_location_updated_at" IS NOT NULL;

-- Add check constraint for valid coordinates
ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "chk_last_location_valid_lat" 
  CHECK ("last_lat" IS NULL OR ("last_lat" >= -90 AND "last_lat" <= 90));

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "chk_last_location_valid_lng" 
  CHECK ("last_lng" IS NULL OR ("last_lng" >= -180 AND "last_lng" <= 180));

-- Add comment for documentation
COMMENT ON COLUMN "public"."profiles"."last_lat" IS 'Last known latitude from GPS, updated by mobile app';
COMMENT ON COLUMN "public"."profiles"."last_lng" IS 'Last known longitude from GPS, updated by mobile app';
COMMENT ON COLUMN "public"."profiles"."last_location_updated_at" IS 'Timestamp of last location update';
