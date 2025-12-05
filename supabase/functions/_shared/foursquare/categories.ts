/**
 * Foursquare Places API v3 Category IDs
 * Single source of truth for allowed categories in Bumpti
 * 
 * Maps general place categories to specific Foursquare category IDs
 */

// General place categories (used in frontend)
export type PlaceCategory = 
  | "bars" 
  | "nightlife" 
  | "cafes" 
  | "restaurants" 
  | "fitness" 
  | "university" 
  | "parks";

// Map general categories to Foursquare category IDs
export const CATEGORY_TO_IDS: Record<PlaceCategory, string[]> = {
  bars: [
    "4bf58dd8d48988d116941735", // Bar
    "4bf58dd8d48988d11b941735", // Pub
    "4bf58dd8d48988d1d5941735", // Cocktail Bar
    "4bf58dd8d48988d11e941735", // Beer Bar
    "4bf58dd8d48988d123941735", // Wine Bar
    "4bf58dd8d48988d1d8941735", // Speakeasy
    "4bf58dd8d48988d11c941735", // Dive Bar
    "4bf58dd8d48988d118941735", // Gay Bar
    "4bf58dd8d48988d1d4941735", // Sports Bar
    "4bf58dd8d48988d11d941735", // Karaoke Bar
    "56aa371be4b08b9a8d5734db", // Hookah Bar
    "4bf58dd8d48988d1d6941735", // Whisky Bar
    "4bf58dd8d48988d120941735", // Hotel Bar
    "4bf58dd8d48988d1d7941735", // Sake Bar
    "5744ccdfe4b0c0459246b4bb", // Tiki Bar
  ],
  nightlife: [
    "4bf58dd8d48988d11f941735", // Nightclub
    "4bf58dd8d48988d121941735", // Lounge
    "4bf58dd8d48988d1d3941735", // Jazz Club
    "4bf58dd8d48988d1e9931735", // Rock Club
    "52e81612bcbc57f1066b79e9", // Nightlife Spot
    "4bf58dd8d48988d1e7931735", // Dance Studio
  ],
  cafes: [
    "4bf58dd8d48988d16d941735", // Café
    "4bf58dd8d48988d1e0931735", // Coffee Shop
  ],
  restaurants: [
    "4bf58dd8d48988d1c4941735", // Restaurant (general)
    "4bf58dd8d48988d143941735", // American Restaurant
    "4bf58dd8d48988d14e941735", // Asian Restaurant
    "4bf58dd8d48988d145941735", // Brazilian Restaurant
    "4bf58dd8d48988d149941735", // Burger Joint
    "4bf58dd8d48988d1df931735", // Chinese Restaurant
    "55a59bace4b013909087cb0c", // Ethiopian Restaurant
    "4bf58dd8d48988d10b941735", // Fast Food Restaurant
    "4bf58dd8d48988d10c941735", // Fish & Chips Shop
    "52e81612bcbc57f1066b7a01", // Fried Chicken Joint
    "4bf58dd8d48988d155941735", // French Restaurant
    "4bf58dd8d48988d10d941735", // German Restaurant
    "4bf58dd8d48988d148941735", // Greek Restaurant
    "52e81612bcbc57f1066b79f1", // Halal Restaurant
    "4bf58dd8d48988d1c8941735", // Indian Restaurant
    "4bf58dd8d48988d110941735", // Italian Restaurant
    "4bf58dd8d48988d111941735", // Japanese Restaurant
    "52e81612bcbc57f1066b79f4", // Kebab Restaurant
    "52e81612bcbc57f1066b79f5", // Korean Restaurant
    "4bf58dd8d48988d1c5941735", // Latin American Restaurant
    "4bf58dd8d48988d1c6941735", // Mediterranean Restaurant
    "4bf58dd8d48988d1c7941735", // Mexican Restaurant
    "4bf58dd8d48988d1c9941735", // Middle Eastern Restaurant
    "52e81612bcbc57f1066b79f6", // Molecular Gastronomy Restaurant
    "4bf58dd8d48988d1ca941735", // Pizza Place
    "52e81612bcbc57f1066b79f7", // Portuguese Restaurant
    "4bf58dd8d48988d1cb941735", // Ramen Restaurant
    "4bf58dd8d48988d1cc941735", // Seafood Restaurant
    "4bf58dd8d48988d1cd941735", // Spanish Restaurant
    "4bf58dd8d48988d1ce941735", // Steakhouse
    "4bf58dd8d48988d1cf941735", // Sushi Restaurant
    "4bf58dd8d48988d1d0941735", // Thai Restaurant
    "52e81612bcbc57f1066b79f8", // Turkish Restaurant
    "4bf58dd8d48988d1d1941735", // Vegetarian / Vegan Restaurant
    "4bf58dd8d48988d1d2941735", // Vietnamese Restaurant
    "52939a643cf9994f4e043a33", // Barbecue Joint
    "52e81612bcbc57f1066b79f9", // Breakfast Spot
    "52e81612bcbc57f1066b79fa", // Brunch Restaurant
    "4bf58dd8d48988d16a941735", // Buffet
    "52e81612bcbc57f1066b79fb", // Deli / Bodega
    "52e81612bcbc57f1066b79fc", // Diner
    "52e81612bcbc57f1066b79fd", // Fondue Restaurant
    "52e81612bcbc57f1066b79fe", // Food Court
    "52e81612bcbc57f1066b79ff", // Gastropub
    "52e81612bcbc57f1066b7a00", // Gluten-free Restaurant
    "52e81612bcbc57f1066b7a02", // Kosher Restaurant
    "4bf58dd8d48988d14b941735", // Noodle House
    "52e81612bcbc57f1066b7a03", // Organic Grocery
    "52e81612bcbc57f1066b7a04", // Raw Food Restaurant
    "4bf58dd8d48988d1bd941735", // Salad Place
    "4bf58dd8d48988d1c3941735", // Sandwich Place
    "52e81612bcbc57f1066b7a05", // Soul Food Restaurant
    "4bf58dd8d48988d1d3941735", // Soup Place
    "56aa371be4b08b9a8d573532", // Southern / Soul Food Restaurant
    "52e81612bcbc57f1066b7a06", // Theme Restaurant
    "4bf58dd8d48988d16e941735", // Wings Joint
  ],
  fitness: [
    "4bf58dd8d48988d176941735", // Gym
  ],
  university: [
    "4d4b7105d754a06372d81259", // University
    "4bf58dd8d48988d198941735", // College & University
    "4bf58dd8d48988d1a5941735", // College Academic Building
    "4bf58dd8d48988d1a6941735", // College Arts Building
    "4bf58dd8d48988d1a7941735", // College Auditorium
    "4bf58dd8d48988d1a8941735", // College Gym
    "4bf58dd8d48988d1a9941735", // College Library
    "4bf58dd8d48988d1aa941735", // College Quad
    "4bf58dd8d48988d1ab941735", // College Stadium
    "4bf58dd8d48988d1ac941735", // College Cafeteria
    "4bf58dd8d48988d1ad941735", // College Bookstore
    "4bf58dd8d48988d1ae941735", // College Classroom
    "4bf58dd8d48988d1af941735", // College Lab
    "4bf58dd8d48988d1b0941735", // College Residence Hall
    "4bf58dd8d48988d1b1941735", // Fraternity House
    "4bf58dd8d48988d1b2941735", // Sorority House
    "4bf58dd8d48988d130941735", // School
  ],
  parks: [
    "4bf58dd8d48988d163941735", // Park
  ],
};

