-- Fix: content_moderation_logs FK missing ON DELETE CASCADE
-- This causes delete_user_completely to fail when user has moderation logs

-- 1. Fix the FK constraint to include ON DELETE CASCADE
ALTER TABLE public.content_moderation_logs
  DROP CONSTRAINT IF EXISTS content_moderation_logs_user_id_fkey;

ALTER TABLE public.content_moderation_logs
  ADD CONSTRAINT content_moderation_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Also update the delete function to explicitly clean up moderation logs
-- (belt-and-suspenders approach for safety)
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Delete from public.profiles first (CASCADE will handle profile_* tables)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Delete moderation logs (added: was missing and caused FK violation)
  DELETE FROM public.content_moderation_logs WHERE user_id = target_user_id;
  
  -- Delete from auth schema
  DELETE FROM auth.identities WHERE user_id = target_user_id;
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
  
  result := json_build_object(
    'success', true,
    'user_id', target_user_id,
    'message', 'User deleted successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'user_id', target_user_id,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;

-- Maintain security: only service_role can execute
REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO service_role;
