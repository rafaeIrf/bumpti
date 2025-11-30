import { placesApi } from "@/modules/places/placesApi";
import { messagesApi } from "@/modules/chats/messagesApi";
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
import optionsReducer from "./slices/optionsSlice";
import profileReducer from "./slices/profileSlice";

// Configure persistence
const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["onboarding", "profile", "options", "messagesApi"], // Persist onboarding, profile, options, messages cache
};

// Combine reducers
const rootReducer = combineReducers({
  [placesApi.reducerPath]: placesApi.reducer,
  [messagesApi.reducerPath]: messagesApi.reducer,
  onboarding: onboardingReducer,
  profile: profileReducer,
  options: optionsReducer,
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
    }).concat(placesApi.middleware, messagesApi.middleware),
});

export const persistor = persistStore(store);

// Enable refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