// All allowed category IDs for Bumpti (flat list for validation)
export const ALLOWED_CATEGORY_IDS = new Set(
  Object.values(CATEGORY_TO_IDS).flat()
);

// Category IDs for large venues that can have >100m radius (for geotagging)
export const LARGE_VENUE_CATEGORIES = new Set([
  // Universities and College buildings
  "4d4b7105d754a06372d81259", // University
  "4bf58dd8d48988d198941735", // College & University
  "4bf58dd8d48988d1a5941735", // College Academic Building
  "4bf58dd8d48988d1a6941735", // College Arts Building
  "4bf58dd8d48988d1a7941735", // College Auditorium
  "4bf58dd8d48988d1a8941735", // College Gym
  "4bf58dd8d48988d1a9941735", // College Library
  "4bf58dd8d48988d1aa941735", // College Quad
  "4bf58dd8d48988d1ab941735", // College Stadium
  "4bf58dd8d48988d1ac941735", // College Cafeteria
  "4bf58dd8d48988d1ad941735", // College Bookstore
  "4bf58dd8d48988d1ae941735", // College Classroom
  "4bf58dd8d48988d1af941735", // College Lab
  "4bf58dd8d48988d1b0941735", // College Residence Hall
  "4bf58dd8d48988d1b1941735", // Fraternity House
  "4bf58dd8d48988d1b2941735", // Sorority House
  "4bf58dd8d48988d130941735", // School
  
  // Other large venues
  "4bf58dd8d48988d1fd941735", // Shopping Mall
  "4bf58dd8d48988d163941735", // Park
]);
