/**
 * Foursquare API Integration Modules
 * 
 * These modules provide reusable functions to interact with Foursquare Places API v3.
 * All functions calculate distance using the haversine formula.
 * 
 * Usage:
 * ```typescript
 * import { autocompletePlaces } from "./_shared/foursquare/autocomplete.ts";
 * import { searchNearbyPlaces } from "./_shared/foursquare/searchNearby.ts";
 * import { getPlaceDetails } from "./_shared/foursquare/placeDetails.ts";
 * ```
 */

export { autocompletePlaces } from "./autocomplete.ts";
export { getPlaceDetails } from "./placeDetails.ts";
export { searchNearbyPlaces } from "./searchNearby.ts";

export type {
    AutocompletePlacesParams, GetPlaceDetailsParams, PlaceAutocompleteResult, PlaceDetailsResult, PlaceNearbyResult, SearchNearbyPlacesParams
} from "./types.ts";

