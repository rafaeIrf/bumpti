import type { PlaceCategory } from "@/modules/places/types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AppState {
  activeCategories: PlaceCategory[];
  configLoaded: boolean;
}

const initialState: AppState = {
  activeCategories: [
    "bar",
    "nightclub",
    "university",
    "park",
    "cafe",
    "gym",
    "shopping",
    "library",
  ], // Fallback defaults
  configLoaded: false,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setActiveCategories: (state, action: PayloadAction<PlaceCategory[]>) => {
      state.activeCategories = action.payload;
      state.configLoaded = true;
    },
  },
});

export const { setActiveCategories } = appSlice.actions;

// Selector
export const selectActiveCategories = (state: { app: AppState }) =>
  state.app.activeCategories;

export default appSlice.reducer;
