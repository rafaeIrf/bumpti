import { supabase } from "@/modules/supabase/client";
import { Place, PlaceType } from "./types";

export async function searchPlacesByText(
  input: string,
  lat: number,
  lng: number,
  radius: number = 20000,
  sessionToken?: string
): Promise<{ places: Place[] }> {
  const { data, error } = await supabase.functions.invoke<{
    places: Place[];
  }>("search-places-by-text", {
    body: { input, lat, lng, radius, sessionToken },
  });

  if (error) {
    console.error("search-places-by-text (edge) error:", error);
    return { places: [] };
  }

  return {
    places: data?.places || [],
  };
}

// Fetch nearby places for given coordinates and included types
export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  types: PlaceType[],
  rankPreference: "POPULARITY" | "DISTANCE" = "POPULARITY",
  radius: number = 20000,
  maxResultCount: number = 20,
  keyword?: string
): Promise<Place[]> {
  const { data, error } = await supabase.functions.invoke<{
    places: Place[];
  }>("get-nearby-places", {
    body: {
      lat: latitude,
      lng: longitude,
      types,
      rankPreference,
      radius,
      ...(keyword && { keyword }),
      maxResultCount,
    },
  });

  if (error) {
    console.error("Nearby places (edge) error:", error);
    return [];
  }

  return data?.places || [];
}

export async function getTrendingPlaces(
  latitude?: number,
  longitude?: number
): Promise<{
  places: (Place & { active_users: number })[];
}> {
  const { data, error } = await supabase.functions.invoke<{
    places: (Place & { active_users: number })[];
  }>("get-trending-places", {
    body: {
      ...(latitude != null && { lat: latitude }),
      ...(longitude != null && { lng: longitude }),
    },
  });
  
  if (error) {
    console.error("Failed to fetch trending places (edge):", error);
    return { places: [] };
  }

  return {
    places: data?.places || [],
  };
}

export async function getFavoritePlaces(
  latitude?: number,
  longitude?: number
): Promise<{ places: Place[] }> {
  const { data, error } = await supabase.functions.invoke<{
    places: Place[];
  }>("get-favorite-places", {
    body: {
      ...(latitude != null && { lat: latitude }),
      ...(longitude != null && { lng: longitude }),
    },
  });

  if (error) {
    console.error("Failed to fetch favorite places (edge):", error);
    return { places: [] };
  }

  return {
    places: data?.places || [],
  };
}

export async function toggleFavoritePlace({
  placeId,
  action,
}: {
  placeId: string;
  action: "add" | "remove";
}): Promise<{ success: boolean }> {
  const { error } = await supabase.functions.invoke("toggle-favorite-place", {
    body: { placeId, action },
  });

  if (error) {
    console.error("toggle-favorite-place error:", error);
    throw error;
  }

  return { success: true };
}
