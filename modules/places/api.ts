import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { CityPrediction, Place, PlaceCategory, SupportedCity } from "./types";

type PlacesSortOption = "relevance" | "distance" | "popularity" | "rating" | "trending";

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

export async function getSupportedCities(
  lat?: number,
  lng?: number,
): Promise<SupportedCity[]> {
  const params = new URLSearchParams();
  if (lat !== undefined && lng !== undefined) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  }
  const queryString = params.toString();
  const functionPath = queryString
    ? `get-supported-cities?${queryString}`
    : "get-supported-cities";

  const { data, error } = await supabase.functions.invoke<{
    cities: SupportedCity[];
  }>(functionPath);

  if (error) {
    logger.error("get-supported-cities (edge) error:", error);
    return [];
  }

  return data?.cities || [];
}

export async function searchPlacesByText(
  input: string,
  lat: number,
  lng: number,
  category?: string, // Optional category filter (e.g., 'university')
): Promise<Place[]> {
  // We use the new places-autocomplete function which uses Photon
  // It expects GET with q, lat, lng
  const params = new URLSearchParams({
    q: input,
    lat: lat.toString(),
    lng: lng.toString(),
    limit: "10",
    ...(category && { category }),
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
      neighborhood: p.neighborhood,
      distance: p.dist_meters ? p.dist_meters / 1000 : 0, // convert meters to km
      latitude: p.latitude ?? p.lat,
      longitude: p.longitude ?? p.lng,
      types: [p.category], // put category in types
      active_users: p.active_users,
      preview_avatars: p.preview_avatars,
      regulars_count: p.regulars_count ?? 0,
      review: p.review
    };
  }) || [];
}

// Fetch nearby places for given category
export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  category: string[], // General category name (bars, cafes, etc.)
  options?: {
    page?: number;
    pageSize?: number;
    sortBy?: PlacesSortOption;
    minRating?: number | null;
  },
): Promise<Place[]> {
  const { page, pageSize, sortBy, minRating } = options ?? {};
  const { data, error } = await supabase.functions.invoke<any[]>("places-nearby", {
    body: {
      lat: latitude,
      lng: longitude,
      category, // Edge function internally maps this to FSQ categories if needed, or we rely on RPC
      page,
      pageSize,
      sortBy,
      minRating,
    },
  });
  
  if (error) {
    logger.error("Nearby places (edge) error:", error);
    return [];
  }

  // Map RPC result to Place type
  // RPC returns: id, name, category, lat, lng, street, house_number, city, state, country, total_score, active_users, dist_meters, monthly_checkins, rank_position
  return (data || []).map((p: any) => {
    return {
      placeId: p.id,
      name: p.name,
      formattedAddress: p.formatted_address,
      neighborhood: p.neighborhood,
      distance: p.dist_meters ? p.dist_meters / 1000 : 0, // convert meters to km
      latitude: p.latitude ?? p.lat,
      longitude: p.longitude ?? p.lng,
      types: [p.category], // put category in types
      active_users: p.active_users,
      preview_avatars: p.preview_avatars,
      total_checkins: p.total_checkins,
      monthly_checkins: p.monthly_checkins,
      rank_position: p.rank_position,
      review: p.review,
      regulars_count: p.regulars_count ?? 0,
    };
  });
}

export type RankByOption = "monthly" | "total";

// Fetch ranked places (for "Mais Frequentados" screen)
export async function getRankedPlaces(
  latitude: number,
  longitude: number,
  rankBy: RankByOption = "monthly",
  maxResults: number = 20
): Promise<Place[]> {
  const { data, error } = await supabase.functions.invoke<any[]>("get-ranked-places", {
    body: {
      lat: latitude,
      lng: longitude,
      rankBy,
      maxResults,
    },
  });

  if (error) {
    logger.error("Ranked places (edge) error:", error);
    return [];
  }

  // Map result to Place type
  return (data || []).map((p: any) => {
    return {
      placeId: p.placeId,
      name: p.name,
      formattedAddress: p.formattedAddress,
      neighborhood: p.neighborhood,
      distance: p.distance ? p.distance / 1000 : 0, // convert meters to km
      latitude: p.lat,
      longitude: p.lng,
      types: [p.category],
      total_checkins: p.totalCheckins,
      monthly_checkins: p.monthlyCheckins,
      total_matches: p.totalMatches || 0,
      monthly_matches: p.monthlyMatches || 0,
      rank: p.rankPosition,
      active_users: p.activeUsers || 0,
      preview_avatars: p.preview_avatars,
      regulars_count: p.regulars_count ?? 0,
      review: p.review,
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
      neighborhood: p.neighborhood,
      distance: p.dist_meters ? p.dist_meters / 1000 : 0, // convert meters to km
      latitude: p.latitude ?? p.lat,
      longitude: p.longitude ?? p.lng,
      types: [p.category], // put category in types
      active_users: p.active_users,
      preview_avatars: p.preview_avatars,
      favorites_count: p.favorites_count,
      regulars_count: p.regulars_count ?? 0,
      rating: p.rating || p.total_score,
      review: p.review
    };
  });
}

