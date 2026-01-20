/**
 * Utility to update active_users count in all places caches.
 * Used when a user likes/dislikes someone to immediately decrement the count.
 */
import { placesApi } from "@/modules/places/placesApi";
import type { AppDispatch, RootState } from "@/modules/store";

type DecrementActiveUsersParams = {
  dispatch: AppDispatch;
  getState: () => RootState;
  placeId: string;
};

/**
 * Decrements the active_users count for a place across all caches.
 * This provides optimistic UI updates when a user interacts with someone,
 * since that person becomes ineligible for further interactions.
 */
export function decrementActiveUsersInCaches({
  dispatch,
  getState,
  placeId,
}: DecrementActiveUsersParams): void {
  const state = getState() as any;
  const placesCache = state?.placesApi?.queries || {};

  Object.keys(placesCache).forEach((cacheKey) => {
    const entry = placesCache[cacheKey];
    if (!entry?.data || !entry?.originalArgs) return;

    try {
      // getNearbyPlaces - array of places
      if (cacheKey.startsWith("getNearbyPlaces(")) {
        dispatch(
          placesApi.util.updateQueryData(
            "getNearbyPlaces",
            entry.originalArgs,
            (draft) => {
              const place = draft?.find(
                (p: any) => (p.placeId || p.place_id || p.id) === placeId
              );
              if (place && (place as any).active_users > 0) {
                (place as any).active_users -= 1;
              }
            }
          )
        );
      }

      // getTrendingPlaces - { places: [...] }
      if (cacheKey.startsWith("getTrendingPlaces(")) {
        dispatch(
          placesApi.util.updateQueryData(
            "getTrendingPlaces",
            entry.originalArgs,
            (draft) => {
              if (draft?.places) {
                const place = draft.places.find(
                  (p: any) => (p.placeId || p.place_id || p.id) === placeId
                );
                if (place && place.active_users > 0) {
                  place.active_users -= 1;
                }
              }
            }
          )
        );
      }

      // getFavoritePlaces - { places: [...] }
      if (cacheKey.startsWith("getFavoritePlaces(")) {
        dispatch(
          placesApi.util.updateQueryData(
            "getFavoritePlaces",
            entry.originalArgs,
            (draft) => {
              if (draft?.places) {
                const place = draft.places.find(
                  (p: any) => (p.placeId || p.place_id || p.id) === placeId
                );
                if (place && (place as any).active_users > 0) {
                  (place as any).active_users -= 1;
                }
              }
            }
          )
        );
      }

      // getRankedPlaces - array of places
      if (cacheKey.startsWith("getRankedPlaces(")) {
        dispatch(
          placesApi.util.updateQueryData(
            "getRankedPlaces",
            entry.originalArgs,
            (draft) => {
              const place = draft?.find(
                (p: any) => (p.placeId || p.place_id || p.id) === placeId
              );
              if (place && (place as any).active_users > 0) {
                (place as any).active_users -= 1;
              }
            }
          )
        );
      }

      // searchPlacesByText - { places: [...] }
      if (cacheKey.startsWith("searchPlacesByText(")) {
        dispatch(
          placesApi.util.updateQueryData(
            "searchPlacesByText",
            entry.originalArgs,
            (draft) => {
              if (draft?.places) {
                const place = draft.places.find(
                  (p: any) => (p.placeId || p.place_id || p.id) === placeId
                );
                if (place && (place as any).active_users > 0) {
                  (place as any).active_users -= 1;
                }
              }
            }
          )
        );
      }

      // getPlacesByFavorites - array of places
      if (cacheKey.startsWith("getPlacesByFavorites(")) {
        dispatch(
          placesApi.util.updateQueryData(
            "getPlacesByFavorites",
            entry.originalArgs,
            (draft) => {
              const place = draft?.find(
                (p: any) => (p.placeId || p.place_id || p.id) === placeId
              );
              if (place && (place as any).active_users > 0) {
                (place as any).active_users -= 1;
              }
            }
          )
        );
      }
    } catch {
      // Ignore cache update errors
    }
  });
}
