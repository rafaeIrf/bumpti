import { pendingLikesApi } from "@/modules/pendingLikes/pendingLikesApi";
import { placesApi } from "@/modules/places/placesApi";
import type { PresenceEntryType } from "@/utils/presence-badge";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  InteractionAction,
  InteractionResponse,
  interactUser as interactUserApi,
} from "./api";

export const interactionsApi = createApi({
  reducerPath: "interactionsApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    interactUser: builder.mutation<
      InteractionResponse,
      {
        toUserId: string;
        action: InteractionAction;
        placeId: string;
        /** Raw entry_type of the liked user. Backend maps to match_origin. */
        context?: PresenceEntryType | null;
      }
    >({
      queryFn: async ({ toUserId, action, placeId, context }) => {
        try {
          const result = await interactUserApi({ toUserId, action, placeId, context });
          return { data: result };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      async onQueryStarted(
        { toUserId, action, placeId },
        { dispatch, queryFulfilled, getState }
      ) {
        // Array to store all patches for rollback
        const patches: { undo: () => void }[] = [];

        // Optimistic update for pending likes (when user likes/dislikes a pending like)
        // Only update if action is 'like' or 'dislike' (not other actions)
        if (action === 'like' || action === 'dislike') {
          try {
            const patch = dispatch(
              pendingLikesApi.util.updateQueryData(
                'getPendingLikes',
                undefined,
                (draft) => {
                  if (draft?.users) {
                    // Remove the user from the list
                    draft.users = draft.users.filter((u: any) => u.user_id !== toUserId);
                    // Decrement count
                    if (draft.count > 0) {
                      draft.count = Math.max(0, draft.count - 1);
                    }
                  }
                }
              )
            );
            patches.push(patch);
          } catch (e) {
            // Cache entry doesn't exist or error, ignore
          }
        }

        // 1. Update ALL nearby places cache entries - decrement active_users
        // Get all cache entries from the state
        const state = getState() as any;
        const nearbyPlacesCache = state.placesApi?.queries;

        if (nearbyPlacesCache) {
          Object.keys(nearbyPlacesCache).forEach((key) => {
            // Check if this is a getNearbyPlaces query
            if (key.startsWith('getNearbyPlaces(')) {
              try {
                // Extract the args from the cache key
                const cacheEntry = nearbyPlacesCache[key];
                if (cacheEntry?.originalArgs) {
                  const patch = dispatch(
                    placesApi.util.updateQueryData(
                      "getNearbyPlaces",
                      cacheEntry.originalArgs,
                      (draft) => {
                        const place = draft.find(
                          (p: any) => (p.placeId || p.place_id) === placeId
                        );
                        if (place && (place as any).active_users > 0) {
                          (place as any).active_users -= 1;
                        }
                      }
                    )
                  );
                  patches.push(patch);
                }
              } catch (e) {
                // Cache entry doesn't exist or error, ignore
              }
            }
          });
        }

        // 2. Update ALL trending places cache entries - decrement active_users
        if (nearbyPlacesCache) {
          Object.keys(nearbyPlacesCache).forEach((key) => {
            // Check if this is a getTrendingPlaces query
            if (key.startsWith('getTrendingPlaces(')) {
              try {
                const cacheEntry = nearbyPlacesCache[key];
                if (cacheEntry?.originalArgs !== undefined) {
                  const patch = dispatch(
                    placesApi.util.updateQueryData(
                      "getTrendingPlaces",
                      cacheEntry.originalArgs,
                      (draft) => {
                        if (draft?.places) {
                          const place = draft.places.find(
                            (p: any) => (p.placeId || p.place_id) === placeId
                          );
                          if (place && place.active_users > 0) {
                            place.active_users -= 1;
                          }
                        }
                      }
                    )
                  );
                  patches.push(patch);
                }
              } catch (e) {
                // Cache entry doesn't exist or error, ignore
              }
            }
          });
        }

        // 3. Update ALL favorite places cache entries - decrement active_users
        if (nearbyPlacesCache) {
          Object.keys(nearbyPlacesCache).forEach((key) => {
            // Check if this is a getFavoritePlaces query
            if (key.startsWith('getFavoritePlaces(')) {
              try {
                const cacheEntry = nearbyPlacesCache[key];
                if (cacheEntry?.originalArgs !== undefined) {
                  const patch = dispatch(
                    placesApi.util.updateQueryData(
                      "getFavoritePlaces",
                      cacheEntry.originalArgs,
                      (draft) => {
                        if (draft?.places) {
                          const place = draft.places.find(
                            (p: any) => (p.placeId || p.place_id) === placeId
                          );
                          if (place && (place as any).active_users > 0) {
                            (place as any).active_users -= 1;
                          }
                        }
                      }
                    )
                  );
                  patches.push(patch);
                }
              } catch (e) {
                // Cache entry doesn't exist or error, ignore
              }
            }
          });
        }

        // 4. Update ALL search places cache entries - decrement active_users
        if (nearbyPlacesCache) {
          Object.keys(nearbyPlacesCache).forEach((key) => {
            // Check if this is a searchPlacesByText query
            if (key.startsWith('searchPlacesByText(')) {
              try {
                const cacheEntry = nearbyPlacesCache[key];
                if (cacheEntry?.originalArgs) {
                  const patch = dispatch(
                    placesApi.util.updateQueryData(
                      "searchPlacesByText",
                      cacheEntry.originalArgs,
                      (draft) => {
                        if (draft?.places) {
                          const place = draft.places.find(
                            (p: any) => (p.placeId || p.place_id) === placeId
                          );
                          if (place && (place as any).active_users > 0) {
                            (place as any).active_users -= 1;
                          }
                        }
                      }
                    )
                  );
                  patches.push(patch);
                }
              } catch (e) {
                // Cache entry doesn't exist or error, ignore
              }
            }
          });
        }

        try {
          await queryFulfilled;
          
          // Invalidate pending likes cache to trigger silent refetch
          // This ensures backend data is fresh after the interaction
          dispatch(
            pendingLikesApi.util.invalidateTags([
              { type: 'PendingLikes', id: 'LIST' },
            ])
          );
        } catch {
          // Rollback all optimistic updates on error
          patches.forEach((patch) => patch.undo());
        }
      },
    }),
  }),
});

export const { useInteractUserMutation } = interactionsApi;
