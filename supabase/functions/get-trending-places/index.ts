/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

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
      // No active users currently, return empty array
      return new Response(
        JSON.stringify({ places: [] }),
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

    // Fetch place details from database using places_view (includes review data)
    const placeIds = topPlaces.map((pc: { place_id: string }) => pc.place_id);
    const { data: placesData, error: placesError } = await serviceSupabase
      .from("places_view")
      .select("id, name, category, lat, lng, street, city, review_average, review_count, review_tags")
      .in("id", placeIds);

    if (placesError) {
      console.error("Error fetching places:", placesError);
      return new Response(
        JSON.stringify({ error: "places_fetch_failed", message: placesError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!placesData || placesData.length === 0) {
      return new Response(
        JSON.stringify({ places: [] }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Create a map for quick lookup of people_count
    const countMap = new Map(
      topPlaces.map((pc: { place_id: string; people_count: number }) => [pc.place_id, pc.people_count])
    );

    // Calculate distance using Haversine formula and combine with active_users count
    const placesWithActiveUsers = placesData
      .map((place) => {
        const activeCount = countMap.get(place.id) || 0;
        
        // Calculate distance using Haversine formula (in meters)
        const R = 6371000; // Earth's radius in meters
        const lat1 = userLat * Math.PI / 180;
        const lat2 = place.lat * Math.PI / 180;
        const deltaLat = (place.lat - userLat) * Math.PI / 180;
        const deltaLng = (place.lng - userLng) * Math.PI / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        const formattedAddress = [place.street, place.house_number].filter(Boolean).join(", ");

        return {
          place_id: place.id,
          active_users: activeCount,
          name: place.name,
          formattedAddress: formattedAddress || "",
          distance: Math.round(distance),
          types: place.category ? [place.category] : [],
          latitude: place.lat,
          longitude: place.lng,
          review: place.review_count > 0 ? {
            average: place.review_average,
            count: place.review_count,
            tags: place.review_tags
          } : undefined,
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
