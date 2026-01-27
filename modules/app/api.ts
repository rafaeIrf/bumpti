import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";

export interface AppConfig {
  platform: "ios" | "android";
  min_version: string;
  latest_version: string;
  store_url: string | null;
}

/**
 * Fetches app configuration from the Edge Function.
 *
 * This is a public endpoint that doesn't require authentication,
 * used for version checking before the app fully loads.
 *
 * @param platform - "ios" or "android"
 * @returns AppConfig or null if fetch fails (fail-safe)
 */
export async function getAppConfig(
  platform: "ios" | "android"
): Promise<AppConfig | null> {
  try {
    const { data, error } = await supabase.functions.invoke<AppConfig>(
      "get-app-config",
      {
        body: { platform },
      }
    );

    if (error) {
      logger.error("[getAppConfig] Edge function error:", error);
      return null;
    }

    return data || null;
  } catch (err) {
    logger.error("[getAppConfig] Unexpected error:", err);
    return null;
  }
}
