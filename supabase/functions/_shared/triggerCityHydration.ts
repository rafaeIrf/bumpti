import { createClient } from "jsr:@supabase/supabase-js@2";

const NOMINATIM_USER_AGENT = "Bumpti-Expansion-Service/1.0";
const STALE_THRESHOLD_DAYS = 30;

interface CityHydrationResult {
  status: "fresh" | "stale_revalidating" | "triggered" | "in_progress" | "error";
  cityName?: string;
  countryCode?: string;
}

/**
 * Trigger city hydration if needed (lazy SWR strategy)
 * Call this when search/nearby returns no results
 */
export async function triggerCityHydrationIfNeeded(
  latitude: number,
  longitude: number,
  supabaseUrl: string,
  supabaseServiceKey: string,
  githubToken: string
): Promise<CityHydrationResult> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if coordinates are in existing city
    // PostGIS: Check if point is contained within city geometry
    const { data: existingCity, error: cityError } = await supabase
      .from("cities_registry")
      .select("*")
      .eq("status", "completed")
      .filter("geom", "cs", JSON.stringify({
        type: "Point",
        coordinates: [longitude, latitude]
      }))
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
        // Data is fresh - no action needed
        return {
          status: "fresh",
          cityName: existingCity.city_name,
          countryCode: existingCity.country_code,
        };
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
        await fetch("https://api.github.com/repos/rafaeIrf/bumpin/dispatches", {
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
        });

        return {
          status: "stale_revalidating",
          cityName: existingCity.city_name,
          countryCode: existingCity.country_code,
        };
      }
    }

    // City not found - 2-step Nominatim geocoding
    // Step 1: Get city and country
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&zoom=10&format=json`;

    const reverseRes = await fetch(reverseUrl, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
    });

    if (!reverseRes.ok) {
      console.error("Nominatim reverse geocoding failed");
      return { status: "error" };
    }

    const reverseData = await reverseRes.json();
    const cityName =
      reverseData.address?.city ||
      reverseData.address?.town ||
      reverseData.address?.municipality;
    const countryCode = reverseData.address?.country_code?.toUpperCase();

    if (!cityName || !countryCode) {
      console.error("Could not identify city from coordinates");
      return { status: "error" };
    }

    // Step 2: Get official polygon and BBox
    const searchUrl =
      `https://nominatim.openstreetmap.org/search?` +
      `city=${encodeURIComponent(cityName)}&` +
      `country=${countryCode}&` +
      `polygon_geojson=1&format=jsonv2&limit=1`;

    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
    });

    if (!searchRes.ok) {
      console.error("Nominatim search failed");
      return { status: "error" };
    }

    const searchData = await searchRes.json();
    if (!searchData || searchData.length === 0) {
      console.error("City polygon not found");
      return { status: "error" };
    }

    const place = searchData[0];
    console.log("🗺️ Nominatim place found:", {
      display_name: place.display_name,
      type: place.type,
      geometry_type: place.geojson?.type,
      has_bbox: !!place.boundingbox
    });

    const geojson = place.geojson;

    if (!geojson) {
      console.error("❌ No GeoJSON in Nominatim response");
      return { status: "error" };
    }

    // Convert Nominatim BBox [minLat, maxLat, minLon, maxLon] to GIS [minLon, minLat, maxLon, maxLat]
    const nominatimBbox = place.boundingbox;
    const gisBbox = [
      parseFloat(nominatimBbox[2]), // minLon
      parseFloat(nominatimBbox[0]), // minLat
      parseFloat(nominatimBbox[3]), // maxLon
      parseFloat(nominatimBbox[1]), // maxLat
    ];

    console.log("📦 BBox:", gisBbox);

    // Convert GeoJSON to MultiPolygon
    let geometry;
    
    if (geojson.type === "MultiPolygon") {
      console.log("✅ Using MultiPolygon as-is");
      geometry = geojson;
    } else if (geojson.type === "Polygon") {
      console.log("🔄 Converting Polygon to MultiPolygon");
      geometry = {
        type: "MultiPolygon",
        coordinates: [geojson.coordinates]
      };
    } else if (geojson.type === "Point") {
      // Fallback: Create small buffer polygon from BBox
      console.warn("⚠️ Point geometry received, creating polygon from BBox");
      const [minLon, minLat, maxLon, maxLat] = gisBbox;
      geometry = {
        type: "MultiPolygon",
        coordinates: [[
          [
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat] // Close the ring
          ]
        ]]
      };
    } else {
      console.error("❌ Unsupported geometry type:", geojson.type);
      return { status: "error" };
    }

    console.log("📍 Final geometry type:", geometry.type, "with", geometry.coordinates.length, "polygon(s)");

    // Insert city with GeoJSON geometry
    const { data: newCity, error: insertError } = await supabase
      .from("cities_registry")
      .insert({
        city_name: cityName,
        country_code: countryCode,
        geom: geometry,
        bbox: gisBbox,
        status: "processing",
        priority_score: 0,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique constraint violation - city already exists
        return { status: "in_progress", cityName, countryCode };
      }
      console.error("City insert error:", insertError);
      return { status: "error" };
    }

    // Dispatch GitHub Actions workflow
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
      return { status: "error" };
    }

    return {
      status: "triggered",
      cityName,
      countryCode,
    };
  } catch (error) {
    console.error("Error in triggerCityHydrationIfNeeded:", error);
    return { status: "error" };
  }
}
