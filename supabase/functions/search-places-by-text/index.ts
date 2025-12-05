/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { autocompletePlaces } from "../_shared/foursquare/autocomplete.ts";
import { ALLOWED_CATEGORY_IDS } from "../_shared/foursquare/categories.ts";
import { haversineDistance } from "../_shared/haversine.ts";

// Convert Set to Array for Foursquare API
const DEFAULT_CATEGORIES = Array.from(ALLOWED_CATEGORY_IDS);

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
    const categoriesToFilter = DEFAULT_CATEGORIES;

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
        latitude: place.latitude,
        longitude: place.longitude,
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
