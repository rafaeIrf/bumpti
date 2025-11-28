import { getFeaturedPlaces } from "@/modules/places/api";
import { useAppSelector } from "@/modules/store/hooks";
import { favoritesActions } from "@/modules/store/slices";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCachedLocation } from "./use-cached-location";

export interface FavoritePlaceResult {
  id: string;
  name: string;
  type: string;
  address: string;
  distance: number;
}

export function useFavoritePlacesList(enabled: boolean) {
  const favoritesState = useAppSelector((state) => state.favorites);
  const { location: userLocation, loading: locationLoading } =
      useCachedLocation();
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
    if (!userLocation) {
      // Wait until location is available before fetching
      setFavoritePlacesLoading(locationLoading);
      return;
    }

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
    getFeaturedPlaces(
      userLocation.latitude,
      userLocation.longitude,
      favorites
    )
      .then((result) => {
        const mapped =
          result?.map((place: any) => ({
            id: place.placeId || place.id,
            name: place.name,
            type: place.type || "",
            address: place.formattedAddress || place.address || "",
            distance: place.distance || 0,
          })) || [];
        setFavoritePlacesData(mapped);
      })
      .finally(() => {
        setFavoritePlacesLoading(false);
        prevFavoritesRef.current = favorites;
      });
  }, [enabled, favorites, userLocation, locationLoading]);

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
