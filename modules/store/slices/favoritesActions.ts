import { store } from "@/modules/store";
import {
  addFavoriteLocal,
  removeFavoriteLocal,
  setFavorites,
  setFavoritesError,
  setFavoritesLoaded,
  setFavoritesLoading,
} from "./favoritesSlice";
import { supabase } from "@/modules/supabase/client";
import type { AppDispatch } from "../index";

export const favoritesActions = {
  setFavorites: (ids: string[]) => store.dispatch(setFavorites(ids)),
  addFavoriteLocal: (id: string) => store.dispatch(addFavoriteLocal(id)),
  removeFavoriteLocal: (id: string) => store.dispatch(removeFavoriteLocal(id)),
  setLoading: (isLoading: boolean) =>
    store.dispatch(setFavoritesLoading(isLoading)),
  setLoaded: (loaded: boolean) => store.dispatch(setFavoritesLoaded(loaded)),
  setError: (error?: string) => store.dispatch(setFavoritesError(error)),
  reset: () => store.dispatch({ type: "favorites/resetFavorites" }),
  fetchFavorites: () => fetchFavoritePlacesThunk()(store.dispatch),
  toggleFavorite: (placeId: string, shouldFavorite: boolean) =>
    toggleFavoritePlaceThunk(placeId, shouldFavorite)(store.dispatch),
};

const fetchFavoritePlacesThunk =
  () => async (dispatch: AppDispatch, getState = store.getState) => {
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
        setFavoritesError(
          err?.message || "Não foi possível carregar favoritos."
        )
      );
    } finally {
      dispatch(setFavoritesLoading(false));
    }
  };

const toggleFavoritePlaceThunk =
  (placeId: string, shouldFavorite: boolean) =>
  async (dispatch: AppDispatch) => {
    try {
      const { error } = await supabase.functions.invoke(
        "toggle-favorite-place",
        {
          body: {
            placeId,
            action: shouldFavorite ? "add" : "remove",
          },
        }
      );
      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      dispatch(
        setFavoritesError(
          err instanceof Error
            ? err.message
            : "Não foi possível atualizar favorito."
        )
      );
    }
  };
