-- Create a function to delete user that bypasses the Auth API
-- This is a workaround for the Auth API bug that causes "Database error deleting user"
-- SECURITY: Only callable by service_role (edge function), NOT by regular authenticated users

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

-- SECURITY: Only grant execute to service_role (NOT authenticated)
-- This ensures only edge functions with service_role can delete users
REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO service_role;
