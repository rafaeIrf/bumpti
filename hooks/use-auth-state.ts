import { useEffect, useState } from "react";
import { supabase } from "@/modules/supabase/client";

export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        console.warn("Failed to fetch auth session", error);
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(!!data.session);
      }
      setIsLoading(false);
    };

    loadSession();

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
