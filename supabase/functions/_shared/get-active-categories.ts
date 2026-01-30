import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/**
 * Default whitelist of active categories.
 * Used as fallback when app_config doesn't exist or fails to load.
 */
const DEFAULT_ACTIVE_CATEGORIES = [
  "bar",
  "nightclub",
  "university",
  "park",
  "cafe",
  "gym",
  "shopping",
  "library",
];

/**
 * Fetches active categories from app_config table.
 * Returns default whitelist if fetch fails or no config exists.
 *
 * @param supabase - Authenticated Supabase client
 * @returns Array of active category strings
 */
export async function getActiveCategories(
  supabase: SupabaseClient
): Promise<string[]> {
  try {
    const { data: configData } = await supabase
      .from("app_config")
      .select("active_categories")
      .eq("platform", "ios") // Platform-independent
      .single();

    return configData?.active_categories || DEFAULT_ACTIVE_CATEGORIES;
  } catch (error) {
    // Fail-safe: return defaults if query fails
    console.error("[getActiveCategories] Failed to fetch:", error);
    return DEFAULT_ACTIVE_CATEGORIES;
  }
}
