import { haversineDistance } from "./haversine.ts";

const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");

const ensureApiKey = () => {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Google Places API key not configured");
  }
  return GOOGLE_PLACES_API_KEY;
};

export type NearbyPlace = {
  placeId: string;
  name: string;
  distance: number;
  types: string[];
  type: string | null;
  formattedAddress: string | null;
};

export async function fetchNearbyPlaces({
  lat,
  lng,
  radius = 20000,
  types,
  keyword,
  rankPreference = "POPULARITY",
  maxResultCount = 20,
}: {
  lat: number;
  lng: number;
  radius?: number;
  types: string[];
  keyword?: string;
  rankPreference?: string;
  maxResultCount?: number;
}): Promise<NearbyPlace[]> {
  const apiKey = ensureApiKey();

  const excludedTypes = [
    "supermarket",
    "florist",
    "physiotherapist",
    "hair_care",
    "convenience_store",
    "meal_takeaway",
    "meal_delivery",
    "bakery",
    "sports_complex",
  ];

  const body = {
    includedTypes: types,
    excludedTypes,
    rankPreference,
    maxResultCount,
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
    ...(keyword && { keyword }),
  };

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Places nearby failed: ${errorText}`);
  }

  const data: any = await response.json();
  return (
    data?.places?.map((place: any) => ({
      placeId: place.id,
      name: place.displayName?.text || "Unknown",
      distance: haversineDistance(
        lat,
        lng,
        place.location?.latitude || 0,
        place.location?.longitude || 0
      ),
      types: place.types || [],
      type: place.types?.[0] || null,
      formattedAddress: place.formattedAddress || null,
    })) ?? []
  );
}

export type PlaceById = {
  placeId: string;
  name: string;
  distance: number;
  type: string | null;
  types: string[];
  formattedAddress: string | null;
};

export async function fetchPlacesByIds({
  placeIds,
  lat = 0,
  lng = 0,
}: {
  placeIds: string[];
  lat?: number;
  lng?: number;
}): Promise<PlaceById[]> {
  const apiKey = ensureApiKey();

  const fetchPlace = async (placeId: string) => {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,types",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch place ${placeId}: ${errorText}`);
    }

    const data: any = await response.json();

    return {
      placeId: data.id || placeId,
      name: data.displayName?.text || "Unknown",
      distance: haversineDistance(
        lat,
        lng,
        data.location?.latitude || 0,
        data.location?.longitude || 0
      ),
      type: data.types?.[0] || null,
      types: data.types || [],
      formattedAddress: data.formattedAddress || null,
    };
  };

  return await Promise.all(placeIds.map(fetchPlace));
}

export type AutocompletePlace = {
  placeId: string | null;
  name: string;
  types: string[];
  formattedAddress: string | null;
  distance: number | null;
};

export async function fetchPlacesAutocomplete({
  input,
  lat,
  lng,
  radius = 20000,
  sessionToken,
}: {
  input: string;
  lat: number;
  lng: number;
  radius?: number;
  sessionToken?: string;
}): Promise<AutocompletePlace[]> {
  const apiKey = ensureApiKey();

  const allowedTypes = ["bar", "night_club", "cafe", "university", "gym"];

  const body: Record<string, unknown> = {
    input,
    includedPrimaryTypes: allowedTypes,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
  };

  if (sessionToken) body.sessionToken = sessionToken;

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Places autocomplete failed: ${errorText}`);
  }

  const data: any = await response.json();
  return (
    data?.suggestions?.map((suggestion: any) => ({
      placeId:
        suggestion.placePrediction?.placeId ||
        suggestion.placePrediction?.place ||
        null,
      name:
        suggestion.placePrediction?.text?.text ||
        suggestion.placePrediction?.structuredFormat?.mainText?.text ||
        "Unknown",
      types: suggestion.placePrediction?.types || [],
      formattedAddress:
        suggestion.placePrediction?.structuredFormat?.secondaryText?.text ||
        null,
      distance:
        suggestion.distanceMeters != null
          ? suggestion.distanceMeters / 1000
          : null,
    })) ?? []
  );
}
