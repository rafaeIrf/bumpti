import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { supabase } from "@/modules/supabase/client";
import type { AppDispatch, RootState } from "../index";

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

export const fetchFavoritePlaces =
  () => async (dispatch: AppDispatch, getState: () => RootState) => {
    const { favorites } = getState();
    if (favorites.isLoading) return;
    dispatch(setFavoritesLoading(true));
    dispatch(setFavoritesError(undefined));
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-favorite-places"
      );
      if (error) throw new Error(error.message);
      dispatch(setFavorites(data.placeIds ?? []));
      dispatch(setFavoritesLoaded(true));
    } catch (err: any) {
      dispatch(
        setFavoritesError(err?.message || "Não foi possível carregar favoritos.")
      );
    } finally {
      dispatch(setFavoritesLoading(false));
    }
  };

export const toggleFavoritePlace =
  (placeId: string, isFavorite: boolean) =>
  async (dispatch: AppDispatch) => {
    // optimistic update
    if (isFavorite) {
      dispatch(removeFavoriteLocal(placeId));
    } else {
      dispatch(addFavoriteLocal(placeId));
    }

    try {
      const { error } = await supabase.functions.invoke(
        "toggle-favorite-place",
        {
          body: {
            placeId,
            action: isFavorite ? "remove" : "add",
          },
        }
      );
      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      // revert on failure
      if (isFavorite) {
        dispatch(addFavoriteLocal(placeId));
      } else {
        dispatch(removeFavoriteLocal(placeId));
      }
      dispatch(
        setFavoritesError(
          err instanceof Error
            ? err.message
            : "Não foi possível atualizar favorito."
        )
      );
    }
  };

export default favoritesSlice.reducer;
