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
  | "park";
