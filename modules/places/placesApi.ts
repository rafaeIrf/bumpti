import {
  detectPlace as detectPlaceApi,
  type DetectPlaceResult,
  getFavoritePlaces as getFavoritePlacesApi,
  getNearbyPlaces as getNearbyPlacesApi,
  getPlacesByFavorites as getPlacesByFavoritesApi,
  getSuggestedPlacesByCategories as getSuggestedPlacesByCategoriesApi,
  getTrendingPlaces as getTrendingPlacesApi,
  type PlacesByCategory,
  saveSocialReview,
  searchPlacesByText as searchPlacesByTextApi,
  toggleFavoritePlace as toggleFavoritePlaceApi,
} from "@/modules/places/api";
import { setFavoritePlaces } from "@/modules/store/slices/profileSlice";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  buildNearbyCacheKey,
  mergeNearbyPlaces,
  roundToGrid,
  shouldRefetchNearby,
} from "./nearby-cache";
import { Place, PlaceCategory } from "./types";

// TTL configurations (in seconds)
// Default to short cache in dev for easier testing.
const DEV_CACHE_TTL = 60;

const CACHE_TIME = {
  NEARBY_PLACES: __DEV__ ? DEV_CACHE_TTL : 60,
  TRENDING_PLACES: __DEV__ ? DEV_CACHE_TTL : 30,
  FAVORITE_PLACES: __DEV__ ? DEV_CACHE_TTL : 300,
  PLACES_BY_FAVORITES: __DEV__ ? DEV_CACHE_TTL : 120,
  SEARCH_PLACES: __DEV__ ? DEV_CACHE_TTL : 15 * 60,
  SUGGESTED_PLACES: __DEV__ ? DEV_CACHE_TTL : 15 * 60,
  DETECTED_PLACE: __DEV__ ? DEV_CACHE_TTL : 60,
};

