import { createClient } from "jsr:@supabase/supabase-js@2";

// SWR revalidation period - cities older than this trigger background refresh
const REVALIDATION_DAYS = 60;

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
    // Check if this point is already covered by cities_registry
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

    const existingCity = cities && cities.length > 0 ? cities[0] : null;

    // If city exists, check status to prevent concurrent hydrations
    if (existingCity) {
      console.log(`📍 Found city: ${existingCity.city_name} (${existingCity.id})`);
      
      // Query status from cities_registry
      const { data: cityStatus, error: statusError } = await supabaseAdmin
        .from("cities_registry")
        .select("id, city_name, country_code, status, last_hydrated_at")
        .eq("id", existingCity.id)
        .single();

      if (statusError) {
        console.error("❌ Failed to check city status:", statusError);
        throw statusError;
      }

      // Skip if already processing
      if (cityStatus.status === "processing") {
        console.log(`⏳ City "${cityStatus.city_name}" is already being processed - skipping`);
        return {
          status: "processing",
          cityName: cityStatus.city_name,
          countryCode: cityStatus.country_code,
        };
      }

      // Check if completed and fresh
      const daysSinceHydration = cityStatus.last_hydrated_at
        ? Math.floor(
            (Date.now() - new Date(cityStatus.last_hydrated_at).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      if (cityStatus.status === "completed" && daysSinceHydration !== null && daysSinceHydration <= REVALIDATION_DAYS) {
        console.log(
          `✅ City "${cityStatus.city_name}" is fresh (${daysSinceHydration} days old) - skipping`
        );
        return {
          status: "covered",
          cityName: cityStatus.city_name,
          countryCode: cityStatus.country_code,
        };
      }

      // City needs refresh or has failed/pending status
      if (cityStatus.status === "completed") {
        console.log(
          `🔄 City "${cityStatus.city_name}" needs refresh (${daysSinceHydration} days old)`
        );
      } else {
        console.log(`🔧 City "${cityStatus.city_name}" status is "${cityStatus.status}" - proceeding`);
      }

      // Dispatch hydration
      await dispatchGitHubHydration(
        existingCity.id,
        latitude,
        longitude,
        githubToken,
        true
      );

      return {
        status: "refreshing",
        cityName: cityStatus.city_name,
        countryCode: cityStatus.country_code,
      };
    }

    // New territory - dispatch discovery workflow
    console.log("🆕 New territory detected, dispatching discovery workflow");
    await dispatchGitHubHydration(null, latitude, longitude, githubToken, false);

    return { status: "hydrating" };
  } catch (error) {
    console.error("❌ City hydration trigger failed:", error);
    return { status: "error" };
  }
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
