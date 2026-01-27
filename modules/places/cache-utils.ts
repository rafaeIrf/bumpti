/**
 * Utility to update active_users count in all places caches.
 * Used when a user likes/dislikes someone to immediately decrement the count.
 */
import { placesApi } from "@/modules/places/placesApi";
import type { AppDispatch, RootState } from "@/modules/store";

type DecrementActiveUsersParams = {
  dispatch: AppDispatch;
  getState: () => RootState;
  userId: string; // user_id to remove from all places in all caches  
};

/**
 * Helper to remove user from a place's preview_avatars and decrement active_users.
 * Only decrements if the user was actually found and removed.
 */
function updatePlace(place: any, userId?: string): boolean {
  if (!place || !userId) {
    return false;
  }
  
  // Check if user exists in preview_avatars
  if (!place.preview_avatars || !Array.isArray(place.preview_avatars)) {
    return false;
  }
  
  const hadUser = place.preview_avatars.some((avatar: any) => avatar?.user_id === userId);
  
  if (!hadUser) {
    return false;
  }
  
  // Remove user from preview_avatars
  place.preview_avatars = place.preview_avatars.filter(
    (avatar: any) => avatar?.user_id !== userId
  );
  
  // Decrement active_users count only if user was removed
  if ((place as any).active_users > 0) {
    (place as any).active_users -= 1;
  }
  
  return true;
}

/**
 * Cache handler configuration for different endpoint types.
 * Defines how to extract and iterate places for each cache structure.
 */
type CacheHandler = {
  /** RTK Query endpoint name */
  endpointName: string;
  /** Function to extract places array from cache data */
  getPlaces: (draft: any) => any[] | undefined;
  /** Whether to filter out places with active_users === 0 after updates */
  filterEmptyPlaces?: boolean;
  /** Function to set filtered places back to draft (required if filterEmptyPlaces is true) */
  setPlaces?: (draft: any, places: any[]) => void;
};

/**
 * Map of cache key prefixes to their handler configurations.
 * This centralizes the logic for different cache structures:
 * - Array types: getNearbyPlaces, getRankedPlaces, getPlacesByFavorites
 * - Nested types: getTrendingPlaces, getFavoritePlaces, searchPlacesByText
 */
const CACHE_HANDLERS: Record<string, CacheHandler> = {
  getNearbyPlaces: {
    endpointName: "getNearbyPlaces",
    getPlaces: (draft) => draft, // Direct array
  },
  getTrendingPlaces: {
    endpointName: "getTrendingPlaces",
    getPlaces: (draft) => draft?.places, // Nested in { places: [...] }
    filterEmptyPlaces: true, // Filter out places with no active users
    setPlaces: (draft, places) => {
      draft.places = places;
    },
  },
  getFavoritePlaces: {
    endpointName: "getFavoritePlaces",
    getPlaces: (draft) => draft?.places,
  },
  getRankedPlaces: {
    endpointName: "getRankedPlaces",
    getPlaces: (draft) => draft, // Direct array
  },
  searchPlacesByText: {
    endpointName: "searchPlacesByText",
    getPlaces: (draft) => draft?.places,
  },
  getPlacesByFavorites: {
    endpointName: "getPlacesByFavorites",
    getPlaces: (draft) => draft, // Direct array
  },
};

/**
 * Generic helper to update a cache entry by removing userId from all places.
 * For caches with filterEmptyPlaces enabled, also removes places with active_users === 0.
 */
function handleCacheUpdate(
  dispatch: AppDispatch,
  handler: CacheHandler,
  originalArgs: any,
  userId: string
): void {
  dispatch(
    placesApi.util.updateQueryData(
      handler.endpointName as any,
      originalArgs,
      (draft) => {
        let places = handler.getPlaces(draft);
        
        // Remove userId from all places
        places?.forEach((place: any) => {
          updatePlace(place, userId);
        });
        
        // Filter out empty places if configured (e.g., for getTrendingPlaces)
        if (handler.filterEmptyPlaces && handler.setPlaces && places) {
          const filteredPlaces = places.filter(
            (place: any) => (place.active_users ?? 0) > 0
          );
          handler.setPlaces(draft, filteredPlaces);
        }
      }
    )
  );
}

/**
 * Removes a user from ALL places across ALL caches.
 * This ensures that once a user is swiped (like/dislike), they disappear
 * from discovery everywhere, not just from the specific place where the swipe happened.
 *  
 * For each place that contains the user in preview_avatars:
 * - Removes the user from preview_avatars
 * - Decrements the active_users count
 */
export function decrementActiveUsersInCaches({
  dispatch,
  getState,
  userId,
}: DecrementActiveUsersParams): void {
  const state = getState() as any;
  const placesCache = state?.placesApi?.queries || {};

  // Iterate through all cache entries
  Object.entries(placesCache).forEach(([cacheKey, entry]: [string, any]) => {
    if (!entry?.data || !entry?.originalArgs) return;

    // Find matching handler for this cache key
    const handlerKey = Object.keys(CACHE_HANDLERS).find((key) =>
      cacheKey.startsWith(key)
    );

    if (!handlerKey) return;

    try {
      const handler = CACHE_HANDLERS[handlerKey];
      handleCacheUpdate(dispatch, handler, entry.originalArgs, userId);
    } catch {
      // Ignore cache update errors
    }
  });
}

