import { supabase } from "@/modules/supabase/client";
import { useEffect, useState } from "react";

export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Initial session check
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          setIsAuthenticated(!!data.session);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn("[useAuthState] Failed to check session:", error);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    };

    checkSession();

    // Listen to auth state changes
    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setIsAuthenticated(!!session);
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authSubscription?.subscription.unsubscribe();
    };
  }, []);

  return { isAuthenticated, isLoading };
}
