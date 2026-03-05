import { supabase } from "@/modules/supabase/client";
import { useEffect, useState } from "react";

const REVIEWER_EMAILS = [
  "reviewer@bumpti.com",
  "reviewer_onboarding@bumpti.com",
];

/**
 * Returns whether the currently authenticated user is an Apple/Google reviewer.
 * Reads the email directly from the Supabase auth session — not from the profile,
 * which may not include the email field.
 */
export function useIsReviewer(): boolean {
  const [isReviewer, setIsReviewer] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email?.toLowerCase() ?? "";
      setIsReviewer(REVIEWER_EMAILS.includes(email));
    });
  }, []);

  return isReviewer;
}
