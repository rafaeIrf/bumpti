import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
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
    logger.error("search-cities (edge) error:", error);
    return [];
  }

  return data?.places || [];
}

export async function searchPlacesByText(
  input: string,
  lat: number,
  lng: number,
): Promise<Place[]> {
  // We use the new places-autocomplete function which uses Photon
  // It expects GET with q, lat, lng
  const params = new URLSearchParams({
    q: input,
    lat: lat.toString(),
    lng: lng.toString(),
    limit: "10"
  });

  const { data, error } = await supabase.functions.invoke<Place[]>(`places-autocomplete?${params.toString()}`, {
    method: "GET"
  });

  if (error) {
    logger.error("places-autocomplete (edge) error:", error);
    return [];
  }

  return data?.map((p: any) => {
    return {
      placeId: p.id,
      name: p.name,
      formattedAddress: p.formatted_address,
      distance: p.dist_meters ? p.dist_meters / 1000 : 0, // convert meters to km
      latitude: p.lat,
      longitude: p.lng,
      types: [p.category], // put category in types
      active_users: p.active_users,
      review: p.review
    };
  }) || [];
}

// Fetch nearby places for given category
export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  category: string[], // General category name (bars, cafes, etc.)
): Promise<Place[]> {
  const { data, error } = await supabase.functions.invoke<any[]>("places-nearby", {
    body: {
      lat: latitude,
      lng: longitude,
      category, // Edge function internally maps this to FSQ categories if needed, or we rely on RPC
    },
  });
  
  if (error) {
    logger.error("Nearby places (edge) error:", error);
    return [];
  }

  // Map RPC result to Place type
  // RPC returns: id, name, category, lat, lng, street, house_number, city, state, country, total_score, active_users, dist_meters
  return (data || []).map((p: any) => {
    return {
      placeId: p.id,
      name: p.name,
      formattedAddress: p.formatted_address,
      distance: p.dist_meters ? p.dist_meters / 1000 : 0, // convert meters to km
      latitude: p.lat,
      longitude: p.lng,
      types: [p.category], // put category in types
      active_users: p.active_users,
      review: p.review
    };
  });
}

// Fetch nearby places sorted by community favorites count
export async function getPlacesByFavorites(
  latitude: number,
  longitude: number,
  category?: string[], // Optional category filter
): Promise<Place[]> {

  const { data, error } = await supabase.functions.invoke<any[]>("places-by-favorites", {
    body: {
      lat: latitude,
      lng: longitude,
      ...(category && { category }),
    },
  });
  
  if (error) {
    logger.error("Places by favorites (edge) error:", error);
    return [];
  }

  // Map RPC result to Place type
  // RPC returns: id, name, category, lat, lng, street, house_number, city, state, country, total_score, active_users, favorites_count, dist_meters, review
  return (data || []).map((p: any) => {
    return {
      placeId: p.id,
      name: p.name,
      formattedAddress: p.formatted_address,
      distance: p.dist_meters ? p.dist_meters / 1000 : 0, // convert meters to km
      latitude: p.lat,
      longitude: p.lng,
      types: [p.category], // put category in types
      active_users: p.active_users,
      favorites_count: p.favorites_count,
      rating: p.rating || p.total_score,
      review: p.review
    };
  });
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
    logger.error("Failed to fetch trending places (edge):", error);
    return { places: [] };
  }

  return {
    places: (data?.places || []).map((p: any) => ({
      placeId: p.place_id,
      name: p.name,
      formattedAddress: p.formattedAddress,
      distance: p.distance ? p.distance / 1000 : 0, // convert meters to km
      latitude: p.latitude,
      longitude: p.longitude,
      types: p.types,
      active_users: p.active_users,
      review: p.review,
    })),
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
    logger.error("Failed to fetch favorite places (edge):", error);
    return { places: [] };
  }

  return {
    places: (data?.places || []).map((p: any) => ({
      ...p,
      distance: p.distance ? p.distance / 1000 : 0, // convert meters to km
    })),
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
    logger.error("Failed to fetch suggested places (edge):", error);
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
    logger.error("toggle-favorite-place error:", error);
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
    logger.error("detect-place error:", error);
    return null;
  }

  if (data?.error) {
    logger.error("detect-place API error:", data.error);
    return null;
  }

  return data?.data || null;
}

export async function saveSocialReview(payload: {
  placeId: string;
  rating: number;
  selectedVibes: string[];
}): Promise<{
  review_id: string;
  place_id: string;
  stars: number;
  tags: string[];
  placeStats: {
    averageRating: number;
    reviewCount: number;
    topTags: string[];
  };
}> {
  const { data, error } = await supabase.functions.invoke("save-social-review", {
    body: payload,
  });

  if (error) {
    logger.error("save-social-review error:", error);
    throw error;
  }

  return data;
}

