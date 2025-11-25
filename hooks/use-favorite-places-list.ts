import { useEffect, useMemo, useRef, useState } from "react";
import { getFeaturedPlaces } from "@/modules/places/api";
import { favoritesActions } from "@/modules/store/slices";
import { useAppSelector } from "@/modules/store/hooks";

export interface FavoritePlaceResult {
  id: string;
  name: string;
  type: string;
  address: string;
}

export function useFavoritePlacesList(enabled: boolean) {
  const favoritesState = useAppSelector((state) => state.favorites);
  const favorites = favoritesState.placeIds;
  const [favoritePlacesData, setFavoritePlacesData] = useState<
    FavoritePlaceResult[]
  >([]);
  const [favoritePlacesLoading, setFavoritePlacesLoading] = useState(false);
  const prevFavoritesRef = useRef<string[]>([]);

  // Ensure IDs are fetched once
  useEffect(() => {
    if (!enabled) return;
    if (!favoritesState.loaded && !favoritesState.isLoading) {
      favoritesActions.fetchFavorites();
    }
  }, [enabled, favoritesState.isLoading, favoritesState.loaded]);

  useEffect(() => {
    if (!enabled) return;

    const prevFavorites = prevFavoritesRef.current;
    const removed = prevFavorites.filter((id) => !favorites.includes(id));
    const added = favorites.filter((id) => !prevFavorites.includes(id));

    // Nothing changed
    if (removed.length === 0 && added.length === 0) return;

    // Fast-path removals (avoid refetch)
    if (removed.length > 0 && added.length === 0) {
      setFavoritePlacesData((prev) =>
        prev.filter((p) => favorites.includes(p.id))
      );
      setFavoritePlacesLoading(false);
      prevFavoritesRef.current = favorites;
      return;
    }

    // No favorites
    if (favorites.length === 0) {
      setFavoritePlacesData([]);
      setFavoritePlacesLoading(false);
      prevFavoritesRef.current = favorites;
      return;
    }

    // Initial load or new favorites: fetch once
    setFavoritePlacesLoading(true);
    getFeaturedPlaces(favorites)
      .then((result) => {
        const mapped =
          result?.map((place: any) => ({
            id: place.placeId || place.id,
            name: place.name,
            type: place.type || "",
            address: place.formattedAddress || place.address || "",
          })) || [];
        setFavoritePlacesData(mapped);
      })
      .finally(() => {
        setFavoritePlacesLoading(false);
        prevFavoritesRef.current = favorites;
      });
  }, [enabled, favorites]);

  const isLoading =
    favoritesState.isLoading || !favoritesState.loaded || favoritePlacesLoading;

  return useMemo(
    () => ({
      favoritePlacesData,
      favoritePlacesLoading: isLoading,
    }),
    [favoritePlacesData, isLoading]
  );
}
