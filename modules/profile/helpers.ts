import { updateProfile } from "@/modules/profile/api";
import { store } from "@/modules/store";
import { logger } from "@/utils/logger";

/**
 * Helper function to get the current user ID from Redux store.
 * 
 * This is useful when you need just the user ID without fetching
 * the entire profile object or using the useProfile hook.
 * 
 * NOTE: This is a helper, not a hook. It won't trigger re-renders.
 * Use it in contexts where you just need the ID once (like in services).
 * 
 * @returns The user ID or undefined if not logged in
 * 
 * @example
 * ```typescript
 * import { getUserId } from "@/modules/profile";
 * 
 * const userId = getUserId();
 * if (userId) {
 *   // Do something with userId
 * }
 * ```
 */
export function getUserId(): string | undefined {
  const state = store.getState();
  return state.profile.data?.id;
}

// Track last backend sync time
let lastBackendSyncTime = 0;
const BACKEND_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MIN_ACCURACY_FOR_SYNC = 1000; // Only sync if accuracy better than 1km

/**
 * Sync user's location to backend for nearby activity notifications
 * 
 * @param latitude - User's latitude
 * @param longitude - User's longitude
 * @param accuracy - GPS accuracy in meters (optional)
 * 
 * Features:
 * - Rate limiting: Maximum once every 5 minutes
 * - Accuracy filtering: Only syncs if accuracy < 1km
 * - Uses updateProfile API for consistency
 */
export async function syncLocationToBackend(
  latitude: number,
  longitude: number,
  accuracy?: number
): Promise<void> {
  try {
    const now = Date.now();
    
    // Rate limiting
    if (now - lastBackendSyncTime < BACKEND_SYNC_INTERVAL) {
      logger.debug("Backend location sync skipped (too recent)");
      return;
    }

    // Accuracy check
    if (accuracy && accuracy > MIN_ACCURACY_FOR_SYNC) {
      logger.warn(`Location accuracy too low (${accuracy}m), skipping backend sync`);
      return;
    }

    // Update location using existing API (handles auth validation)
    await updateProfile({
      last_lat: latitude,
      last_lng: longitude,
    });

    logger.log("Location synced to backend successfully", {
      lat: latitude,
      lng: longitude,
      accuracy,
    });
    lastBackendSyncTime = now;
  } catch (error) {
    logger.error("Error in syncLocationToBackend:", error);
  }
}
