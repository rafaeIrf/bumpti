/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { CATEGORY_TO_IDS, type PlaceCategory } from "../_shared/foursquare/categories.ts";
import { searchNearbyPlaces } from "../_shared/foursquare/searchNearby.ts";

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

    const {
      lat,
      lng,
      category,
      radius = 20000,
    } = await req.json();

    console.log("=== GET NEARBY PLACES DEBUG ===");
    console.log("Received category:", category);

    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "invalid_coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!category || typeof category !== "string") {
      return new Response(JSON.stringify({ error: "missing_or_invalid_category" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert category to Foursquare IDs
    const foursquareIds = CATEGORY_TO_IDS[category as PlaceCategory];
    if (!foursquareIds) {
      return new Response(JSON.stringify({ error: "invalid_category" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Category "${category}" mapped to ${foursquareIds.length} Foursquare IDs`);

    const places = await searchNearbyPlaces({
      userLat: lat,
      userLng: lng,
      radius,
      categories: foursquareIds,
      openNow: true,
    });

    console.log("Places returned:", places.length);
    if (places.length > 0) {
      console.log("First place:", {
        name: places[0].name,
        categories: places[0].categories?.map(c => c.name),
        category_ids: places[0].categories?.map(c => c.fsq_category_id)
      });
    }

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

    // Sort by distance (ascending - closest first)
    placesWithActiveUsers.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    // Map to frontend expected format
    const formattedPlaces = placesWithActiveUsers.map(place => ({
      placeId: place.fsq_id,
      name: place.name,
      formattedAddress: place.formatted_address,
      distance: place.distance,
      types: place.categories?.map(c => c.name.toLowerCase().replace(/\s+/g, '_')) || [],
      categories: place.categories,
      latitude: place.latitude,
      longitude: place.longitude,
      active_users: place.active_users,
      popularity: place.popularity,
    }));

    return new Response(JSON.stringify({ places: formattedPlaces }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-nearby-places error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
