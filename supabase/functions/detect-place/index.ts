/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signUserAvatars } from "../_shared/signPhotoUrls.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

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
}

interface PlaceCandidate {
  id: string;
  name: string;
  category: string;
  relevance_score: number;
  boundary_area_sqm: number;
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

    const { lat, lng, hacc } = body;

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

    // If horizontal accuracy is too poor (>80m), don't return suggestions
    if (hacc && hacc > 80) {
      console.warn(`Location accuracy too poor (${hacc}m). Not detecting place.`);
      return new Response(
        JSON.stringify({
          data: { suggested: null },
          error: null,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase configuration missing");
      return new Response(
        JSON.stringify({
          data: null,
          error: "configuration_error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    });

    // Get user from JWT
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("No authenticated user found");
      return new Response(
        JSON.stringify({
          data: { suggested: null },
          error: null,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Call RPC to get place candidate based on boundary intersection
    // RPC checks if user has active check-in. Dismissal filtering is client-side.
    // RPC now returns a single jsonb object with complete place info
    const { data: candidate, error: rpcError } = await supabase.rpc(
      "get_current_place_candidate",
      {
        p_user_id: user.id,
        user_lat: lat,
        user_lng: lng,
      }
    );

    if (rpcError) {
      console.error("RPC error:", rpcError.message);
      return new Response(
        JSON.stringify({
          data: null,
          error: "rpc_failed",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // RPC returns a single jsonb object or null
    let suggested = candidate || null;

    // Sign preview avatar URLs if place has avatars using admin client
    if (suggested && suggested.preview_avatars && suggested.preview_avatars.length > 0) {
      const adminSupabase = createAdminClient();
      const signedAvatars = await signUserAvatars(adminSupabase, suggested.preview_avatars);
      suggested = {
        ...suggested,
        preview_avatars: signedAvatars,
      };
    }

    return new Response(
      JSON.stringify({
        data: { suggested },
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
