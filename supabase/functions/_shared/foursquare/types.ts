/**
 * Foursquare API Types
 */

/**
 * Foursquare sort order enum
 * Specifies the order in which results are listed
 */
export enum FoursquareSortOrder {
  RELEVANCE = "RELEVANCE",
  RATING = "RATING",
  DISTANCE = "DISTANCE",
  POPULARITY = "POPULARITY",
}

export interface FoursquareCategory {
  fsq_category_id: string;
  name: string;
  short_name?: string;
  plural_name?: string;
  icon?: {
    prefix: string;
    suffix: string;
  };
}

export interface FoursquareGeocode {
  main: {
    latitude: number;
    longitude: number;
  };
}

export interface FoursquarePhoto {
  id: string;
  created_at: string;
  prefix: string;
  suffix: string;
  width: number;
  height: number;
}

export interface FoursquareSocialMedia {
  facebook_id?: string;
  instagram?: string;
  twitter?: string;
}

/**
 * Common Place Result (base structure)
 */
export interface PlaceResult {
  fsq_id: string;
  name: string;
  formatted_address?: string;
  categories: FoursquareCategory[];
  latitude: number;
  longitude: number;
  distance: number; // in kilometers
}

/**
 * Autocomplete Place Result
 */
export interface PlaceAutocompleteResult extends PlaceResult {}

/**
 * Nearby Search Place Result
 */
export interface PlaceNearbyResult extends PlaceResult {
  popularity?: number;
}

/**
 * Place Details Result
 */
export interface PlaceDetailsResult extends PlaceResult {
  photos?: FoursquarePhoto[];
  social_media?: FoursquareSocialMedia;
  popularity?: number;
}

/**
 * Function Parameters
 */
export interface AutocompletePlacesParams {
  query: string;
  userLat: number;
  userLng: number;
  radius?: number;
  limit?: number;
  categories?: string[]; // Client-side filter - Foursquare category IDs to filter results
}

export interface SearchNearbyPlacesParams {
  userLat: number;
  userLng: number;
  radius?: number;
  limit?: number;
  categories?: string[]; // Foursquare category IDs to filter by
  openNow?: boolean; // Filter only places that are currently open
  sort?: FoursquareSortOrder; // Order in which results are listed
}

export interface GetPlaceDetailsParams {
  fsq_ids: string[];
  userLat: number;
  userLng: number;
}
