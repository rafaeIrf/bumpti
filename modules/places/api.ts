import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { Place, PlaceType } from "./types";

const firebaseFunctions = getFunctions();

export async function searchPlacesByText(
  input: string,
  lat: number,
  lng: number,
  radius: number = 20000,
  sessionToken?: string
): Promise<{ places: Place[] }> {
  const callable = httpsCallable<any, { places: Place[] }>(
    firebaseFunctions,
    "searchPlacesByText"
  );
  const payload: any = { input, lat, lng, radius };
  if (sessionToken) payload.sessionToken = sessionToken;
  const result = await callable(payload);
  return {
    places: (result?.data?.places || []) as Place[],
  };
}

// Fetch nearby places for given coordinates and included types
export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  types: PlaceType[],
  rankPreference: "POPULARITY" | "DISTANCE" = "POPULARITY",
  maxResultCount: number = 20
): Promise<Place[]> {
  const callable = httpsCallable<any, { places: Place[] }>(
    firebaseFunctions,
    "getNearbyPlaces"
  );
  const result = await callable({
    lat: latitude,
    lng: longitude,
    types,
    rankPreference,
  });
  console.log("Nearby places result:", result?.data);
  return (result?.data?.places || []) as Place[];
}

// Fetch featured places by fixed place IDs (batch)
export async function getFeaturedPlaces(
  latitude: number,
  longitude: number,
  placeIds: string[]
): Promise<Place[]> {
  try {
    const callable = httpsCallable<any, { places: Place[] }>(
      firebaseFunctions,
      "getPlacesByIds"
    );
    const result = await callable({
      placeIds,
      lat: latitude,
      lng: longitude,
    });
    return (result?.data?.places || []) as Place[];
  } catch (err) {
    console.error("Failed to fetch featured places:", err);
    return [];
  }
}

// Search places by text query with pagination support
export async function searchTextPlaces(
  lat: number,
  lng: number,
  includedType: string,
  radius: number = 20000,
  maxResultCount: number = 20,
  pageToken?: string
): Promise<{ places: Place[]; nextPageToken: string | null }> {
  const callable = httpsCallable<
    any,
    { places: Place[]; nextPageToken: string | null }
  >(firebaseFunctions, "searchTextPlaces");

  const result = await callable({
    lat,
    lng,
    includedType,
    radius,
    maxResultCount,
    ...(pageToken && { pageToken }),
  });

  return {
    places: (result?.data?.places || []) as Place[],
    nextPageToken: result?.data?.nextPageToken || null,
  };
}
