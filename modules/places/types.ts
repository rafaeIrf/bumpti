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
  types?: string[]; // Para autocomplete - raw Foursquare category names
  active_users?: number; // Optional: number of active users currently at the place
};

export type NearbyPlacesResponse = { places: Place[] };

// General place categories (mapped to multiple Foursquare IDs in backend)
export type PlaceCategory = 
  | "bars" 
  | "nightlife" 
  | "cafes" 
  | "restaurants" 
  | "fitness" 
  | "university" 
  | "parks";

// Human-friendly labels for categories
export const PLACE_CATEGORY_LABEL: Record<PlaceCategory, string> = {
  bars: "Bar",
  nightlife: "Nightclub",
  cafes: "Café",
  restaurants: "Restaurant",
  fitness: "Gym",
  university: "University",
  parks: "Park",
};