export async function getTrendingPlaces(
  latitude?: number,
  longitude?: number,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<{
  places: (Place & { active_users: number })[];
  totalCount: number;
}> {
  const { page, pageSize } = options ?? {};
  const { data, error } = await supabase.functions.invoke<{
    places: (Place & { active_users: number })[];
    totalCount: number;
  }>("get-trending-places", {
    body: {
      ...(latitude != null && { lat: latitude }),
      ...(longitude != null && { lng: longitude }),
      ...(page != null && { page }),
      ...(pageSize != null && { pageSize }),
    },
  });

  if (error) {
    logger.error("Failed to fetch trending places (edge):", error);
    return { places: [], totalCount: 0 };
  }

  return {
    places: (data?.places || []).map((p: any) => ({
      placeId: p.place_id,
      name: p.name,
      formattedAddress: p.formattedAddress,
      neighborhood: p.neighborhood,
      distance: p.distance ? p.distance / 1000 : 0, // convert meters to km
      latitude: p.latitude ?? p.lat,
      longitude: p.longitude ?? p.lng,
      types: p.types,
      active_users: p.active_users,
      preview_avatars: p.preview_avatars,
      regulars_count: p.regulars_count ?? 0,
      review: p.review,
    })),
    totalCount: data?.totalCount ?? 0,
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
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
  types: string[];
  dist_meters: number;
  active_users: number;
  preview_avatars?: { user_id: string; url: string }[];
  review?: {
    average: number;
    count: number;
    tags: string[];
  };
  relevance_score: number;
  boundary_area_sqm?: number;
}

export interface DetectPlaceResult {
  suggested: DetectedPlace | null;
}

export async function detectPlace(
  latitude: number,
  longitude: number,
  hacc?: number
): Promise<DetectPlaceResult | null> {
  const { data, error } = await supabase.functions.invoke<{
    data: DetectPlaceResult | null;
    error: string | null;
  }>("detect-place", {
    body: {
      lat: latitude,
      lng: longitude,
      ...(hacc != null && { hacc }),
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

/**
 * Trigger proactive city hydration for given coordinates
 * Used during onboarding to pre-populate user's city
 */
export async function triggerCityHydration(
  latitude: number,
  longitude: number
): Promise<{ status: string; cityName?: string; countryCode?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      status: string;
      cityName?: string;
      countryCode?: string;
    }>("trigger-city-hydration", {
      body: { latitude, longitude },
    });

    if (error) {
      logger.warn("City hydration trigger failed:", error);
      return { status: "error" };
    }

    logger.log("✅ Proactive city hydration:", data);
    return data || { status: "unknown" };
  } catch (err) {
    logger.warn("City hydration error (non-critical):", err);
    return { status: "error" };
  }
}

/**
 * Creates a place report in the database
 */
export async function createPlaceReport(
  params: {
    placeId: string;
    reason: string;
    description?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("report-place", {
      body: {
        place_id: params.placeId,
        reason: params.reason,
        description: params.description,
      },
    });

    if (error) {
      logger.error("Error creating place report (edge)", {
        error,
        placeId: params.placeId,
      });
      return { success: false, error: error.message };
    }

    if (data?.error) {
      logger.error("Error creating place report (API)", {
        error: data.error,
        placeId: params.placeId,
      });
      return { success: false, error: data.error };
    }

    logger.log("Place report created successfully", {
      placeId: params.placeId,
      reason: params.reason,
      reportId: data?.report_id,
    });

    return { success: true };
  } catch (error) {
    logger.error("Unexpected error creating place report", { error });
    return { success: false, error: "Unexpected error" };
  }
}

