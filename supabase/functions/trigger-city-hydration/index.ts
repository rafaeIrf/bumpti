import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const NOMINATIM_USER_AGENT = "Bumpti-Expansion-Service/1.0";
const STALE_THRESHOLD_DAYS = 30;

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse request body
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "latitude and longitude required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================
    // STEP 1: Check if coordinates are in existing city
    // =========================================
    const point = `POINT(${longitude} ${latitude})`;
    const { data: existingCity, error: cityError } = await supabase
      .from("cities_registry")
      .select("*")
      .eq("status", "completed")
      .filter("geom", "st_contains", point)
      .single();

    if (cityError && cityError.code !== "PGRST116") {
      console.error("City lookup error:", cityError);
    }

    // If city found, check if stale (> 30 days)
    if (existingCity) {
      const lastHydrated = existingCity.last_hydrated_at
        ? new Date(existingCity.last_hydrated_at)
        : null;
      const now = new Date();
      const daysSinceHydration = lastHydrated
        ? (now.getTime() - lastHydrated.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      if (daysSinceHydration < STALE_THRESHOLD_DAYS) {
        // Data is fresh
        return new Response(
          JSON.stringify({
            status: "fresh",
            city: {
              name: existingCity.city_name,
              country_code: existingCity.country_code,
              last_hydrated_at: existingCity.last_hydrated_at,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Data is stale - trigger background revalidation
        await supabase
          .from("cities_registry")
          .update({
            status: "processing",
            priority_score: existingCity.priority_score + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCity.id);

        // Dispatch GitHub Actions workflow for update
        const githubToken = Deno.env.get("GITHUB_HYDRATION_TOKEN");
        await fetch(
          "https://api.github.com/repos/rafaeIrf/bumpin/dispatches",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github.v3+json",
            },
            body: JSON.stringify({
              event_type: "hydrate_city",
              client_payload: {
                city_id: existingCity.id,
                city_name: existingCity.city_name,
                bbox: existingCity.bbox,
                country_code: existingCity.country_code,
                is_update: true,
              },
            }),
          }
        );

        return new Response(
          JSON.stringify({
            status: "stale_revalidating",
            city: {
              name: existingCity.city_name,
              country_code: existingCity.country_code,
              last_hydrated_at: existingCity.last_hydrated_at,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // =========================================
    // STEP 2: Reverse Geocode (2-step Nominatim)
    // =========================================

    // Step 2.1: Get city and country
    const reverseUrl =
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&zoom=10&format=json`;

    const reverseRes = await fetch(reverseUrl, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
    });

    if (!reverseRes.ok) {
      throw new Error("Nominatim reverse geocoding failed");
    }

    const reverseData = await reverseRes.json();
    const cityName =
      reverseData.address?.city ||
      reverseData.address?.town ||
      reverseData.address?.municipality;
    const countryCode = reverseData.address?.country_code?.toUpperCase();

    if (!cityName || !countryCode) {
      return new Response(
        JSON.stringify({ error: "Could not identify city from coordinates" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2.2: Get official polygon and BBox
    const searchUrl =
      `https://nominatim.openstreetmap.org/search?` +
      `city=${encodeURIComponent(cityName)}&` +
      `country=${countryCode}&` +
      `polygon_geojson=1&format=jsonv2&limit=1`;

    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
    });

    if (!searchRes.ok) {
      throw new Error("Nominatim search failed");
    }

    const searchData = await searchRes.json();
    if (!searchData || searchData.length === 0) {
      return new Response(
        JSON.stringify({ error: "City polygon not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const place = searchData[0];
    const geojson = place.geojson;

    // CRITICAL: Convert Nominatim BBox format [minLat, maxLat, minLon, maxLon]
    // to GIS format [minLon, minLat, maxLon, maxLat]
    const nominatimBbox = place.boundingbox;
    const gisBbox = [
      parseFloat(nominatimBbox[2]), // minLon
      parseFloat(nominatimBbox[0]), // minLat
      parseFloat(nominatimBbox[3]), // maxLon
      parseFloat(nominatimBbox[1]), // maxLat
    ];

    // =========================================
    // STEP 3: Insert city and trigger hydration
    // =========================================

    // Convert GeoJSON to WKT for PostGIS
    const geometry = geojson.type === "MultiPolygon"
      ? geojson
      : { type: "MultiPolygon", coordinates: [geojson.coordinates] };

    const { data: newCity, error: insertError } = await supabase
      .from("cities_registry")
      .insert({
        city_name: cityName,
        country_code: countryCode,
        geom: `SRID=4326;${JSON.stringify(geometry)}`,
        bbox: gisBbox,
        status: "processing",
        priority_score: 0,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique constraint violation - city already exists
        return new Response(
          JSON.stringify({ status: "in_progress" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertError;
    }

    // Dispatch GitHub Actions workflow
    const githubToken = Deno.env.get("GITHUB_HYDRATION_TOKEN");
    const dispatchRes = await fetch(
      "https://api.github.com/repos/rafaeIrf/bumpin/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          event_type: "hydrate_city",
          client_payload: {
            city_id: newCity.id,
            city_name: cityName,
            bbox: gisBbox,
            country_code: countryCode,
            is_update: false,
          },
        }),
      }
    );

    if (!dispatchRes.ok) {
      console.error("GitHub dispatch failed:", await dispatchRes.text());
      throw new Error("Failed to trigger hydration workflow");
    }

    return new Response(
      JSON.stringify({
        status: "triggered",
        city: {
          name: cityName,
          country_code: countryCode,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in trigger-city-hydration:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
