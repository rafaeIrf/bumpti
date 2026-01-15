import { createClient } from "jsr:@supabase/supabase-js@2";

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
    const { data: existingCity, error: rpcError } = await supabaseAdmin.rpc(
      "check_city_contains_point",
      {
        p_lat: latNum,
        p_lng: lngNum,
      }
    );

    if (rpcError) {
      console.error("❌ RPC error:", rpcError);
      throw rpcError;
    }

    // City found and recently hydrated
    if (existingCity && existingCity.days_since_hydration <= 30) {
      console.log(
        `✅ City "${existingCity.city_name}" is fresh (${existingCity.days_since_hydration} days old)`
      );
      return {
        status: "covered",
        cityName: existingCity.city_name,
        countryCode: existingCity.country_code,
      };
    }

    // City found but needs revalidation (SWR pattern)
    if (existingCity && existingCity.days_since_hydration > 30) {
      console.log(
        `🔄 City "${existingCity.city_name}" needs refresh (${existingCity.days_since_hydration} days old)`
      );

      // Dispatch background update
      await dispatchGitHubHydration(
        existingCity.id,
        latitude,
        longitude,
        githubToken,
        true
      );

      return {
        status: "refreshing",
        cityName: existingCity.city_name,
        countryCode: existingCity.country_code,
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
