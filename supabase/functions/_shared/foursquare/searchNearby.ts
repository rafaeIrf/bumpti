import { haversineDistance } from "../haversine.ts";
import type {
  FoursquareCategory,
  PlaceNearbyResult,
  SearchNearbyPlacesParams
} from "./types.ts";
import { FoursquareSortOrder } from "./types.ts";

export const FOURSQUARE_API_BASE = "https://places-api.foursquare.com";

interface FoursquareSearchResponse {
  results: {
    fsq_place_id: string;
    name: string;
    location?: {
      formatted_address?: string;
    };
    categories?: FoursquareCategory[];
    latitude?: number;
    longitude?: number;
    distance?: number;
    popularity?: number;
  }[];
}

/**
 * Search for nearby places using Foursquare API
 * Returns list of popular places sorted by popularity with calculated distances
 */
export async function searchNearbyPlaces({
  userLat,
  userLng,
  radius = 20000,
  limit = 20,
  categories,
  openNow = true,
  sort = FoursquareSortOrder.RELEVANCE,
}: SearchNearbyPlacesParams): Promise<PlaceNearbyResult[]> {
  const fsApiKey = Deno.env.get("FS_PLACES_API_KEY");

  if (!fsApiKey) {
    throw new Error("FS_PLACES_API_KEY not configured");
  }

  if (!userLat || !userLng) {
    throw new Error("Missing required parameters: userLat, userLng");
  }

  if (!categories || categories.length === 0) {
    throw new Error("Missing required parameter: categories");
  }

  try {
    // Specify only the fields we need to reduce costs
    const fields = [
      "fsq_place_id",
      "name",
      "latitude",
      "longitude",
      "location",
      "categories",
      "distance"
    ].join(",");

    // Foursquare Places API: /places/search with category filtering
    const url = new URL(`${FOURSQUARE_API_BASE}/places/search`);
    url.searchParams.set("ll", `${userLat},${userLng}`);
    url.searchParams.set("radius", radius.toString());
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("sort", sort);
    url.searchParams.set("fields", fields);
    
    // Add categories as comma-separated list - Foursquare uses 'fsq_category_ids'
    const categoriesParam = categories.join(",");
    url.searchParams.set("fsq_category_ids", categoriesParam);

    // Filter only open places
    // if (openNow) {
    //   url.searchParams.set("open_now", "true");
    // }

    console.log("=== FOURSQUARE API CALL ===");
    console.log("Categories IDs:", categories);
    console.log("Categories param:", categoriesParam);
    console.log("Full URL:", url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${fsApiKey}`,
        accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Foursquare API error: ${response.status} - ${errorText}`
      );
    }

    const data: FoursquareSearchResponse = await response.json();

    // Check if results exist
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    // Filter by popularity > 0.2 and map results
    const places: PlaceNearbyResult[] = data.results
      .filter((place) => {
        // Ensure coordinates exist
        if (!place.latitude || !place.longitude) {
          return false;
        }
        // Filter by popularity (if available)
        if (place.popularity !== undefined && place.popularity <= 0.2) {
          return false;
        }
        return true;
      })
      .map((place) => {
        const placeLat = place.latitude!;
        const placeLng = place.longitude!;

        // Calculate distance using haversine
        const distance = haversineDistance(userLat, userLng, placeLat, placeLng);

        return {
          fsq_id: place.fsq_place_id,
          name: place.name,
          formatted_address: place.location?.formatted_address,
          categories: place.categories || [],
          latitude: placeLat,
          longitude: placeLng,
          distance,
          popularity: place.popularity,
        };
      });

    return places;
  } catch (error) {
    console.error("Error in searchNearbyPlaces:", error.message);
    throw error;
  }
}
