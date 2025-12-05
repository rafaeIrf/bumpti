/**
 * Foursquare Places API v3 Category IDs
 * Single source of truth for allowed categories in Bumpti
 * 
 * These categories are used across:
 * - search-places-by-text: autocomplete and search
 * - get-nearby-places: nearby search
 * - geotag: place detection
 */

// All allowed category IDs for Bumpti (social discovery)
export const ALLOWED_CATEGORY_IDS = new Set([
  // Bars & Nightlife (all subcategories)
  "4bf58dd8d48988d116941735", // Bar
  "4bf58dd8d48988d11b941735", // Pub
  "4bf58dd8d48988d11f941735", // Nightclub
  "4bf58dd8d48988d121941735", // Lounge
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
  "4bf58dd8d48988d1d3941735", // Jazz Club
  "4bf58dd8d48988d1e9931735", // Rock Club
  "52e81612bcbc57f1066b79e9", // Nightlife Spot
  "4bf58dd8d48988d1e7931735", // Dance Studio (can have nightlife events)
  "5744ccdfe4b0c0459246b4bb", // Tiki Bar
  
  // Food & Beverage
  "4bf58dd8d48988d16d941735", // Café
  "4bf58dd8d48988d1e0931735", // Coffee Shop
  "4bf58dd8d48988d1c4941735", // Restaurant
  "52939a643cf9994f4e043a33", // Barbecue
  
  // Fitness & Education
  "4bf58dd8d48988d176941735", // Gym
  "4bf58dd8d175941735",        // Fitness Center

  // College & University (all subcategories)
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
  
  // Entertainment & Culture
  "4bf58dd8d48988d137941735", // Theater
  "4bf58dd8d48988d1e5931735", // Music Venue
  "4bf58dd8d48988d1fd941735", // Shopping Mall
  "4bf58dd8d48988d163941735", // Park
]);

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
