export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number; // horizontal accuracy in meters
};

export const PLACE_VIBES = [
  "easy_to_connect",
  "hard_to_connect",
  "open_crowd",
  "reserved_crowd",
  "meet_new_people",
  "closed_groups",
  "community_vibe",
  "solo_friendly",
  "better_with_company",
  "easy_to_join_groups",
  "socially_active",
  "low_social_interaction",
  "conversation_focused",
  "activity_focused",
  "works_better_daytime",
  "works_better_nighttime",
] as const;

export type PlaceVibe = (typeof PLACE_VIBES)[number];

export type PlaceReview = {
  average: number;
  count: number;
  tags?: PlaceVibe[];
};

// Avatar with user_id for real-time updates
export type UserAvatar = {
  user_id: string;
  url: string;
};

export type Place = {
  placeId: string;
  name: string;
  formattedAddress?: string;
  neighborhood?: string; // NEW: Bairro name
  distance: number; // in km
  latitude: number;
  longitude: number;
  types?: string[]; // Para autocomplete - raw Foursquare category names
  active_users?: number; // Optional: number of active users currently at the place
  preview_avatars?: UserAvatar[]; // Optional: active user avatars with user_id for real-time removal
  favorites_count?: number; // Optional: number of favorites for the place
  total_checkins?: number; // Total check-ins all time
  monthly_checkins?: number; // Check-ins this month (resets on 1st)
  total_matches?: number; // Total matches generated at this place
  rank?: number; // Ranking position (1-based, only for popularity/trending sorts)
  review?: PlaceReview;
};

export type CityPrediction = {
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
};

export type NearbyPlacesResponse = { places: Place[] };

export type PlaceCategory =
  | "bar"
  | "nightclub"
  | "cafe"
  | "restaurant"
  | "gym"
  | "university"
  | "park"
  | "museum"
  | "stadium"
  | "library"
  | "sports_centre"
  | "community_centre"
  | "event_venue"
  | "language_school"
  | "club"
  | "theatre"
  | "plaza"
  | "shopping"
  | "skate_park";

// Place Reports
export type PlaceReportReason =
  | "closed"
  | "wrong_info"
  | "does_not_exist"
  | "inappropriate"
  | "other";

export interface CreatePlaceReportParams {
  placeId: string;
  reason: PlaceReportReason;
  description?: string;
}

export interface CreatePlaceReportResult {
  success: boolean;
  error?: string;
}

