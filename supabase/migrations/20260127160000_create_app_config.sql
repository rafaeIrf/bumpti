-- Migration: Create app_config table for remote version control
-- This table stores minimum and latest app versions per platform

-- Create the table
CREATE TABLE app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  min_version text NOT NULL DEFAULT '1.0.0',
  latest_version text NOT NULL DEFAULT '1.0.0',
  store_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_platform UNIQUE (platform)
);

-- Add comment for documentation
COMMENT ON TABLE app_config IS 'Remote app configuration for version control. Used to enforce mandatory updates and suggest optional updates.';
COMMENT ON COLUMN app_config.min_version IS 'Minimum required version. Users with older versions will be blocked from using the app.';
COMMENT ON COLUMN app_config.latest_version IS 'Latest available version in the store. Users will be prompted to update if their version is older.';
COMMENT ON COLUMN app_config.store_url IS 'Native store URL (itms-apps:// for iOS, market:// for Android) for deep linking to app store.';

-- Enable Row Level Security
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Public read policy - anyone can read app config (including anonymous users)
CREATE POLICY "Allow public read" ON app_config
  FOR SELECT
  USING (true);

-- No insert/update/delete policies for public - only admins via service role can modify

-- Insert initial data for both platforms
INSERT INTO app_config (platform, min_version, latest_version, store_url)
VALUES 
  ('ios', '1.0.0', '1.0.0', 'itms-apps://itunes.apple.com/app/id6744408413'),
  ('android', '1.0.0', '1.0.0', 'market://details?id=com.bumpti');

-- Create index for faster lookups by platform
CREATE INDEX idx_app_config_platform ON app_config(platform);
