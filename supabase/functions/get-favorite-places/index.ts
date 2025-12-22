/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "unauthorized", message: "Missing access token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      throw new Error(userError?.message ?? "User not found");
    }

    let requestBody: { lat?: number; lng?: number } = {};
    if (req.method === "POST") {
      try {
        requestBody = (await req.json()) ?? {};
      } catch {
        // ignore body parse errors for GET-compat
      }
    }

    const userLat = requestBody.lat ?? 0;
    const userLng = requestBody.lng ?? 0;

    // Fetch favorite places with details from database using JOIN
    const { data: favoritePlaces, error } = await supabase
      .from("profile_favorite_places")
      .select(`
        place_id,
        places:places(
          id,
          name,
          category,
          lat,
          lng,
          street,
          city
        )
      `)
      .eq("user_id", user.id);

    if (error) throw error;

    if (!favoritePlaces || favoritePlaces.length === 0) {
      return new Response(JSON.stringify({ places: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract place IDs for RPC call
    const placeIds = favoritePlaces.map((row: any) => row.place_id).filter(Boolean);

    // Get active user counts for these places using RPC
    const { data: placeCounts, error: rpcError } = await supabase
      .rpc("get_available_people_count", {
        place_ids: placeIds,
        viewer_id: user.id,
      });

    // Create a map for quick lookup
    const countMap = new Map(
      (placeCounts || []).map((pc: { place_id: string; people_count: number }) => [pc.place_id, pc.people_count])
    );

    // Calculate distance and map places with active users count
    const placesWithActiveUsers = favoritePlaces
      .map((row: any) => {
        const place = row.places;
        if (!place) return null;

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

        const formattedAddress = [place.street, place.city].filter(Boolean).join(", ");

        return {
          placeId: place.id,
          name: place.name,
          distance: Math.round(distance),
          formattedAddress: formattedAddress || "",
          types: place.category ? [place.category] : [],
          latitude: place.lat,
          longitude: place.lng,
          active_users: countMap.get(place.id) || 0,
        };
      })
      .filter((place): place is NonNullable<typeof place> => place !== null);

    // Sort by distance (ascending - closest first)
    placesWithActiveUsers.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    return new Response(JSON.stringify({ places: placesWithActiveUsers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-favorite-places error:", error);
    return new Response(
      JSON.stringify({
        error: "fetch_favorites_failed",
        message: error?.message ?? "Unable to fetch favorites.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
