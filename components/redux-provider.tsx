import { persistor, store } from "@/modules/store";
import React from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { OptionsInitializer } from "./options-initializer";

interface ReduxProviderProps {
  children: React.ReactNode;
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <OptionsInitializer />
        {children}
      </PersistGate>
    </Provider>
  );
}
