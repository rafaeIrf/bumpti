-- Migration: Create app_feedback table
-- Description: System for tracking user satisfaction feedback (positive/negative ratings)

-- Create app_feedback table
CREATE TABLE app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating_type text NOT NULL CHECK (rating_type IN ('positive', 'negative')),
  message text,
  platform text NOT NULL,
  app_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_app_feedback_user_id ON app_feedback(user_id);
CREATE INDEX idx_app_feedback_rating_type ON app_feedback(rating_type);
CREATE INDEX idx_app_feedback_created_at ON app_feedback(created_at DESC);
CREATE INDEX idx_app_feedback_platform ON app_feedback(platform);

-- Enable Row Level Security
ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can insert their own feedback
CREATE POLICY "Users can create their own feedback"
  ON app_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT INSERT ON app_feedback TO authenticated;
GRANT SELECT ON app_feedback TO authenticated;

-- Policy: Only service role can read feedback (admin access only)
CREATE POLICY "Service role full access"
  ON app_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE app_feedback IS 'User satisfaction feedback - tracks positive/negative ratings with optional messages';
COMMENT ON COLUMN app_feedback.rating_type IS 'Type of rating: positive or negative';
COMMENT ON COLUMN app_feedback.message IS 'Optional user feedback message';
COMMENT ON COLUMN app_feedback.platform IS 'Platform identifier: ios, android, or web';
COMMENT ON COLUMN app_feedback.app_version IS 'App version when feedback was submitted';
