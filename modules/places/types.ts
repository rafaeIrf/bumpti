export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number; // horizontal accuracy in meters
};

export const PLACE_VIBES = [
  "lively",
  "quiet",
  "energetic",
  "cozy",
  "easyConversation",
  "keepToSelf",
  "meetPeople",
  "closedGroups",
  "goodSolo",
  "betterAccompanied",
  "goodDay",
  "goodNight",
  "weekendBest",

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
  | "club";
