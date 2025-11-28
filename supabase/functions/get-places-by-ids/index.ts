/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />

import { fetchPlacesByIds } from "../_shared/google-places.ts";

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
    const { placeIds, lat = 0, lng = 0 } = await req.json();

    if (!Array.isArray(placeIds) || placeIds.length === 0) {
      return new Response(JSON.stringify({ error: "placeIds_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (placeIds.length > 50) {
      return new Response(JSON.stringify({ error: "too_many_placeIds" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const places = await fetchPlacesByIds({ placeIds, lat, lng });

    return new Response(JSON.stringify({ places }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-places-by-ids error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
