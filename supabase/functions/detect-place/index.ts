/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { geotagCandidates } from "../_shared/foursquare/geotag.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface DetectPlaceRequest {
  lat?: number;
  lng?: number;
  hacc?: number;
  limit?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        data: null,
        error: "method_not_allowed",
      }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Parse request body
    let body: DetectPlaceRequest = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          data: null,
          error: "invalid_json",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { lat, lng, hacc, limit } = body;

    // Validate required parameters
    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({
          data: null,
          error: "missing_coordinates",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(
        JSON.stringify({
          data: null,
          error: "invalid_coordinates",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Call geotagging API
    const result = await geotagCandidates({
      lat,
      lng,
      hacc: hacc ?? 20,
      limit: limit ?? 10,
    });

    // Handle API failure
    if (result === null) {
      return new Response(
        JSON.stringify({
          data: null,
          error: "geotag_api_failed",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Return successful response
    return new Response(
      JSON.stringify({
        data: {
          suggested: result.suggested,
        },
        error: null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("detect-place error:", (error as Error).message);
    return new Response(
      JSON.stringify({
        data: null,
        error: "internal_error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
