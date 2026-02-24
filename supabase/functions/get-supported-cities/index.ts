/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Approximate squared distance between two lat/lng points (no sqrt needed for sorting). */
function squaredDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const latRad = (lat1 * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlng = (lng2 - lng1) * Math.cos(latRad);
  return dlat * dlat + dlng * dlng;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get("lat") ?? "");
    const lng = parseFloat(url.searchParams.get("lng") ?? "");
    const hasCoords = !isNaN(lat) && !isNaN(lng);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch all completed cities (PostgREST .order() only accepts column names,
    // not SQL expressions — so we sort the small result set in JS instead).
    const { data, error } = await supabaseClient
      .from("cities_registry")
      .select("id, city_name, country_code, lat, lng")
      .eq("status", "completed")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (error) {
      console.error("Error fetching cities:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cities = data ?? [];

    if (hasCoords) {
      // Sort by approximate distance from user — fast for ≤20 cities.
      cities.sort(
        (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
          squaredDistance(lat, lng, a.lat, a.lng) -
          squaredDistance(lat, lng, b.lat, b.lng),
      );
    } else {
      // Fallback: alphabetical
      cities.sort((a: { city_name: string }, b: { city_name: string }) =>
        a.city_name.localeCompare(b.city_name),
      );
    }

    return new Response(JSON.stringify({ cities }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
