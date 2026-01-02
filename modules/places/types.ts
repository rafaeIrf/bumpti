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

export type Place = {
  placeId: string;
  name: string;
  formattedAddress?: string;
  distance: number; // in km
  latitude: number;
  longitude: number;
  types?: string[]; // Para autocomplete - raw Foursquare category names
  active_users?: number; // Optional: number of active users currently at the place
  favorites_count?: number; // Optional: number of favorites for the place
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
  | "fitness_centre" 
  | "university" 
  | "college" 
  | "park"
  | "museum"
  | "stadium"
  | "library"
  | "sports_centre"
  | "community_centre"
  | "events_venue"
  | "language_school"
  | "club";
