import { createClient } from "jsr:@supabase/supabase-js@2";

type CityData = {
  id: string;
  city_name: string;
  country_code: string;
  status: string;
  last_hydrated_at: string | null;
  bbox: any;
  should_hydrate: boolean;
  skip_reason: string;
};

/**
 * Trigger city hydration if needed (Overture-Native version)
 * All logic handled in single atomic RPC call
 */
export async function triggerCityHydrationIfNeeded(
  latitude: string,
  longitude: string
): Promise<{ status: string; cityName?: string; countryCode?: string }> {
  // Read env vars internally
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const githubToken = Deno.env.get("GH_HYDRATION_TOKEN");

  if (!supabaseUrl || !serviceRoleKey || !githubToken) {
    console.error("❌ Missing required environment variables");
    return { status: "error" };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);

  console.log(`🔍 Checking city coverage for point: (${latNum}, ${lngNum})`);

  try {
    // Single atomic RPC call handles everything:
    // 1. Find city with lock
    // 2. Check if should skip (processing, fresh)
    // 3. Update status to 'processing' if needed
    // 4. Return should_hydrate flag
    const { data: cities, error: rpcError } = await supabaseAdmin.rpc(
      "check_and_lock_city_for_hydration",
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

    // SQL now ALWAYS returns city (created 'discovering' record if not found)
    // This should never happen unless RPC failed
    if (!city) {
      console.error("❌ Unexpected: RPC returned empty result");
      return { status: "error" };
    }

    console.log(`📍 City: ${city.city_name} (${city.id}, status: ${city.status})`);

    // Handle skip reasons (including already_processing for discovery)
    if (!city.should_hydrate) {
      return handleSkipReason(city);
    }

    // This request won the race - dispatch hydration
    console.log(`🚀 Status updated to 'processing', dispatching workflow...`);
    
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
 * Handle skip reasons from RPC
 */
function handleSkipReason(city: CityData): { status: string; cityName: string; countryCode: string } {
  switch (city.skip_reason) {
    case "already_processing":
      console.log(`⏳ City "${city.city_name}" is already being processed - skipping`);
      return {
        status: "processing",
        cityName: city.city_name,
        countryCode: city.country_code,
      };
    
    case "fresh":
      const daysSince = city.last_hydrated_at
        ? Math.floor((Date.now() - new Date(city.last_hydrated_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      console.log(`✅ City "${city.city_name}" is fresh (${daysSince} days old) - skipping`);
      return {
        status: "covered",
        cityName: city.city_name,
        countryCode: city.country_code,
      };
    
    default:
      console.warn(`⚠️ Unexpected skip reason: ${city.skip_reason}`);
      return {
        status: "skipped",
        cityName: city.city_name,
        countryCode: city.country_code,
      };
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
