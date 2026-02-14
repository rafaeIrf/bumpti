import React, { useEffect } from "react";
import { AppState } from "react-native";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { phoneAuthService } from "@/modules/auth/phone-auth-service";
import { fetchAndSetUserPlans } from "@/modules/plans/api";
import { fetchAndSetUserProfile } from "@/modules/profile";
import { persistor, store } from "@/modules/store";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";

interface ReduxProviderProps {
  children: React.ReactNode;
}

/**
 * Forces a server-side validation of the session.
 * This detects if the refresh_token was revoked (e.g. user logged in on another device).
 */
async function validateSessionOrLogout(): Promise<boolean> {
  logger.log("[Auth] Validating session with server...");

  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    logger.warn("[Auth] Session revoked or invalid on server", { error });
    await phoneAuthService.signOut();
    return false;
  }

  logger.log("[Auth] Session is valid", {
    expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
  });

  return true;
}

/**
 * Loads all user data (profile + plans) in parallel.
 */
async function loadUserData(): Promise<void> {
  await Promise.all([fetchAndSetUserProfile(), fetchAndSetUserPlans()]);
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  useEffect(() => {
    let mounted = true;

    logger.log("[ReduxProvider] Bootstrapping auth");

    // ---------- AUTH STATE ----------
    const { data: auth } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        logger.log("[Auth] Event:", event, { hasSession: !!session });

        if (event === "INITIAL_SESSION") {
          if (!session) return;

          supabase.auth.startAutoRefresh();

          const ok = await validateSessionOrLogout();
          if (!ok) return;

          try {
            await loadUserData();
          } catch (err) {
            logger.error("[Auth] Failed to load user data:", err);
          }
        }

        if (event === "SIGNED_IN") {
          if (!session) return;

          supabase.auth.startAutoRefresh();

          try {
            await loadUserData();
          } catch (err) {
            logger.error("[Auth] Failed to load user data:", err);
          }
        }

        if (event === "TOKEN_REFRESHED") {
          logger.log("[Auth] Token refreshed");
        }

        if (event === "SIGNED_OUT") {
          logger.warn("[Auth] User signed out");
          supabase.auth.stopAutoRefresh();
        }
      },
    );

    // ---------- APP FOREGROUND / BACKGROUND ----------
    const appState = AppState.addEventListener("change", async (state) => {
      if (!mounted) return;

      if (state === "active") {
        // Skip validation during onboarding (no profile yet)
        const hasProfile = !!store.getState().profile?.data;
        if (!hasProfile) return;

        const ok = await validateSessionOrLogout();
        if (!ok) return;

        try {
          await loadUserData();
        } catch (err) {
          logger.error("[AppState] Failed to refresh user data:", err);
        }
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      mounted = false;
      auth?.subscription.unsubscribe();
      appState.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <Provider store={store}>
      <PersistGate persistor={persistor} loading={null}>
        {children}
      </PersistGate>
    </Provider>
  );
}
