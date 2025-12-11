import { messagesApi } from "@/modules/chats/messagesApi";
import { interactionsApi } from "@/modules/interactions/interactionsApi";
import { pendingLikesApi } from "@/modules/pendingLikes/pendingLikesApi"; // Added pendingLikesApi import
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
import onboardingReducer from "./slices/onboardingSlice";
import profileReducer from "./slices/profileSlice";

// Configure persistence
const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["onboarding", "profile", "messagesApi"], // Persist onboarding, profile, messages cache
};

// Combine reducers
const rootReducer = combineReducers({
  [placesApi.reducerPath]: placesApi.reducer,
  [messagesApi.reducerPath]: messagesApi.reducer,
  [interactionsApi.reducerPath]: interactionsApi.reducer,
  [pendingLikesApi.reducerPath]: pendingLikesApi.reducer,
  onboarding: onboardingReducer,
  profile: profileReducer,
});

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
      messagesApi.middleware,
      interactionsApi.middleware,
      pendingLikesApi.middleware
    ),
});

export const persistor = persistStore(store);

// Enable refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Re-export from types for convenience
export type { AppDispatch as AppDispatchType, RootState as RootStateType } from "./types";

