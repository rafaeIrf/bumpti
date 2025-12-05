export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number; // horizontal accuracy in meters
};

export type Place = {
  placeId: string;
  name: string;
  formattedAddress?: string;
  distance: number; // in km
  latitude: number;
  longitude: number;
  type?: PlaceType | null;
  types?: string[]; // Para autocomplete
  active_users?: number; // Optional: number of active users currently at the place
};

export type NearbyPlacesResponse = { places: Place[] };

// Foursquare Places API v3 category IDs
// Source: https://docs.foursquare.com/data-products/docs/categories
// These are the main categories used in Bumpti for social discovery

export enum PlaceType {
  // Nightlife & Entertainment
  bar = "4bf58dd8d48988d116941735",
  pub = "4bf58dd8d48988d11b941735",
  nightclub = "4bf58dd8d48988d11f941735",
  lounge = "4bf58dd8d48988d121941735",
  
  // Food & Beverage
  cafe = "4bf58dd8d48988d16d941735",
  coffee_shop = "4bf58dd8d48988d1e0931735",
  restaurant = "4bf58dd8d48988d1c4941735",
  
  // Fitness & Education
  gym = "4bf58dd8d48988d176941735",
  fitness_center = "4bf58dd8d175941735",
  university = "4bf58dd8d48988d1ae941735",
  
  // Entertainment & Culture
  movie_theater = "4bf58dd8d48988d17f941735",
  museum = "4bf58dd8d48988d181941735",
  art_gallery = "4bf58dd8d48988d1e2931735",
  theater = "4bf58dd8d48988d137941735",
  music_venue = "4bf58dd8d48988d1e5931735",
  
  // Shopping & Services
  shopping_mall = "4bf58dd8d48988d1fd941735",
  park = "4bf58dd8d48988d163941735",
  beach = "4bf58dd8d48988d1e2941735",
}

export const ALL_PLACE_TYPES: PlaceType[] = Object.values(PlaceType);

// Default categories for social discovery (Nightlife, Food, Fitness, Education)
export const DEFAULT_PLACE_TYPES: PlaceType[] = [
  PlaceType.bar,
  PlaceType.pub,
  PlaceType.nightclub,
  PlaceType.lounge,
  PlaceType.cafe,
  PlaceType.coffee_shop,
  PlaceType.gym,
  PlaceType.university,
];

// Human-friendly labels for Foursquare categories
export const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  // Nightlife & Entertainment
  [PlaceType.bar]: "Bar",
  [PlaceType.pub]: "Pub",
  [PlaceType.nightclub]: "Nightclub",
  [PlaceType.lounge]: "Lounge",
  
  // Food & Beverage
  [PlaceType.cafe]: "Café",
  [PlaceType.coffee_shop]: "Coffee Shop",
  [PlaceType.restaurant]: "Restaurant",
  
  // Fitness & Education
  [PlaceType.gym]: "Gym",
  [PlaceType.fitness_center]: "Fitness Center",
  [PlaceType.university]: "University",
  
  // Entertainment & Culture
  [PlaceType.movie_theater]: "Movie Theater",
  [PlaceType.museum]: "Museum",
  [PlaceType.art_gallery]: "Art Gallery",
  [PlaceType.theater]: "Theater",
  [PlaceType.music_venue]: "Music Venue",
  
  // Shopping & Services
  [PlaceType.shopping_mall]: "Shopping Mall",
  [PlaceType.park]: "Park",
  [PlaceType.beach]: "Beach",
};
