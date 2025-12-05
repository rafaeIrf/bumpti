import { ALLOWED_CATEGORY_IDS, LARGE_VENUE_CATEGORIES } from "./categories.ts";
import type { FoursquareCategory } from "./types.ts";

export const FOURSQUARE_API_BASE = "https://places-api.foursquare.com";

// Maximum distance thresholds based on venue size
const MAX_DISTANCE_SMALL_VENUE = 80; // meters - bars, cafes, gyms
const MAX_DISTANCE_LARGE_VENUE = 250; // meters - universities, malls, parks

interface FoursquareLocation {
  formatted_address?: string;
  address?: string;
  locality?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

interface FoursquareGeotagCandidate {
  fsq_place_id: string;
  name: string;
  latitude?: number | { value?: number };
  longitude?: number | { value?: number };
  categories?: FoursquareCategory[];
  location?: FoursquareLocation;
  distance?: number;
}

interface FoursquareGeotagResponse {
  candidates: FoursquareGeotagCandidate[];
}

export interface GeotagCandidate {
  fsq_place_id: string;
  name: string;
  formatted_address?: string;
  categories: FoursquareCategory[];
  latitude: number;
  longitude: number;
  distance: number;
}

export interface GeotagResult {
  suggested: GeotagCandidate | null;
}

interface GeotagCandidatesParams {
  lat: number;
  lng: number;
  hacc?: number;
  limit?: number;
}

/**
 * Get geotagging candidates from Foursquare API
 * Returns suggested place and alternatives based on user location
 */
export async function geotagCandidates({
  lat,
  lng,
  hacc = 20,
  limit = 10,
}: GeotagCandidatesParams): Promise<GeotagResult | null> {
  const fsApiKey = Deno.env.get("FS_PLACES_API_KEY");

  if (!fsApiKey) {
    console.error("FS_PLACES_API_KEY not configured");
    return null;
  }

  if (lat === undefined || lng === undefined) {
    console.error("Missing required parameters: lat, lng");
    return null;
  }

  // If horizontal accuracy is too poor (>80m), don't return suggestions
  // The location is too imprecise to reliably detect a place
  if (hacc > 80) {
    console.warn(`Location accuracy too poor (${hacc}m). Not detecting place.`);
    return {
      suggested: null,
    };
  }

  try {
    // Specify only the fields we need (no premium fields)
    const fields = [
      "fsq_place_id",
      "name",
      "latitude",
      "longitude",
      "categories",
      "location",
      "distance",
    ].join(",");

    const url = new URL(`${FOURSQUARE_API_BASE}/geotagging/candidates`);
    url.searchParams.set("ll", `${lat},${lng}`);
    url.searchParams.set("hacc", hacc.toString());
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("fields", fields);

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
      console.error(
        `Foursquare Geotagging API error: ${response.status} - ${errorText}`
      );
      return null;
    }

    const data: FoursquareGeotagResponse = await response.json();

    if (!data.candidates || !Array.isArray(data.candidates)) {
      return {
        suggested: null,
      };
    }

    // Filter candidates by allowed categories only (no distance filter yet)
    const allCandidates = data.candidates
      .filter((candidate) => {
        if (!candidate.categories || candidate.categories.length === 0) {
          return false;
        }
        // Check if any category matches our allowed list
        const hasAllowedCategory = candidate.categories.some((cat) =>
          ALLOWED_CATEGORY_IDS.has(cat.fsq_category_id)
        );
        
        if (!hasAllowedCategory) {
          return false;
        }
        
        // Determine max distance based on venue type
        const isLargeVenue = candidate.categories.some((cat) =>
          LARGE_VENUE_CATEGORIES.has(cat.fsq_category_id)
        );
        const maxDistance = isLargeVenue
          ? MAX_DISTANCE_LARGE_VENUE
          : MAX_DISTANCE_SMALL_VENUE;
        
        const distance = candidate.distance ?? 0;
        return distance <= maxDistance;
      })
      .map((candidate): GeotagCandidate | null => {
        // Handle latitude/longitude which may be number or object with value
        let latitude: number | undefined;
        let longitude: number | undefined;

        if (typeof candidate.latitude === "number") {
          latitude = candidate.latitude;
        } else if (
          typeof candidate.latitude === "object" &&
          candidate.latitude !== null
        ) {
          latitude = (candidate.latitude as { value?: number }).value;
        }

        if (typeof candidate.longitude === "number") {
          longitude = candidate.longitude;
        } else if (
          typeof candidate.longitude === "object" &&
          candidate.longitude !== null
        ) {
          longitude = (candidate.longitude as { value?: number }).value;
        }

        const distance = candidate.distance ?? 0;

        if (latitude === undefined || longitude === undefined) {
          return null;
        }

        return {
          fsq_place_id: candidate.fsq_place_id,
          name: candidate.name,
          formatted_address: candidate.location?.formatted_address,
          categories: candidate.categories || [],
          latitude,
          longitude,
          distance,
        };
      })
      .filter((c): c is GeotagCandidate => c !== null);

    // Sort all candidates by distance (closest first)
    allCandidates.sort((a, b) => {
      return a.distance - b.distance;
    });

    // Find suggested place: closest place within reasonable distance
    let suggested: GeotagCandidate | null = null;
    for (const candidate of allCandidates) {
      const isLargeVenue = candidate.categories.some((cat) =>
        LARGE_VENUE_CATEGORIES.has(cat.fsq_category_id)
      );
      const maxDistance = isLargeVenue
        ? MAX_DISTANCE_LARGE_VENUE
        : MAX_DISTANCE_SMALL_VENUE;
      
      if (candidate.distance <= maxDistance) {
        suggested = candidate;
        break;
      }
    }

    return {
      suggested,
    };
  } catch (error) {
    console.error("Error in geotagCandidates:", (error as Error).message);
    return null;
  }
}
