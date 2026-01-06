-- Migration: Add decrement_checkin_credit RPC function
-- This function decrements a user's check-in credits by 1

CREATE OR REPLACE FUNCTION public.decrement_checkin_credit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update credits, ensuring it doesn't go below 0
  UPDATE public.user_checkin_credits
  SET 
    credits = GREATEST(credits - 1, 0),
    updated_at = now()
  WHERE user_id = p_user_id
    AND credits > 0;
  
  -- If no row was updated, the user either doesn't exist or has 0 credits
  -- We don't throw an error here, just silently fail
  IF NOT FOUND THEN
    RAISE WARNING 'No credits to decrement for user %', p_user_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.decrement_checkin_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_checkin_credit(uuid) TO service_role;
