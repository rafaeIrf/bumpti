-- Content Moderation Logs Table
-- Used for auditing moderation decisions and identifying repeat offenders

CREATE TABLE IF NOT EXISTS public.content_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image')),
  result TEXT NOT NULL CHECK (result IN ('approved', 'rejected', 'pending')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics and monitoring
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON public.content_moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_result ON public.content_moderation_logs(result);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON public.content_moderation_logs(created_at DESC);

-- Enable RLS (only service role can access)
ALTER TABLE public.content_moderation_logs ENABLE ROW LEVEL SECURITY;

-- No user-facing policies - only service role access via Edge Functions
COMMENT ON TABLE public.content_moderation_logs IS 'Audit log for content moderation decisions on bios and profile photos';
