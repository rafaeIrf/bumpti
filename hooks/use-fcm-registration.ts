import {
    hasFCMPermission,
    registerDeviceToken,
    setupTokenRefreshListener,
} from "@/modules/notifications";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { useEffect, useRef } from "react";

/**
 * Hook to manage FCM token registration
 * 
 * - Registers device token when user is authenticated
 * - Listens for token refresh events
 * - Re-registers on app resume if authenticated
 * 
 * Usage: Call once in app root layout
 */
export function useFCMRegistration() {
  const hasRegistered = useRef(false);

  useEffect(() => {
    let unsubscribeTokenRefresh: (() => void) | null = null;
    let unsubscribeAuthChange: (() => void) | null = null;

    const handleRegistration = async () => {
      try {
        // Check if we have FCM permission
        const hasPermission = await hasFCMPermission();
        if (!hasPermission) {
          logger.log("FCM permission not granted, skipping registration");
          return;
        }

        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          logger.log("No authenticated user, skipping FCM registration");
          hasRegistered.current = false;
          return;
        }

        // Register if not already registered in this session
        if (!hasRegistered.current) {
          const success = await registerDeviceToken();
          if (success) {
            hasRegistered.current = true;
          }
        }
      } catch (error) {
        logger.error("Error in FCM registration:", error);
      }
    };

    const handleTokenRefresh = async () => {
      // Force re-registration on token refresh
      hasRegistered.current = false;
      await handleRegistration();
    };

    // Initial registration attempt
    handleRegistration();

    // Listen for token refresh
    unsubscribeTokenRefresh = setupTokenRefreshListener(handleTokenRefresh);

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          logger.log("User signed in, registering FCM token");
          hasRegistered.current = false;
          await handleRegistration();
        } else if (event === "SIGNED_OUT") {
          logger.log("User signed out, FCM token will be deactivated");
          hasRegistered.current = false;
        }
      }
    );
    unsubscribeAuthChange = () => subscription.unsubscribe();

    // Cleanup
    return () => {
      unsubscribeTokenRefresh?.();
      unsubscribeAuthChange?.();
    };
  }, []);
}
