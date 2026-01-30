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

/**
 * Public endpoint to fetch app configuration for a platform.
 * No authentication required - used for version checks before app loads.
 *
 * Query params:
 * - platform: "ios" | "android" (required)
 */
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

  try {
    // Get platform from query params (GET) or body (POST)
    let platform: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      platform = url.searchParams.get("platform");
    } else {
      const body = await req.json().catch(() => ({}));
      platform = body.platform;
    }

    if (!platform || !["ios", "android"].includes(platform)) {
      return new Response(
        JSON.stringify({
          error: "invalid_platform",
          message: "Platform must be 'ios' or 'android'",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await supabase
      .from("app_config")
      .select("*")
      .eq("platform", platform)
      .single();

    if (error) {
      console.error("get-app-config error:", error);

      // If no config found, return defaults (allow app to continue)
      if (error.code === "PGRST116") {
        return new Response(
          JSON.stringify({
            platform,
            min_version: "1.0.0",
            latest_version: "1.0.0",
            store_url: null,
            active_categories: [
              "bar",
              "nightclub",
              "university",
              "park",
              "cafe",
              "gym",
              "shopping",
              "library",
            ],
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "fetch_config_failed",
          message: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-app-config unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
