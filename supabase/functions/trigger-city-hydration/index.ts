import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { triggerCityHydrationIfNeeded } from "../_shared/triggerCityHydration.ts";

/**
 * Proactive City Hydration Edge Function (Overture-Native)
 * 
 * PRIMARY USE CASE: Called during user onboarding after location permission granted
 * - Pre-hydrates user's current city for instant data availability
 * - Improves first-time user experience by preparing data in advance
 * 
 * SECONDARY USE CASE: Manual trigger for testing/admin purposes
 * 
 * NOTE: places-nearby and places-autocomplete also have fallback hydration
 * for cases where user travels to new cities.
 */

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: latitude, longitude" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const githubToken = Deno.env.get("GH_HYDRATION_TOKEN")!;

    console.log(`🌍 Proactive hydration request: (${latitude}, ${longitude})`);

    // Use shared helper for consistent hydration logic
    const result = await triggerCityHydrationIfNeeded(
      supabaseUrl,
      serviceRoleKey,
      latitude.toString(),
      longitude.toString(),
      githubToken
    );

    console.log(`✅ Hydration result:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in trigger-city-hydration:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
