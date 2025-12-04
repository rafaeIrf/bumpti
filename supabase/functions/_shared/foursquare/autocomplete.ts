import type {
    AutocompletePlacesParams,
    FoursquareCategory,
    PlaceAutocompleteResult
} from "./types.ts";

export const FOURSQUARE_API_BASE = "https://places-api.foursquare.com";

interface FoursquareAutocompleteResponse {
  results: {
    type: string; // 'place', 'search', or 'geo'
    text?: {
      primary: string;
      secondary?: string;
      highlight?: {
        start: number;
        length: number;
      }[];
    };
    icon?: {
      fsq_photo_id?: string;
      prefix?: string;
      suffix?: string;
    };
    link?: string;
    place?: {
      fsq_place_id: string;
      name: string;
      latitude?: number;
      longitude?: number;
      location?: {
        formatted_address?: string;
        address?: string;
        locality?: string;
        region?: string;
        postcode?: string;
        country?: string;
      };
      categories?: FoursquareCategory[];
      distance?: number;
    };
    search?: {
      query: string;
      category?: FoursquareCategory;
    };
    geo?: {
      name: string;
      center?: {
        latitude: number;
        longitude: number;
      };
    };
  }[];
}

/**
 * Autocomplete places using Foursquare API
 * Returns list of places matching the search query with calculated distances
 */
export async function autocompletePlaces({
  query,
  userLat,
  userLng,
  radius = 20000,
  limit = 10,
  categories,
}: AutocompletePlacesParams): Promise<PlaceAutocompleteResult[]> {
  const fsApiKey = Deno.env.get("FS_PLACES_API_KEY");

  if (!fsApiKey) {
    throw new Error("FS_PLACES_API_KEY not configured");
  }

  if (!query || !userLat || !userLng) {
    throw new Error("Missing required parameters: query, userLat, userLng");
  }

  try {
    const url = new URL(`${FOURSQUARE_API_BASE}/autocomplete`);
    url.searchParams.set("query", query);
    url.searchParams.set("ll", `${userLat},${userLng}`);
    url.searchParams.set("radius", radius.toString());
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("types", "place"); // Only return place results

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

    const data: FoursquareAutocompleteResponse = await response.json();

    // Filter and map results
    const places: PlaceAutocompleteResult[] = data.results
      .filter((result) => {
        // Only include place results
        if (result.type !== "place" || !result.place) {
          return false;
        }

        // Client-side category filtering (API doesn't support category filter)
        if (categories && categories.length > 0) {
          const place = result.place;
          const placeCategories = place.categories?.map(cat => cat.fsq_category_id) || [];
          // Check if place has at least one of the specified categories
          const hasMatchingCategory = categories.some(catId => placeCategories.includes(catId));
          return hasMatchingCategory;
        }

        return true;
      })
      .map((result) => {
        const place = result.place!;

        return {
          fsq_id: place.fsq_place_id,
          name: place.name,
          formatted_address: place.location?.formatted_address,
          categories: place.categories || [],
          latitude: place.latitude || 0,
          longitude: place.longitude || 0,
          distance: place.distance || 0, // Distance already calculated by API (in meters)
        };
      })
      .filter((place) => place.latitude !== 0 && place.longitude !== 0); // Remove places without coordinates

    return places;
  } catch (error) {
    console.error("Error in autocompletePlaces:", error.message);
    throw error;
  }
}
