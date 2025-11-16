import { getAuth } from "@react-native-firebase/auth";
import { useEffect, useState } from "react";

export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    // Check initial auth state
    const user = auth.currentUser;
    setIsAuthenticated(!!user);
    setIsLoading(false);

    // Listen to auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { isAuthenticated, isLoading };
}
