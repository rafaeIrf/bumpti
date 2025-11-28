/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { fetchPlacesByIds } from "../_shared/google-places.ts";

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

    const { data, error } = await supabase
      .from("profile_favorite_places")
      .select("place_id")
      .eq("user_id", user.id);

    if (error) throw error;

    const placeIds = (data ?? []).map((row) => row.place_id);

    if (placeIds.length === 0) {
      return new Response(JSON.stringify({ placeIds, places: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const places = await fetchPlacesByIds({
      placeIds,
      lat: requestBody.lat ?? 0,
      lng: requestBody.lng ?? 0,
    });

    return new Response(JSON.stringify({ places }), {
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
