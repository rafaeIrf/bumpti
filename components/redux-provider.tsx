import { persistor, store } from "@/modules/store";
import { supabase } from "@/modules/supabase/client";
import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { OptionsInitializer } from "./options-initializer";

interface ReduxProviderProps {
  children: React.ReactNode;
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    return () => {
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <OptionsInitializer />
        {children}
      </PersistGate>
    </Provider>
  );
}
