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
  userId?: string; // Optional: user_id to remove from preview_avatars
};

/**
 * Helper to decrement active_users and optionally remove avatar by user_id
 */
function updatePlace(place: any, userId?: string): void {
  if (!place) return;
  
  // Decrement active_users count
  if ((place as any).active_users > 0) {
    (place as any).active_users -= 1;
  }
  
  // Remove avatar by user_id if provided
  if (userId && place.preview_avatars && Array.isArray(place.preview_avatars)) {
    place.preview_avatars = place.preview_avatars.filter(
      (avatar: any) => avatar?.user_id !== userId
    );
  }
}

/**
 * Decrements the active_users count for a place across all caches.
 * If userId is provided, also removes the user's avatar from preview_avatars.
 * This provides optimistic UI updates when a user interacts with someone,
 * since that person becomes ineligible for further interactions.
 */
export function decrementActiveUsersInCaches({
  dispatch,
  getState,
  placeId,
  userId,
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
              updatePlace(place, userId);
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
                updatePlace(place, userId);
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
                updatePlace(place, userId);
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
              updatePlace(place, userId);
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
                updatePlace(place, userId);
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
              updatePlace(place, userId);
            }
          )
        );
      }
    } catch {
      // Ignore cache update errors
    }
  });
}

