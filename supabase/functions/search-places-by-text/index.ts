/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { autocompletePlaces } from "../_shared/foursquare/autocomplete.ts";
import { haversineDistance } from "../_shared/haversine.ts";

// Default relevant categories for Bumpti (social discovery)
const DEFAULT_CATEGORIES = [
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

  // College
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
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with Service Role Key for RLS bypass
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      query,
      input, // Support legacy parameter
      lat,
      lng,
      radius = 20000,
      limit = 10,
      categories,
    } = body;

    // Support both 'query' and 'input' parameters for backward compatibility
    const searchQuery = query || input;

    if (!searchQuery || typeof searchQuery !== "string" || searchQuery.length < 3) {
      return new Response(JSON.stringify({ error: "invalid_query_min_3_chars" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "invalid_coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use provided categories or default to relevant social discovery categories
    const categoriesToFilter = categories || DEFAULT_CATEGORIES;

    const allPlaces = await autocompletePlaces({
      query: searchQuery,
      userLat: lat,
      userLng: lng,
      radius,
      limit: 50, // Request max results to have enough after distance filtering
      categories: categoriesToFilter,
    });

    // Calculate distance for places that don't have it, then filter by radius
    const placesWithDistance = allPlaces.map(place => {
      let distanceInMeters = place.distance;
      
      // Calculate distance if API didn't provide it or returned 0
      if ((!distanceInMeters || distanceInMeters === 0) && 
          place.latitude && place.longitude && 
          place.latitude !== 0 && place.longitude !== 0) {
        const distanceInKm = haversineDistance(lat, lng, place.latitude, place.longitude);
        distanceInMeters = distanceInKm * 1000; // Convert km to meters
      }
      
      return {
        ...place,
        distance: distanceInMeters,
      };
    });

    // Filter by distance (API returns distance in meters)
    // Foursquare radius parameter only biases results, doesn't strictly filter
    const places = placesWithDistance.filter(place => {
      return place.distance <= radius; // Keep only places within the specified radius
    });

    // Get active user counts for these places using RPC
    const placeIds = places.map(p => p.fsq_id);
    
    let placesWithActiveUsers = places.map(p => ({ ...p, active_users: 0 }));

    if (placeIds.length > 0) {
      const { data: placeCounts, error: rpcError } = await supabase
        .rpc("get_available_people_count", {
          place_ids: placeIds,
          viewer_id: user.id,
        });

      if (!rpcError && placeCounts) {
        // Create a map for quick lookup
        const countMap = new Map(
          placeCounts.map((pc: { place_id: string; people_count: number }) => [pc.place_id, pc.people_count])
        );

        // Add active_users count to each place
        placesWithActiveUsers = places.map(place => ({
          ...place,
          active_users: countMap.get(place.fsq_id) || 0,
        }));
      }
    }

    // Map to frontend expected format and limit to requested amount
    const formattedPlaces = placesWithActiveUsers
      .slice(0, limit) // Limit to requested number after filtering
      .map(place => ({
        placeId: place.fsq_id,
        name: place.name,
        formattedAddress: place.formatted_address,
        distance: place.distance / 1000, // Convert meters to kilometers for frontend
        types: place.categories?.map(c => c.name.toLowerCase().replace(/\s+/g, '_')) || [],
        active_users: place.active_users,
      }));

    return new Response(JSON.stringify({ places: formattedPlaces }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("search-places-by-text error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
