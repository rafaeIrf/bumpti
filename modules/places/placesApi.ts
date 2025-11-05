import functions from "@react-native-firebase/functions";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { Place, PlaceType } from "./types";

// TTL configurations (in seconds)
// Google Places API allows caching lat/lng for up to 30 days
// Reference: https://cloud.google.com/maps-platform/terms/maps-service-terms Section 10.3
const CACHE_TIME = {
  NEARBY_PLACES: __DEV__ ? 1 * 60 : 30 * 24 * 60 * 60, // 30 days - Google's maximum allowed cache time
  FEATURED_PLACES: __DEV__ ? 1 * 60 : 30 * 24 * 60 * 60, // 30 days - featured places are static
  SEARCH_PLACES: __DEV__ ? 1 * 60 : 30 * 24 * 60 * 60, // 30 days - search results cache
  TEXT_SEARCH: __DEV__ ? 1 * 60 : 30 * 24 * 60 * 60, // 30 days - text search results cache
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
    "FeaturedPlaces",
    "SearchPlaces",
    "TextSearchPlaces",
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
        maxResultCount?: number;
      }
    >({
      queryFn: async ({
        latitude,
        longitude,
        types,
        rankPreference = "POPULARITY",
        maxResultCount = 20,
      }) => {
        try {
          const callable = functions().httpsCallable<any, { places: Place[] }>(
            "getNearbyPlaces"
          );
          const result = await callable({
            lat: latitude,
            lng: longitude,
            types,
            rankPreference,
          });
          return { data: (result?.data?.places || []) as Place[] };
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
            id: `${lat}_${lng}_${arg.types.join(",")}`,
          },
        ];
      },
      keepUnusedDataFor: CACHE_TIME.NEARBY_PLACES,
    }),

    // Search places by text input
    searchPlacesByText: builder.query<
      { places: Place[] },
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
          const callable = functions().httpsCallable<any, { places: Place[] }>(
            "searchPlacesByText"
          );
          const payload: any = { input, lat, lng, radius };
          if (sessionToken) payload.sessionToken = sessionToken;
          const result = await callable(payload);
          return {
            data: {
              places: (result?.data?.places || []) as Place[],
            },
          };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, error, arg) => [
        { type: "SearchPlaces", id: `${arg.input}_${arg.lat}_${arg.lng}` },
      ],
      keepUnusedDataFor: CACHE_TIME.SEARCH_PLACES,
    }),

    // Get featured places by IDs
    getFeaturedPlaces: builder.query<Place[], { placeIds: string[] }>({
      queryFn: async ({ placeIds }) => {
        try {
          const callable = functions().httpsCallable<any, { places: Place[] }>(
            "getPlacesByIds"
          );
          const result = await callable({ placeIds });
          return { data: (result?.data?.places || []) as Place[] };
        } catch (error) {
          console.error("Failed to fetch featured places:", error);
          return { data: [] };
        }
      },
      providesTags: (result, error, arg) => [
        { type: "FeaturedPlaces", id: arg.placeIds.join(",") },
      ],
      keepUnusedDataFor: CACHE_TIME.FEATURED_PLACES,
    }),

    // Search places by text query with pagination
    searchTextPlaces: builder.query<
      { places: Place[]; nextPageToken: string | null },
      {
        lat: number;
        lng: number;
        includedType: string;
        radius?: number;
        maxResultCount?: number;
        pageToken?: string;
      }
    >({
      queryFn: async ({
        lat,
        lng,
        includedType,
        radius = 20000,
        maxResultCount = 20,
        pageToken,
      }) => {
        try {
          const callable = functions().httpsCallable<
            any,
            { places: Place[]; nextPageToken: string | null }
          >("searchTextPlaces");

          const result = await callable({
            lat,
            lng,
            includedType,
            radius,
            maxResultCount,
            ...(pageToken && { pageToken }),
          });

          return {
            data: {
              places: (result?.data?.places || []) as Place[],
              nextPageToken: result?.data?.nextPageToken || null,
            },
          };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, error, arg) => [
        {
          type: "TextSearchPlaces",
          id: `${arg.lat}_${arg.lng}_${arg.includedType}_${
            arg.pageToken || ""
          }`,
        },
      ],
      keepUnusedDataFor: CACHE_TIME.TEXT_SEARCH,
    }),
  }),
});

export const {
  useGetNearbyPlacesQuery,
  useSearchPlacesByTextQuery,
  useGetFeaturedPlacesQuery,
  useSearchTextPlacesQuery,
  useLazyGetNearbyPlacesQuery,
  useLazySearchPlacesByTextQuery,
  useLazyGetFeaturedPlacesQuery,
  useLazySearchTextPlacesQuery,
} = placesApi;
