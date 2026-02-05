-- Enhanced Content Moderation Logs Schema
-- Supports performance analysis and compliance without storing raw content

-- Rename 'result' to 'status' and add new status value
ALTER TABLE public.content_moderation_logs 
  DROP CONSTRAINT IF EXISTS content_moderation_logs_result_check;

ALTER TABLE public.content_moderation_logs 
  RENAME COLUMN result TO status;

ALTER TABLE public.content_moderation_logs 
  ADD CONSTRAINT content_moderation_logs_status_check 
  CHECK (status IN ('approved', 'rejected', 'passed_by_error'));

-- Add ai_scores column for storing OpenAI moderation scores
ALTER TABLE public.content_moderation_logs 
  ADD COLUMN IF NOT EXISTS ai_scores JSONB;

-- Rename 'reason' to 'rejection_reason' for clarity
ALTER TABLE public.content_moderation_logs 
  RENAME COLUMN reason TO rejection_reason;

-- Add index on status for faster filtering
DROP INDEX IF EXISTS idx_moderation_logs_result;
CREATE INDEX IF NOT EXISTS idx_moderation_logs_status ON public.content_moderation_logs(status);

-- Add composite index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_moderation_logs_cleanup 
  ON public.content_moderation_logs(status, created_at);

-- Update table comment
COMMENT ON TABLE public.content_moderation_logs IS 
  'Audit log for content moderation decisions. Approved logs kept 15 days, rejected 90 days. No raw content stored.';

COMMENT ON COLUMN public.content_moderation_logs.ai_scores IS 
  'Full OpenAI moderation scores object for analytics and threshold tuning';

COMMENT ON COLUMN public.content_moderation_logs.rejection_reason IS 
  'Category that caused rejection (e.g., sexual, violence) or error message for passed_by_error';

-- ============================================================================
-- CRON JOB: Automatic Log Cleanup
-- Removes approved logs > 15 days and rejected logs > 90 days
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_moderation_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_approved INT;
  deleted_rejected INT;
BEGIN
  -- Delete approved logs older than 15 days
  DELETE FROM public.content_moderation_logs
  WHERE status = 'approved' 
    AND created_at < NOW() - INTERVAL '15 days';
  GET DIAGNOSTICS deleted_approved = ROW_COUNT;

  -- Delete rejected and passed_by_error logs older than 90 days
  DELETE FROM public.content_moderation_logs
  WHERE status IN ('rejected', 'passed_by_error')
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_rejected = ROW_COUNT;

  -- Log the cleanup
  RAISE NOTICE 'Moderation logs cleanup: % approved, % rejected/error logs deleted', 
    deleted_approved, deleted_rejected;
END;
$$;

-- Schedule daily cleanup at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-moderation-logs',
  '0 3 * * *',
  $$SELECT public.cleanup_moderation_logs()$$
);

-- Grant execute permission to postgres (cron runs as postgres)
GRANT EXECUTE ON FUNCTION public.cleanup_moderation_logs() TO postgres;

-- ============================================================================
-- SECURITY: Ensure only service_role can access
-- ============================================================================

-- RLS is already enabled, with no user-facing policies
-- This ensures only service_role (used by Edge Functions) can read/write

-- Add explicit deny for anon and authenticated roles
CREATE POLICY "No access for anon" ON public.content_moderation_logs
  FOR ALL TO anon USING (false);

CREATE POLICY "No access for authenticated" ON public.content_moderation_logs
  FOR ALL TO authenticated USING (false);
