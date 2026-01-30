-- Migration: Add Apple Reviewer OTP Bypass
-- This function allows the Apple App Store reviewer to use a static OTP code (000000)
-- The code is stored ONLY in the database, not in the app source code (prevents reverse engineering)

CREATE OR REPLACE FUNCTION public.check_reviewer_otp(p_email text, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow bypass for the specific reviewer email with static code
  -- This keeps the "master password" secure in the database
  IF lower(trim(p_email)) = 'reviewer@bumpti.com' AND p_token = '000000' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Grant access to the function via RPC
GRANT EXECUTE ON FUNCTION public.check_reviewer_otp(text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.check_reviewer_otp IS 'Validates static OTP for Apple App Store reviewer. Returns true only for reviewer@bumpti.com with code 000000.';
