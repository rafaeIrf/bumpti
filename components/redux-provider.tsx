import { persistor, store } from "@/modules/store";
import { supabase } from "@/modules/supabase/client";
import React, { useEffect } from "react";
import { AppState } from "react-native";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

interface ReduxProviderProps {
  children: React.ReactNode;
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  useEffect(() => {
    let isMounted = true;
    let isSignedIn = false;

    const startRefreshIfSignedIn = () => {
      if (isSignedIn) {
        supabase.auth.startAutoRefresh();
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      isSignedIn = !!data.session;
      startRefreshIfSignedIn();
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        isSignedIn = !!session;

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          startRefreshIfSignedIn();
        }

        if (event === "SIGNED_OUT") {
          supabase.auth.stopAutoRefresh();
        }
      }
    );

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          startRefreshIfSignedIn();
          if (isSignedIn) {
            // Trigger a session check when returning to the foreground to refresh tokens if needed
            supabase.auth.getSession();
          }
        } else {
          supabase.auth.stopAutoRefresh();
        }
      }
    );

    return () => {
      isMounted = false;
      authSubscription?.subscription.unsubscribe();
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
