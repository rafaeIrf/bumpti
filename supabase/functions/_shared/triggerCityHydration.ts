import { createClient } from "jsr:@supabase/supabase-js@2";

// SWR revalidation period - cities older than this trigger background refresh
const REVALIDATION_DAYS = 60;

type CityData = {
  id: string;
  city_name: string;
  country_code: string;
  status: string;
  last_hydrated_at: string | null;
  bbox: any;
};

/**
 * Trigger city hydration if needed (Overture-Native version)
 * Simplified: No Nominatim calls, discovery happens in Python worker
 */
export async function triggerCityHydrationIfNeeded(
  supabaseUrl: string,
  serviceRoleKey: string,
  latitude: string,
  longitude: string,
  githubToken: string
): Promise<{ status: string; cityName?: string; countryCode?: string }> {
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);

  console.log(`🔍 Checking city coverage for point: (${latNum}, ${lngNum})`);

  try {
    // Check if city exists (acquires lock)
    const { data: cities, error: rpcError } = await supabaseAdmin.rpc(
      "check_city_by_coordinates",
      {
        user_lat: latNum,
        user_lng: lngNum,
      }
    );

    if (rpcError) {
      console.error("❌ RPC error:", rpcError);
      throw rpcError;
    }

    const city = cities && cities.length > 0 ? cities[0] : null;

    // No city found - trigger discovery
    if (!city) {
      console.log("🆕 New territory detected, dispatching discovery workflow");
      await dispatchGitHubHydration(null, latitude, longitude, githubToken, false);
      return { status: "hydrating" };
    }

    console.log(`📍 Found city: ${city.city_name} (${city.id})`);

    // Check if should skip hydration
    const skipReason = shouldSkipHydration(city);
    if (skipReason) {
      console.log(skipReason.message);
      return skipReason.response;
    }

    // City needs hydration - update status to 'processing'
    console.log(`🚀 Updating status to 'processing'...`);
    
    const { data: updated, error: updateError } = await supabaseAdmin.rpc(
      "update_city_status_to_processing",
      { city_id: city.id }
    );

    if (updateError) {
      console.error("❌ Failed to update city status:", updateError);
      throw updateError;
    }
    
    if (!updated) {
      console.warn("⚠️ Status was already 'processing' (another request locked this city)");
      return { status: "skipped" };
    }

    // Dispatch hydration workflow
    await dispatchGitHubHydration(
      city.id,
      latitude,
      longitude,
      githubToken,
      true
    );

    return {
      status: "refreshing",
      cityName: city.city_name,
      countryCode: city.country_code,
    };
  } catch (error) {
    console.error("❌ City hydration trigger failed:", error);
    return { status: "error" };
  }
}

/**
 * Determine if hydration should be skipped for a city
 */
function shouldSkipHydration(city: CityData): { message: string; response: any } | null {
  // Skip if already processing
  if (city.status === "processing") {
    return {
      message: `⏳ City "${city.city_name}" is already being processed - skipping`,
      response: {
        status: "processing",
        cityName: city.city_name,
        countryCode: city.country_code,
      },
    };
  }

  // Skip if completed and fresh
  if (city.status === "completed" && city.last_hydrated_at) {
    const daysSinceHydration = Math.floor(
      (Date.now() - new Date(city.last_hydrated_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysSinceHydration <= REVALIDATION_DAYS) {
      return {
        message: `✅ City "${city.city_name}" is fresh (${daysSinceHydration} days old) - skipping`,
        response: {
          status: "covered",
          cityName: city.city_name,
          countryCode: city.country_code,
        },
      };
    }

    console.log(
      `🔄 City "${city.city_name}" needs refresh (${daysSinceHydration} days old)`
    );
  } else {
    console.log(`🔧 City "${city.city_name}" status is "${city.status}" - needs hydration`);
  }

  return null; // Don't skip
}

/**
 * Dispatch GitHub Actions workflow for city hydration
 */
async function dispatchGitHubHydration(
  cityId: string | null,
  latitude: string,
  longitude: string,
  githubToken: string,
  isUpdate: boolean
): Promise<void> {
  console.log("🚀 Dispatching GitHub Actions workflow...");

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
          city_id: cityId,
          lat: latitude,
          lng: longitude,
          is_update: isUpdate,
        },
      }),
    }
  );

  if (!dispatchRes.ok) {
    const errorText = await dispatchRes.text();
    console.error("❌ GitHub dispatch failed:", dispatchRes.status, errorText);
    throw new Error(`GitHub dispatch failed: ${dispatchRes.status}`);
  }

  console.log("✅ GitHub Actions workflow dispatched successfully");
}
