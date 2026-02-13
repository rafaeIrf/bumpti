-- Add support for reviewer_onboarding@bumpti.com while keeping reviewer@bumpti.com
CREATE OR REPLACE FUNCTION public.check_reviewer_otp(p_email text, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Support both reviewer accounts with static code 000000
  IF (lower(trim(p_email)) = 'reviewer@bumpti.com' OR lower(trim(p_email)) = 'reviewer_onboarding@bumpti.com') 
     AND p_token = '000000' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.check_reviewer_otp IS 'Validates static OTP for Apple App Store reviewers. Returns true for reviewer@bumpti.com or reviewer_onboarding@bumpti.com with code 000000.';
