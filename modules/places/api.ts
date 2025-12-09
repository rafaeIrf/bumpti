import { supabase } from "@/modules/supabase/client";
import { CityPrediction, Place, PlaceCategory } from "./types";

export async function searchCities(
  input: string
): Promise<CityPrediction[]> {
  const { data, error } = await supabase.functions.invoke<{
    places: CityPrediction[];
  }>("search-cities", {
    body: { input },
  });

  if (error) {
    console.error("search-cities (edge) error:", error);
    return [];
  }

  return data?.places || [];
}

export async function searchPlacesByText(
  input: string,
  lat: number,
  lng: number,
  radius: number = 20000,
  sessionToken?: string
): Promise<{ places: (Place & { active_users?: number })[] }> {
  const { data, error } = await supabase.functions.invoke<{
    places: (Place & { active_users?: number })[];
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

// Fetch nearby places for given category
export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  category: string // General category name (bars, cafes, etc.)
): Promise<Place[]> {
  console.log('category', category)
  const { data, error } = await supabase.functions.invoke<{
    places: Place[];
  }>("get-nearby-places", {
    body: {
      lat: latitude,
      lng: longitude,
      category,
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

  console.log("getTrendingPlaces data:", data);
  
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

export interface PlacesByCategory {
  category: string;
  places: Place[];
}

/**
 * Fetch suggested places grouped by categories for onboarding
 * Makes a single API call to get multiple categories at once
 */
export async function getSuggestedPlacesByCategories(
  latitude: number,
  longitude: number,
  categories: PlaceCategory[],
): Promise<{ data: PlacesByCategory[] }> {
  const { data, error } = await supabase.functions.invoke<{
    data: PlacesByCategory[];
  }>("get-suggested-places", {
    body: {
      lat: latitude,
      lng: longitude,
      categories,
    },
  });

  if (error) {
    console.error("Failed to fetch suggested places (edge):", error);
    return { data: [] };
  }

  return {
    data: data?.data || [],
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

export interface DetectedPlace {
  fsq_place_id: string;
  name: string;
  formatted_address?: string;
  categories: {
    fsq_category_id: string;
    name: string;
  }[];
  latitude: number;
  longitude: number;
  distance: number;
}

export interface DetectPlaceResult {
  suggested: DetectedPlace | null;
}

export async function detectPlace(
  latitude: number,
  longitude: number,
  hacc?: number,
  limit?: number
): Promise<DetectPlaceResult | null> {
  const { data, error } = await supabase.functions.invoke<{
    data: DetectPlaceResult | null;
    error: string | null;
  }>("detect-place", {
    body: {
      lat: latitude,
      lng: longitude,
      ...(hacc != null && { hacc }),
      ...(limit != null && { limit }),
    },
  });

  if (error) {
    console.error("detect-place error:", error);
    return null;
  }

  if (data?.error) {
    console.error("detect-place API error:", data.error);
    return null;
  }

  return data?.data || null;
}
