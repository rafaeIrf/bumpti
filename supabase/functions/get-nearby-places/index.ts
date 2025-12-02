/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { fetchNearbyPlaces } from "../_shared/google-places.ts";

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
      radius = 20000,
      types,
      keyword,
      rankPreference = "POPULARITY",
      maxResultCount = 20,
    } = await req.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "invalid_coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(types) || types.length === 0) {
      return new Response(JSON.stringify({ error: "types_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const places = await fetchNearbyPlaces({
      lat,
      lng,
      radius,
      types,
      keyword,
      rankPreference,
      maxResultCount,
    });

    // Get active user counts for these places using RPC
    const placeIds = places.map(p => p.placeId);
    
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
          active_users: countMap.get(place.placeId) || 0,
        }));
      }
    }

    return new Response(JSON.stringify({ places: placesWithActiveUsers }), {
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
