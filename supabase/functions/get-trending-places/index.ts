/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { getPlaceDetails } from "../_shared/foursquare/placeDetails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "config_missing" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    // Service client to bypass RLS for reading presences
    const serviceSupabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabase;

    // Verify user authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse request body for lat/lng
    let requestBody: { lat?: number; lng?: number } = {};
    try {
      requestBody = (await req.json()) ?? {};
    } catch {
      // ignore body parse errors
    }

    const userLat = requestBody.lat ?? 0;
    const userLng = requestBody.lng ?? 0;

    // Get active presences excluding current user
    const now = new Date();
    const nowISO = now.toISOString();
    
    // Get active presences excluding current user
    const { data: presences, error: presencesError } = await serviceSupabase
      .from("user_presences")
      .select("place_id, user_id, active, expires_at")
      .eq("active", true)
      .neq("user_id", user.id)
      .gt("expires_at", nowISO);

    if (presencesError) {
      console.error("Error fetching presences:", presencesError);
      return new Response(
        JSON.stringify({ error: "fetch_failed", message: presencesError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!presences || presences.length === 0) {
      // Fallback: Get places from recent presences (last 7 days) - including current user for trending suggestion
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPresences } = await serviceSupabase
        .from("user_presences")
        .select("place_id")
        .gte("entered_at", sevenDaysAgo);
      
      if (!recentPresences || recentPresences.length === 0) {
        return new Response(
          JSON.stringify({ places: [] }),
          { status: 200, headers: corsHeaders }
        );
      }
      
      // Count by place_id for popular places
      const recentPlaceCountMap = new Map<string, number>();
      recentPresences.forEach((p) => {
        const count = recentPlaceCountMap.get(p.place_id) || 0;
        recentPlaceCountMap.set(p.place_id, count + 1);
      });
      
      const topRecentPlaces = Array.from(recentPlaceCountMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      const placeIds = topRecentPlaces.map(([placeId]) => placeId);
      const placesData = await getPlaceDetails({
        fsq_ids: placeIds,
        userLat,
        userLng,
      });
      
      const placesWithZeroActiveUsers = placesData.map((place) => ({
        place_id: place.fsq_id,
        active_users: 0, // No active users right now
        name: place.name,
        address: place.formatted_address || "",
        distance: place.distance,
        types: place.categories?.map(c => c.name.toLowerCase().replace(/\s+/g, '_')) || [],
      }));
      
      return new Response(
        JSON.stringify({ places: placesWithZeroActiveUsers }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get unique place_ids from active presences
    const uniquePlaceIds = Array.from(
      new Set(presences.map((p) => p.place_id).filter(Boolean))
    );

    // Call RPC to get available people count per place (filters out viewer, dislikes, unexpired likes)
    const { data: placeCounts, error: rpcError } = await serviceSupabase
      .rpc("get_available_people_count", {
        place_ids: uniquePlaceIds,
        viewer_id: user.id,
      });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "rpc_error", message: rpcError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!placeCounts || placeCounts.length === 0) {
      return new Response(
        JSON.stringify({ places: [] }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Filter places with at least 1 person and sort by people_count descending
    const topPlaces = placeCounts
      .filter((pc: { place_id: string; people_count: number }) => pc.people_count > 0)
      .sort((a: { people_count: number }, b: { people_count: number }) => b.people_count - a.people_count)
      .slice(0, 10);

    if (topPlaces.length === 0) {
      return new Response(
        JSON.stringify({ places: [] }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Fetch place details using Foursquare
    const placeIds = topPlaces.map((pc: { place_id: string }) => pc.place_id);
    const placesData = await getPlaceDetails({
      fsq_ids: placeIds,
      userLat,
      userLng,
    });

    // Create a map for quick lookup of people_count
    const countMap = new Map(
      topPlaces.map((pc: { place_id: string; people_count: number }) => [pc.place_id, pc.people_count])
    );

    // Combine with active_users count from RPC and filter out places with 0 users
    const placesWithActiveUsers = placesData
      .map((place) => {
        const activeCount = countMap.get(place.fsq_id) || 0;
        return {
          place_id: place.fsq_id,
          active_users: activeCount,
          name: place.name,
          address: place.formatted_address || "",
          distance: place.distance,
          types: place.categories?.map(c => c.name.toLowerCase().replace(/\s+/g, '_')) || [],
        };
      })
      .filter((place) => place.active_users > 0) // Remove places with 0 active users
      .sort((a, b) => b.active_users - a.active_users); // Sort by active_users descending

    return new Response(
      JSON.stringify({ places: placesWithActiveUsers }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Internal error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
