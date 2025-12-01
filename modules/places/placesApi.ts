import {
  getFavoritePlaces as getFavoritePlacesApi,
  getNearbyPlaces as getNearbyPlacesApi,
  getTrendingPlaces as getTrendingPlacesApi,
  searchPlacesByText as searchPlacesByTextApi,
  toggleFavoritePlace as toggleFavoritePlaceApi,
} from "@/modules/places/api";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { Place, PlaceType } from "./types";

// TTL configurations (in seconds)
// Google Places API allows caching lat/lng for up to 30 days
// Reference: https://cloud.google.com/maps-platform/terms/maps-service-terms Section 10.3
const CACHE_TIME = {
  NEARBY_PLACES: __DEV__ ? 1 * 60 : 30 * 24 * 60 * 60, // 30 days - Google's maximum allowed cache time
  SEARCH_PLACES: __DEV__ ? 1 * 60 : 30 * 24 * 60 * 60, // 30 days - search results cache
  FAVORITE_PLACES: __DEV__ ? 30 : 5 * 60, // shorter cache; keep fresh
  TRENDING_PLACES: __DEV__ ? 10 : 30, // 30 seconds - very short cache for real-time updates
};

// Round coordinates to create cache grid (approximately 200m precision)
// 0.002 degrees ≈ 222m at equator
const roundToGrid = (coord: number): number => {
  return Math.round(coord / 0.002) * 0.002;
};

export const placesApi = createApi({
  reducerPath: "placesApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    "NearbyPlaces",
    "SearchPlaces",
    "TrendingPlaces",
    "FavoritePlaces",
  ],
  endpoints: (builder) => ({
    // Get nearby places by types
    getNearbyPlaces: builder.query<
      Place[],
      {
        latitude: number;
        longitude: number;
        types: PlaceType[];
        rankPreference?: "POPULARITY" | "DISTANCE";
        radius?: number;
        maxResultCount?: number;
        keyword?: string;
      }
    >({
      queryFn: async ({
        latitude,
        longitude,
        types,
        rankPreference = "POPULARITY",
        radius = 20000,
        maxResultCount = 20,
        keyword,
      }) => {
        try {
          const places = await getNearbyPlacesApi(
            latitude,
            longitude,
            types,
            rankPreference,
            radius,
            maxResultCount,
            keyword
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
            id: `${lat}_${lng}_${arg.types.join(",")}_${arg.radius ?? 20000}_${
              arg.keyword ?? "none"
            }`,
          },
        ];
      },
      keepUnusedDataFor: CACHE_TIME.NEARBY_PLACES,
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
          const { places } = await searchPlacesByTextApi(
            input,
            lat,
            lng,
            radius,
            sessionToken
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
      void,
      { placeId: string; action: "add" | "remove"; queryArg?: { lat?: number; lng?: number } }
    >({
          queryFn: async ({ placeId, action }) => {
            try {
              await toggleFavoritePlaceApi({ placeId, action });
              return { data: { success: true } };
            } catch (error) {
              return { error: { status: "CUSTOM_ERROR", error: String(error) } };
            }
          },
      onQueryStarted: ({ placeId, action, queryArg }, { dispatch, queryFulfilled }) => {
        const targets = [
          queryArg ?? undefined,
          undefined, // default cache entry
        ].filter(
          (value, index, self) => self.findIndex((v) => JSON.stringify(v) === JSON.stringify(value)) === index
        );

        const patches = targets.map((target) =>
          dispatch(
            placesApi.util.updateQueryData("getFavoritePlaces", target as any, (draft) => {
              if (!draft?.places) return;
              if (action === "add") {
                // Without place details we can't insert; rely on refetch
                return;
              }
              draft.places = draft.places.filter(
                (p: any) => (p.placeId || p.id) !== placeId
              );
            })
          )
        );

        queryFulfilled.catch(() => patches.forEach((p) => p.undo()));
      },
      invalidatesTags: (result, error, arg) =>
        arg.action === "add"
          ? [{ type: "FavoritePlaces", id: "list" }]
          : [], // no refetch on remove; rely on optimistic update
    }),

  }),
});

export const {
  useGetNearbyPlacesQuery,
  useSearchPlacesByTextQuery,
  useGetTrendingPlacesQuery,
  useGetFavoritePlacesQuery,
  useToggleFavoritePlaceMutation,
  useLazyGetNearbyPlacesQuery,
  useLazySearchPlacesByTextQuery,
} = placesApi;
