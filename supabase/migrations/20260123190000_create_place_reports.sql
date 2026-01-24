-- Migration: Create place_reports table
-- Description: System for users to report problems with places for manual admin curation

-- Create enum type for report reasons
CREATE TYPE place_report_reason AS ENUM (
  'closed',
  'wrong_info',
  'does_not_exist',
  'inappropriate',
  'other'
);

-- Create enum type for report status
CREATE TYPE place_report_status AS ENUM (
  'pending',
  'resolved',
  'ignored'
);

-- Create place_reports table
CREATE TABLE place_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason place_report_reason NOT NULL,
  description text,
  status place_report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id)
);

-- Create indexes for performance
CREATE INDEX idx_place_reports_place_id ON place_reports(place_id);
CREATE INDEX idx_place_reports_status ON place_reports(status);
CREATE INDEX idx_place_reports_place_status ON place_reports(place_id, status);
CREATE INDEX idx_place_reports_created_at ON place_reports(created_at DESC);

-- Enable Row Level Security
ALTER TABLE place_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can create a report
CREATE POLICY "Users can create place reports"
  ON place_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON place_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for admin panel)
CREATE POLICY "Service role full access"
  ON place_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE place_reports IS 'User reports for place issues - for manual admin curation';
COMMENT ON COLUMN place_reports.reason IS 'Single reason: closed, wrong_info, does_not_exist, inappropriate, other';
COMMENT ON COLUMN place_reports.status IS 'Workflow status: pending (default), resolved, ignored';
