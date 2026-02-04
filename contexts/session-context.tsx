import { identify, trackLogin, trackLogout } from "@/modules/analytics";
import { phoneAuthService } from "@/modules/auth/phone-auth-service";
import { fetchAndSetUserProfile } from "@/modules/profile/index";
import { useAppSelector } from "@/modules/store/hooks";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

type SessionContextValue = {
  /** User has valid Supabase session */
  isAuthenticated: boolean;
  /** Safe to make routing decisions (auth checked AND profile checked if authenticated) */
  isReady: boolean;
  /** User profile data (null if not authenticated or profile not loaded) */
  profile: any | null; // ProfileData from Redux
  /** Sign out the current user */
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
  isReady: false,
  profile: null,
  signOut: async () => {},
});

/**
 * Hook to access session/auth state
 */
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be wrapped in a <SessionProvider />");
  }
  return value;
}

/**
 * Session Provider - wraps the entire app with auth and profile state
 *
 * Provides a unified "isReady" state that ensures:
 * - Auth state has been checked
 * - If authenticated, profile has been fetched (or attempted)
 *
 * This prevents routing decisions before all necessary data is loaded.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [profileFetched, setProfileFetched] = useState(false);

  // Get profile from Redux store
  const profileState = useAppSelector((state) => state.profile);
  const profile = profileState.data;
  const isProfileLoading = profileState.isLoading;

  // Check initial auth state
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          setIsAuthenticated(!!data.session);
          setIsAuthLoading(false);
        }
      } catch (error) {
        logger.error("[SessionProvider] Failed to check session:", error);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsAuthLoading(false);
        }
      }
    };

    checkSession();

    // Listen to auth state changes
    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        const wasAuthenticated = isAuthenticated;
        const nowAuthenticated = !!session;

        setIsAuthenticated(nowAuthenticated);
        setIsAuthLoading(false);

        // Reset profile fetch state when auth changes
        if (wasAuthenticated !== nowAuthenticated) {
          setProfileFetched(false);
        }

        // Analytics: track login with method, reset on logout
        if (nowAuthenticated && session?.user?.id) {
          trackLogin(session.user.app_metadata?.provider);

          // Also identify the user (only by ID for privacy)
          identify(session.user.id);
        } else if (!nowAuthenticated && wasAuthenticated) {
          // trackLogout already calls reset internally
          trackLogout();
        }
      },
    );

    return () => {
      isMounted = false;
      authSubscription?.subscription.unsubscribe();
    };
  }, [isAuthenticated]);

  // Fetch profile when authenticated
  useEffect(() => {
    if (isAuthenticated && !profileFetched && !isAuthLoading) {
      const fetchProfile = async () => {
        try {
          await fetchAndSetUserProfile();
        } catch (error: any) {
          logger.error("[SessionProvider] Failed to fetch profile:", error);

          // Detect if profile doesn't exist yet (new user from social login)
          const isNotFoundError =
            error?.status === 404 ||
            error?.message?.toLowerCase()?.includes("not found") ||
            error?.message?.toLowerCase()?.includes("no rows");

          // If profile doesn't exist, that's OK - user will go to onboarding
          if (isNotFoundError) {
            logger.log(
              "[SessionProvider] No profile found - new user, will redirect to onboarding",
            );
            // Don't sign out, just mark as fetched so navigation can proceed
            setProfileFetched(true);
            return;
          }

          // Detect auth errors that indicate session is invalid
          const status = error?.status || error?.context?.status;
          const isAuthError =
            status === 401 ||
            status === 403 ||
            error?.message?.toLowerCase()?.includes("jwt") ||
            error?.message?.toLowerCase()?.includes("unauthorized");

          if (isAuthError) {
            logger.warn(
              "[SessionProvider] Auth error on profile fetch, signing out",
            );
            await phoneAuthService.signOut();
          }
        } finally {
          setProfileFetched(true);
        }
      };
      fetchProfile();
    }
  }, [isAuthenticated, profileFetched, isAuthLoading]);

  // Reset profileFetched when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setProfileFetched(false);
    }
  }, [isAuthenticated]);

  // Compute isReady state:
  // - Auth must be checked (not loading)
  // - If authenticated, profile must be fetched (or attempted)
  const isReady =
    !isAuthLoading &&
    isAuthenticated !== null &&
    (!isAuthenticated || (profileFetched && !isProfileLoading));

  const handleSignOut = async () => {
    await phoneAuthService.signOut();
  };

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated: !!isAuthenticated,
        isReady,
        profile,
        signOut: handleSignOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
