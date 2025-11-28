import { useEffect, useState } from "react";
import { AppState } from "react-native";
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

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadSession();
      }
    });

    return () => {
      isMounted = false;
      authSubscription?.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  return { isAuthenticated, isLoading };
}
