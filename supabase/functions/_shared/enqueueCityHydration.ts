/**
 * Enqueue City for Hydration (Worker Queue Pattern)
 * 
 * Instead of directly triggering GitHub Action with city_id,
 * this function:
 * 1. Enqueues city to database with status='pending'
 * 2. Signals GitHub worker (only if no workers running)
 * 3. Returns immediately - worker processes queue async
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function enqueueCityHydration(
  supabaseUrl: string,
  serviceRoleKey: string,
  lat: number,
  lng: number,
  githubToken: string
): Promise<{ cityId: string; action: string }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey,  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    //Step 1: Check if city already exists by geometry
    const { data: existing, error: findError } = await supabase.rpc(
      "find_city_by_coordinates",
      {
        search_lat: lat,
        search_lng: lng,
        tolerance_meters: 1000  // Search within 1km radius
      }
    );

    if (findError) {
      console.error("Error finding city:", findError);
      // Continue to enqueue even if lookup fails
    }

    if (existing && existing.length > 0) {
      const city = existing[0];
      
      if (city.status === "completed") {
        console.log(`✅ City already hydrated: ${city.city_name}`);
        return { cityId: city.id, action: "already_completed" };
      }

      if (city.status === "pending" || city.status === "processing") {
        console.log(`⏳ City already in queue: ${city.city_name} (${city.status})`);
        return { cityId: city.id, action: "already_queued" };
      }

      // City exists but failed - reset to pending for retry
      if (city.status === "failed" || city.status === "manual_review") {
        console.log(`🔄 Resetting failed city to queue: ${city.city_name}`);
        
        const { error: updateError } = await supabase
          .from("cities_registry")
          .update({
            status: "pending",
            retry_count: 0,
            last_error: null
          })
          .eq("id", city.id);

        if (updateError) throw updateError;
        
        await signalWorkerIfNeeded(supabase, githubToken);
        return { cityId: city.id, action: "enqueued_retry" };
      }
    }

    // Step 2: Enqueue new city
    const placeholderName = `City_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    
    const { data: newCity, error: insertError } = await supabase
      .from("cities_registry")
      .insert({
        city_name: placeholderName,
        lat: lat,
        lng: lng,
        status: "pending",
        retry_count: 0
      })
      .select("id")
      .single();

    if (insertError) {
      // Check if it's a unique constraint error (race condition)
      if (insertError.code === "23505") {
        console.log("⚠️  City already inserted by another request (race condition)");
        return { cityId: "unknown", action: "race_condition" };
      }
      throw insertError;
    }

    console.log(`✅ City enqueued: ${placeholderName} (ID: ${newCity.id})`);

    // Step 3: Signal GitHub worker (only if needed)
    await signalWorkerIfNeeded(supabase, githubToken);

    return { cityId: newCity.id, action: "enqueued_new" };

  } catch (error) {
    console.error("❌ Enqueue failed:", error);
    throw error;
  }
}

/**
 * Signal GitHub worker to wake up and process queue.
 * 
 * Optimization: Only triggers if no workers are currently running.
 * This prevents spamming GitHub API when queue is actively being processed.
 */
async function signalWorkerIfNeeded(
  supabase: any,
  githubToken: string
): Promise<void> {
  try {
    // Check if any cities are currently processing
    const { data: processing, error } = await supabase
      .from("cities_registry")
      .select("id")
      .eq("status", "processing")
      .limit(1);

    if (error) throw error;

    if (processing && processing.length > 0) {
      console.log("🔧 Worker already running, skipping signal");
      return;
    }

    // No active workers, signal GitHub
    console.log("📡 Signaling GitHub worker to wake up");

    const response = await fetch(
      "https://api.github.com/repos/rafaeIrf/bumpti/actions/workflows/hydrate_city.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            trigger: "wake"  // Just a wake signal, no specific city
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
    }

    console.log("✅ Worker signaled successfully");

  } catch (error) {
    console.error("⚠️  Failed to signal worker (non-fatal):", error);
    // Don't throw - city is already queued, worker will pick it up eventually
  }
}
