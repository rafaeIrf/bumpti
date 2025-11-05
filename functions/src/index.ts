/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { onCall } from "firebase-functions/v2/https";
import fetch from "node-fetch";
import { PlaceType, SearchPlacesByTextRequest } from "./places/types";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// New Places API response interface
interface NewPlacesAPIPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  types?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
}

const GOOGLE_PLACES_API_KEY = defineSecret("GOOGLE_PLACES_API_KEY");

type NearbyPlacesRequest = {
  lat: number;
  lng: number;
  radius?: number; // in meters, max 50000
  types: string[]; // multiple types supported natively (required)
  keyword?: string; // optional keyword filter
  rankPreference: string;
  maxResultCount: number;
};

export const getNearbyPlaces = onCall(
  {
    secrets: [GOOGLE_PLACES_API_KEY],
    // maxInstances: 10, // se quiser limitar
  },
  async (request) => {
    const {
      lat,
      lng,
      radius = 20000,
      types,
      keyword,
      rankPreference = "POPULARITY",
      maxResultCount = 20,
    } = request.data as NearbyPlacesRequest;

    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid coordinates"
      );
    }

    if (!Array.isArray(types) || types.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "At least one place type is required"
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Google Places API key not configured"
      );
    }

    // Use the new Places API (v1) with native support for multiple types
    const url = "https://places.googleapis.com/v1/places:searchNearby";
    const excludedTypes: string[] = [
      PlaceType.supermarket,
      PlaceType.florist,
      PlaceType.physiotherapist,
      PlaceType.hair_care,
      PlaceType.convenience_store,
      PlaceType.meal_takeaway,
      PlaceType.meal_delivery,
      PlaceType.bakery,
      "sports_complex",
    ];

    const body = {
      includedTypes: types,
      excludedTypes,
      rankPreference: rankPreference,
      maxResultCount: maxResultCount,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius,
        },
      },
      ...(keyword && { keyword }),
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new functions.https.HttpsError(
        "unknown",
        `Failed to fetch from Google Places API: ${response.status} - ${errorText}`
      );
    }

    const data: any = await response.json();

    if (!data.places || !Array.isArray(data.places)) {
      return { places: [] };
    }

    // Map to consistent format
    const places = data.places.map((place: NewPlacesAPIPlace) => ({
      placeId: place.id,
      name: place.displayName?.text || "Unknown",
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
      },
      types: place.types || [],
      type: place.types?.find((type) => types.includes(type)) || null,
      formattedAddress: place.formattedAddress,
    }));

    return { places };
  }
);

type PlacesByIdsRequest = {
  placeIds: string[];
};

export const getPlacesByIds = onCall(
  {
    secrets: [GOOGLE_PLACES_API_KEY],
  },
  async (request) => {
    const { placeIds } = request.data as PlacesByIdsRequest;

    if (!Array.isArray(placeIds) || placeIds.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "placeIds must be a non-empty array"
      );
    }

    if (placeIds.length > 50) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Maximum 50 placeIds per request"
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "internal",
        "Google Places API key not configured"
      );
    }

    // Fetch all places in parallel
    const promises = placeIds.map(async (placeId) => {
      const url = `https://places.googleapis.com/v1/places/${placeId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch place ${placeId}: ${response.status} - ${errorText}`
        );
      }

      const data: any = await response.json();

      return {
        placeId: data.id || placeId,
        name: data.displayName?.text || "Unknown",
        location: data.location
          ? { lat: data.location.latitude, lng: data.location.longitude }
          : null,
        type: data.types?.[0] || null,
        formattedAddress: data.formattedAddress || null,
      };
    });

    try {
      const places = await Promise.all(promises);
      return { places };
    } catch (error: any) {
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to fetch places"
      );
    }
  }
);

export const searchPlacesByText = onCall(
  {
    secrets: [GOOGLE_PLACES_API_KEY],
  },
  async (request) => {
    const {
      input,
      lat,
      lng,
      radius = 20000,
      sessionToken,
    } = request.data as SearchPlacesByTextRequest & { sessionToken?: string };

    if (!input || typeof input !== "string" || input.length < 2) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Input text is required and must be at least 2 characters."
      );
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid coordinates"
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Google Places API key not configured"
      );
    }

    // Allowed types for filtering results
    const allowedTypes = ["bar", "night_club", "cafe", "university", "gym"];

    const autocompleteURL =
      "https://places.googleapis.com/v1/places:autocomplete";
    const body: any = {
      input,
      includedPrimaryTypes: allowedTypes,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
    };

    // sessionToken é opcional, mas recomendado pela Google para billing/analytics
    if (sessionToken) {
      body.sessionToken = sessionToken;
    }

    const response = await fetch(autocompleteURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new functions.https.HttpsError(
        "unknown",
        `Failed to fetch from Google Places Autocomplete API: ${response.status} - ${errorText}`
      );
    }

    const data: any = await response.json();

    // Autocomplete retorna suggestions, não places
    // Cada suggestion tem place e placePrediction
    const places =
      data.suggestions?.map((suggestion: any) => ({
        placeId:
          suggestion.placePrediction?.placeId ||
          suggestion.placePrediction?.place,
        name:
          suggestion.placePrediction?.text?.text ||
          suggestion.placePrediction?.structuredFormat?.mainText?.text ||
          "Unknown",
        types: suggestion.placePrediction?.types || [],
        formattedAddress:
          suggestion.placePrediction?.structuredFormat?.secondaryText?.text ||
          "",
        location: undefined, // Autocomplete não retorna location, precisa buscar depois se necessário
      })) || [];

    // Autocomplete não suporta paginação nativa (nextPageToken)
    // Retorna todas as sugestões de uma vez (limitado pela API)
    return { places };
  }
);

type SearchTextRequest = {
  textQuery?: string;
  lat: number;
  lng: number;
  radius?: number; // in meters, max 50000
  includedType: string; // single type for this search
  maxResultCount?: number; // max 20 per request
  pageToken?: string; // for pagination
};

export const searchTextPlaces = onCall(
  {
    secrets: [GOOGLE_PLACES_API_KEY],
  },
  async (request) => {
    const {
      lat,
      lng,
      radius = 20000,
      includedType,
      maxResultCount = 20,
      pageToken,
    } = request.data as SearchTextRequest;

    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid coordinates"
      );
    }

    if (!includedType || typeof includedType !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "includedType is required"
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Google Places API key not configured"
      );
    }

    // Use the new Places API Text Search endpoint
    const url = "https://places.googleapis.com/v1/places:searchText";

    const body: any = {
      includedType,
      maxResultCount: Math.min(maxResultCount, 20), // API limit is 20
      locationBias: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius,
        },
      },
    };

    // Add pageToken if provided for pagination
    if (pageToken) {
      body.pageToken = pageToken;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types,nextPageToken",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new functions.https.HttpsError(
        "unknown",
        `Failed to fetch from Google Places Text Search API: ${response.status} - ${errorText}`
      );
    }

    const data: any = await response.json();

    if (!data.places || !Array.isArray(data.places)) {
      return { places: [], nextPageToken: null };
    }

    // Map to consistent format
    const places = data.places.map((place: NewPlacesAPIPlace) => ({
      placeId: place.id,
      name: place.displayName?.text || "Unknown",
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
      },
      types: place.types || [],
      formattedAddress: place.formattedAddress,
    }));

    return {
      places,
      nextPageToken: data.nextPageToken || null,
    };
  }
);
