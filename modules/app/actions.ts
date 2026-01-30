import type { PlaceCategory } from "@/modules/places/types";
import { store } from "@/modules/store";
import { setActiveCategories } from "@/modules/store/slices/appSlice";
import { logger } from "@/utils/logger";
import { Platform } from "react-native";
import { getAppConfig } from "./api";

/**
 * Loads app configuration from remote and initializes Redux state.
 * This includes version info, feature flags, and active categories.
 *
 * @returns AppConfig data or null if fetch fails
 */
export async function loadAndInitializeAppConfig() {
  const platform = Platform.OS as "ios" | "android";

  logger.info("[App] Loading app configuration", { platform });

  try {
    const data = await getAppConfig(platform);

    if (!data) {
      logger.warn("[App] Failed to fetch config, using defaults");
      return null;
    }

    // Initialize active categories in Redux
    if (data.active_categories && data.active_categories.length > 0) {
      store.dispatch(
        setActiveCategories(data.active_categories as PlaceCategory[])
      );

      logger.info("[App] Loaded active categories", {
        count: data.active_categories.length,
        categories: data.active_categories,
      });
    }

    return data;
  } catch (err) {
    logger.error("[App] Failed to load app config", { err });
    return null;
  }
}
