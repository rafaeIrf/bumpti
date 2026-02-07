import { discoverApi } from "@/modules/discover/discoverApi";
import { interactionsApi } from "@/modules/interactions/interactionsApi";
import { pendingLikesApi } from "@/modules/pendingLikes/pendingLikesApi";
import { placesApi } from "@/modules/places/placesApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import {
    FLUSH,
    PAUSE,
    PERSIST,
    persistReducer,
    persistStore,
    PURGE,
    REGISTER,
    REHYDRATE,
} from "redux-persist";
import appReducer from "./slices/appSlice";
import onboardingReducer from "./slices/onboardingSlice";
import profileReducer from "./slices/profileSlice";

// Configure persistence
const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["onboarding", "profile"], // Don't persist API states (RTKQ)
};

// Define action type
const RESET_STORE = "RESET_STORE";

// Combine reducers
const appReducer_combined = combineReducers({
  [placesApi.reducerPath]: placesApi.reducer,
  [interactionsApi.reducerPath]: interactionsApi.reducer,
  [pendingLikesApi.reducerPath]: pendingLikesApi.reducer,
  [discoverApi.reducerPath]: discoverApi.reducer,
  app: appReducer,
  onboarding: onboardingReducer,
  profile: profileReducer,
});

// Root reducer with reset capability
const rootReducer = (state: any, action: any) => {
  if (action.type === RESET_STORE) {
    // Check if we need to purge storage here as well, but usually handled by purge helper
    state = undefined;
  }
  return appReducer_combined(state, action);
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      placesApi.middleware,
      interactionsApi.middleware,
      pendingLikesApi.middleware,
      discoverApi.middleware
    ),
});

export const persistor = persistStore(store);

/**
 * Resets the entire Redux store and clears persisted storage.
 * Use this on logout.
 */
export const resetGlobalStore = async () => {
  await persistor.purge();
  store.dispatch({ type: RESET_STORE });
};

// Enable refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Re-export from types for convenience
export type { AppDispatch as AppDispatchType, RootState as RootStateType } from "./types";

