-- Add image_count column to content_moderation_logs for batch processing
-- This tracks how many images were processed in a batch request

ALTER TABLE public.content_moderation_logs 
  ADD COLUMN IF NOT EXISTS image_count INTEGER;

-- Add comment
COMMENT ON COLUMN public.content_moderation_logs.image_count IS 
  'Number of images processed in batch requests. NULL for single image/text moderation.';

-- Update content_type constraint to include batch-images
ALTER TABLE public.content_moderation_logs 
  DROP CONSTRAINT IF EXISTS content_moderation_logs_content_type_check;

ALTER TABLE public.content_moderation_logs 
  ADD CONSTRAINT content_moderation_logs_content_type_check 
  CHECK (content_type IN ('text', 'image', 'batch-images'));