export const placesApi = createApi({
  reducerPath: "placesApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    "NearbyPlaces",
    "SearchPlaces",
    "TrendingPlaces",
    "FavoritePlaces",
    "DetectedPlace",
    "SuggestedPlaces",
  ],
  endpoints: (builder) => ({
    getSuggestedPlaces: builder.query<
      { data: PlacesByCategory[] },
      { latitude: number; longitude: number; categories: PlaceCategory[] }
    >({
      queryFn: async ({ latitude, longitude, categories }) => {
        try {
          const { data } = await getSuggestedPlacesByCategoriesApi(
            latitude,
            longitude,
            categories
          );
          return { data: { data } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, error, arg) => [
        {
          type: "SuggestedPlaces",
          id: `${roundToGrid(arg.latitude)}_${roundToGrid(arg.longitude)}_${arg.categories.join(",")}`,
        },
      ],
      keepUnusedDataFor: CACHE_TIME.SUGGESTED_PLACES,
    }),

    // Detect place based on user location
    detectPlace: builder.query<
      DetectPlaceResult | null,
      {
        latitude: number;
        longitude: number;
        hacc?: number;
        limit?: number;
      }
    >({
      queryFn: async ({ latitude, longitude, hacc, limit }) => {
        try {
          const result = await detectPlaceApi(latitude, longitude, hacc, limit);
          return { data: result };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, error, arg) => [
        {
          type: "DetectedPlace",
          id: `${roundToGrid(arg.latitude)}_${roundToGrid(arg.longitude)}`,
        },
      ],
      keepUnusedDataFor: CACHE_TIME.DETECTED_PLACE,
    }),
    // Get nearby places by category
    getNearbyPlaces: builder.query<
      Place[],
      {
        latitude: number;
        longitude: number;
        category: string[]; // General category name (bars, cafes, etc.)
        page?: number;
        pageSize?: number;
        sortBy?: "relevance" | "distance" | "popularity" | "rating";
        minRating?: number | null;
      }
    >({
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        buildNearbyCacheKey(queryArgs, endpointName),
      merge: (currentCache, newItems, { arg }) =>
        mergeNearbyPlaces(currentCache, newItems, arg.page ?? 1),
      forceRefetch: ({ currentArg, previousArg }) =>
        shouldRefetchNearby(currentArg, previousArg),
      queryFn: async ({
        latitude,
        longitude,
        category,
        page,
        pageSize,
        sortBy,
        minRating,
      }) => {
        try {
          const places = await getNearbyPlacesApi(
            latitude,
            longitude,
            category,
            {
              page,
              pageSize,
              sortBy,
              minRating,
            }
          );
          return { data: places as Place[] };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, error, arg) => {
        // Round coordinates to grid (~200m) for cache key
        const lat = roundToGrid(arg.latitude);
        const lng = roundToGrid(arg.longitude);
        const categoryKey = arg.category.join(",");
        return [
          {
            type: "NearbyPlaces",
            id: `${lat}_${lng}_${categoryKey}_${arg.page ?? 1}_${arg.pageSize ?? 20}_${arg.sortBy ?? "relevance"}_${arg.minRating ?? "all"}`,
          },
        ];
      },
      keepUnusedDataFor: CACHE_TIME.NEARBY_PLACES,
    }),

    // Get places sorted by community favorites count
    getPlacesByFavorites: builder.query<
      Place[],
      {
        latitude: number;
        longitude: number;
        category?: string[]; // Optional category filter
      }
    >({
      queryFn: async ({
        latitude,
        longitude,
        category,
      }) => {
        try {
          const places = await getPlacesByFavoritesApi(
            latitude,
            longitude,
            category
          );
          return { data: places as Place[] };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, error, arg) => {
        // Round coordinates to grid (~200m) for cache key
        const lat = roundToGrid(arg.latitude);
        const lng = roundToGrid(arg.longitude);
        return [
          {
            type: "NearbyPlaces",
            id: `favorites_${lat}_${lng}_${arg.category || "all"}`,
          },
        ];
      },
      keepUnusedDataFor: CACHE_TIME.PLACES_BY_FAVORITES,
    }),

    // Search places by text input
    searchPlacesByText: builder.query<
      { places: (Place & { active_users?: number })[] },
      {
        input: string;
        lat: number;
        lng: number;
        radius?: number;
        sessionToken?: string;
      }
    >({
      queryFn: async ({ input, lat, lng, radius = 20000, sessionToken }) => {
        try {
          const places = await searchPlacesByTextApi(
            input,
            lat,
            lng
          );

          return { data: { places } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, error, arg) => [
        { type: "SearchPlaces", id: `${arg.input}_${arg.lat}_${arg.lng}` },
      ],
      keepUnusedDataFor: CACHE_TIME.SEARCH_PLACES,
    }),

    // Trending places: returns places with active users count
    getTrendingPlaces: builder.query<
      { places: (Place & { active_users: number })[] },
      { lat?: number; lng?: number } | void
    >({
      queryFn: async (args) => {
        try {
          const { places } = await getTrendingPlacesApi(args?.lat, args?.lng);
          return { data: { places } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: [{ type: "TrendingPlaces", id: "list" }],
      keepUnusedDataFor: CACHE_TIME.TRENDING_PLACES,
    }),

    getFavoritePlaces: builder.query<
      { places: Place[] },
      { lat?: number; lng?: number } | void
    >({
      queryFn: async (args) => {
        try {
          const { places } = await getFavoritePlacesApi(args?.lat, args?.lng);
          return { data: { places: places as Place[] } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: [{ type: "FavoritePlaces", id: "list" }],
      keepUnusedDataFor: CACHE_TIME.FAVORITE_PLACES,
    }),

    toggleFavoritePlace: builder.mutation<
      any,
      {
        placeId: string;
        action: "add" | "remove";
        name?: string;
        emoji?: string;
        place?: Partial<Place>;
        queryArg?: { lat?: number; lng?: number };
      }
    >({
      queryFn: async ({ placeId, action }) => {
        try {
          await toggleFavoritePlaceApi({ placeId, action });
          return { data: null };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      onQueryStarted: (
        { placeId, action, queryArg, name, emoji, place },
        { dispatch, queryFulfilled, getState }
      ) => {
        // 1. Sync getFavoritePlaces cache
        const targets = [
          queryArg ?? undefined,
          undefined, // default cache entry
        ].filter(
          (value, index, self) =>
            self.findIndex((v) => JSON.stringify(v) === JSON.stringify(value)) ===
            index
        );

        const patches = targets.map((target) =>
          dispatch(
            placesApi.util.updateQueryData(
              "getFavoritePlaces",
              target as any,
              (draft) => {
                if (!draft?.places) return;
                if (action === "add") {
                  if (
                    !draft.places.some((p: any) => (p.placeId || p.id) === placeId)
                  ) {
                    const newPlace = {
                      placeId,
                      name: place?.name || name || placeId,
                      emoji: emoji || (place as any)?.emoji || "📍",
                      formattedAddress: place?.formattedAddress,
                      distance: place?.distance || 0,
                      latitude: place?.latitude || 0,
                      longitude: place?.longitude || 0,
                      types: place?.types || [],
                      review: place?.review,
                      active_users: place?.active_users || 0,
                    };
                    draft.places.push(newPlace as any);
                  }
                  return;
                }
                draft.places = draft.places.filter(
                  (p: any) => (p.placeId || p.id) !== placeId
                );
              }
            )
          )
        );

        // 2. Sync Redux profile state
        const state = getState() as any;
        const currentProfileFavorites = state.profile.data?.favoritePlaces || [];
        let newProfileFavorites = [...currentProfileFavorites];

        if (action === "add") {
          if (
            !newProfileFavorites.some((p: any) => (p.placeId || p.id) === placeId)
          ) {
            newProfileFavorites.push({
              placeId,
              name: place?.name || name || placeId,
              emoji: emoji || (place as any)?.emoji || "📍",
              formattedAddress: place?.formattedAddress,
              distance: place?.distance || 0,
              review: place?.review,
            });
          }
        } else {
          newProfileFavorites = newProfileFavorites.filter(
            (p: any) => (p.placeId || p.id) !== placeId
          );
        }

        dispatch(setFavoritePlaces(newProfileFavorites));

        queryFulfilled.catch(() => {
          patches.forEach((p) => p.undo());
          dispatch(setFavoritePlaces(currentProfileFavorites));
        });
      },
      invalidatesTags: (result, error, arg) =>
        arg.action === "add" && !arg.name && !arg.place
          ? [{ type: "FavoritePlaces", id: "list" }]
          : [],
    }),

    // Save social review and update cache with returned stats
    saveReview: builder.mutation<
      {
        review_id: string;
        place_id: string;
        stars: number;
        tags: string[];
        placeStats: {
          averageRating: number;
          reviewCount: number;
          topTags: string[];
        };
      },
      { placeId: string; rating: number; selectedVibes: string[] }
    >({
      queryFn: async ({ placeId, rating, selectedVibes }) => {
        try {
          const result = await saveSocialReview({ placeId, rating, selectedVibes });
          return { data: result };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      onQueryStarted: async ({ placeId }, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          const { placeStats } = data;
          
          // Helper to update a place's review in a cache entry
          const updatePlaceReview = (places: Place[] | undefined) => {
            if (!places) return;
            const place = places.find((p) => p.placeId === placeId);
            if (place) {
              place.review = {
                average: placeStats.averageRating,
                count: placeStats.reviewCount,
                tags: placeStats.topTags as any,
              };
            }
          };

          // Get all cache entries from the state
          const state = getState() as any;
          const placesApiState = state?.placesApi?.queries || {};

          // Iterate through all cache entries
          Object.keys(placesApiState).forEach((cacheKey) => {
            const entry = placesApiState[cacheKey];
            if (!entry?.data) return;

            // Update getNearbyPlaces caches (supports serialized keys)
            if (
              entry?.endpointName === "getNearbyPlaces" ||
              cacheKey.startsWith("getNearbyPlaces(")
            ) {
              dispatch(
                placesApi.util.updateQueryData("getNearbyPlaces", entry.originalArgs, (draft) => {
                  updatePlaceReview(draft);
                })
              );
            }

            // Update getTrendingPlaces cache
            if (cacheKey.startsWith("getTrendingPlaces(")) {
              dispatch(
                placesApi.util.updateQueryData("getTrendingPlaces", entry.originalArgs, (draft) => {
                  if (draft?.places) {
                    updatePlaceReview(draft.places as Place[]);
                  }
                })
              );
            }

            // Update getFavoritePlaces cache
            if (cacheKey.startsWith("getFavoritePlaces(")) {
              dispatch(
                placesApi.util.updateQueryData("getFavoritePlaces", entry.originalArgs, (draft) => {
                  if (draft?.places) {
                    updatePlaceReview(draft.places);
                  }
                })
              );
            }

            // Update searchPlacesByText caches
            if (cacheKey.startsWith("searchPlacesByText(")) {
              dispatch(
                placesApi.util.updateQueryData("searchPlacesByText", entry.originalArgs, (draft) => {
                  if (draft?.places) {
                    updatePlaceReview(draft.places as Place[]);
                  }
                })
              );
            }

            // Update getPlacesByFavorites cache (community favorites)
            if (cacheKey.startsWith("getPlacesByFavorites(")) {
              dispatch(
                placesApi.util.updateQueryData("getPlacesByFavorites", entry.originalArgs, (draft) => {
                  updatePlaceReview(draft);
                })
              );
            }

            // Update getSuggestedPlaces caches
            if (cacheKey.startsWith("getSuggestedPlaces(")) {
              dispatch(
                placesApi.util.updateQueryData("getSuggestedPlaces", entry.originalArgs, (draft) => {
                  if (draft?.data) {
                    for (const category of draft.data) {
                      updatePlaceReview(category.places as Place[]);
                    }
                  }
                })
              );
            }
          });
        } catch {
          // If the mutation fails, no cache update is needed
        }
      },
    }),

  }),
});

export const {
  useDetectPlaceQuery,
  useGetNearbyPlacesQuery,
  useGetPlacesByFavoritesQuery,
  useSearchPlacesByTextQuery,
  useGetTrendingPlacesQuery,
  useGetFavoritePlacesQuery,
  useToggleFavoritePlaceMutation,
  useLazyGetNearbyPlacesQuery,
  useLazySearchPlacesByTextQuery,
  useGetSuggestedPlacesQuery,
  useSaveReviewMutation,
} = placesApi;
