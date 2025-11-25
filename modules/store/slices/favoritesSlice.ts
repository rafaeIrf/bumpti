import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FavoritesState {
  placeIds: string[];
  isLoading: boolean;
  loaded: boolean;
  error?: string;
}

const initialState: FavoritesState = {
  placeIds: [],
  isLoading: false,
  loaded: false,
  error: undefined,
};

const favoritesSlice = createSlice({
  name: "favorites",
  initialState,
  reducers: {
    setFavorites: (state, action: PayloadAction<string[]>) => {
      state.placeIds = action.payload;
    },
    addFavoriteLocal: (state, action: PayloadAction<string>) => {
      if (!state.placeIds.includes(action.payload)) {
        state.placeIds.push(action.payload);
      }
    },
    removeFavoriteLocal: (state, action: PayloadAction<string>) => {
      state.placeIds = state.placeIds.filter((id) => id !== action.payload);
    },
    setFavoritesLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setFavoritesError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    },
    setFavoritesLoaded: (state, action: PayloadAction<boolean>) => {
      state.loaded = action.payload;
    },
    resetFavorites: () => initialState,
  },
});

export const {
  setFavorites,
  addFavoriteLocal,
  removeFavoriteLocal,
  setFavoritesLoading,
  setFavoritesLoaded,
  setFavoritesError,
  resetFavorites,
} = favoritesSlice.actions;

export default favoritesSlice.reducer;
