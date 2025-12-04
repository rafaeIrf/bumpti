import { haversineDistance } from "../haversine.ts";
import type {
    FoursquareCategory,
    FoursquarePhoto,
    FoursquareSocialMedia,
    GetPlaceDetailsParams,
    PlaceDetailsResult
} from "./types.ts";

export const FOURSQUARE_API_BASE = "https://places-api.foursquare.com";

interface FoursquarePlaceDetailsResponse {
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
  photos?: FoursquarePhoto[];
  hours?: {
    open_now?: boolean;
    display?: string;
    is_local_holiday?: boolean;
  };
  social_media?: FoursquareSocialMedia;
  popularity?: number;
  description?: string;
  distance?: number;
  price?: number;
  rating?: number;
  tel?: string;
  website?: string;
  email?: string;
}

/**
 * Get detailed information about multiple places
 * Returns array of place details with calculated distance from user
 */
export async function getPlaceDetails({
  fsq_ids,
  userLat,
  userLng,
}: GetPlaceDetailsParams): Promise<PlaceDetailsResult[]> {
  const fsApiKey = Deno.env.get("FS_PLACES_API_KEY");

  if (!fsApiKey) {
    throw new Error("FS_PLACES_API_KEY not configured");
  }

  if (!fsq_ids || fsq_ids.length === 0 || !userLat || !userLng) {
    throw new Error("Missing required parameters: fsq_ids (non-empty array), userLat, userLng");
  }

  const fields = [
    "fsq_place_id",
    "name",
    "latitude",
    "longitude",
    "location",
    "distance",
    "categories"
  ].join(",");

  try {
    // Fetch all place details in parallel
    const placeDetailsPromises = fsq_ids.map(async (fsq_id) => {
      try {
        const url = `${FOURSQUARE_API_BASE}/places/${fsq_id}?fields=${fields}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${fsApiKey}`,
            accept: "application/json",
            "X-Places-Api-Version": "2025-06-17",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to fetch place ${fsq_id}: ${response.status} - ${errorText}`);
          return null; // Return null for failed requests
        }

        const place: FoursquarePlaceDetailsResponse = await response.json();

        const placeLat = place.latitude;
        const placeLng = place.longitude;

        if (!placeLat || !placeLng) {
          console.error(`Place ${fsq_id} missing coordinates`);
          return null;
        }

        // Calculate distance using haversine (API may not return distance for details endpoint)
        const distance = place.distance 
          ? place.distance / 1000 // Convert meters to km if provided
          : haversineDistance(userLat, userLng, placeLat, placeLng);

        return {
          fsq_id: place.fsq_place_id,
          name: place.name,
          formatted_address: place.location?.formatted_address,
          distance,
          categories: place.categories || [],
          latitude: placeLat,
          longitude: placeLng,
        };
      } catch (error) {
        console.error(`Error fetching place ${fsq_id}:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(placeDetailsPromises);
    
    // Filter out null results (failed requests)
    return results.filter((place): place is PlaceDetailsResult => place !== null);
  } catch (error) {
    console.error("Error in getPlaceDetails batch processing:", error.message);
    throw error;
  }
}
