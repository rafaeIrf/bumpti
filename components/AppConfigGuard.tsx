import { ForceUpdateScreen } from "@/components/force-update-screen";
import { AppConfig, loadAndInitializeAppConfig } from "@/modules/app";
import { getAppVersion } from "@/utils/app-info";
import { logger } from "@/utils/logger";
import { isVersionSmaller } from "@/utils/version-utils";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

type VersionStatus =
  | "loading"
  | "up_to_date"
  | "force_update"
  | "update_suggested";

interface AppConfigGuardProps {
  children: React.ReactNode;
}

/**
 * Provider component that enforces version control and loads app configuration.
 *
 * Responsibilities:
 * - Checks app version and enforces mandatory updates
 * - Loads remote app configuration (feature flags, active categories)
 * - Initializes Redux state with active categories via app module
 *
 * Behavior:
 * - Shows blocking ForceUpdateScreen for mandatory updates
 * - Opens modal for suggested updates (once per session)
 * - Re-checks when app returns from background
 * - Renders children normally when version is acceptable
 */
export function AppConfigGuard({ children }: AppConfigGuardProps) {
  const [status, setStatus] = useState<VersionStatus>("loading");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const hasShownSuggestionRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const router = useRouter();

  /**
   * Fetches app config and determines version status.
   * Uses fail-safe pattern: if fetch fails, assumes up_to_date.
   */
  const checkVersion = useCallback(async () => {
    const currentVersion = getAppVersion();

    logger.info("[AppConfigGuard] Checking version and loading config", {
      currentVersion,
      platform: Platform.OS,
    });

    try {
      // Use the app module action to load and initialize config
      const data = await loadAndInitializeAppConfig();

      if (!data) {
        logger.warn("[AppConfigGuard] Failed to fetch config, allowing access");
        setStatus("up_to_date");
        return;
      }

      setConfig(data);

      // Determine version status
      if (isVersionSmaller(currentVersion, data.min_version)) {
        logger.warn("[AppConfigGuard] Force update required", {
          currentVersion,
          minVersion: data.min_version,
        });
        setStatus("force_update");
      } else if (isVersionSmaller(currentVersion, data.latest_version)) {
        logger.info("[AppConfigGuard] Update suggested", {
          currentVersion,
          latestVersion: data.latest_version,
        });
        setStatus("update_suggested");
      } else {
        logger.info("[AppConfigGuard] App is up to date", { currentVersion });
        setStatus("up_to_date");
      }
    } catch (err) {
      logger.error("[AppConfigGuard] Unexpected error, allowing access", {
        err,
      });
      setStatus("up_to_date");
    }
  }, []);

  // Check version on mount
  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  // Re-check version when app returns from background
  // This ensures if user updated the app externally, the block is removed
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        logger.info("[AppConfigGuard] App became active, re-checking version");
        checkVersion();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [checkVersion]);

  // Show suggestion modal once when update is suggested
  useEffect(() => {
    if (status === "update_suggested" && !hasShownSuggestionRef.current) {
      hasShownSuggestionRef.current = true;
      logger.info("[AppConfigGuard] Showing update suggestion modal");

      // Small delay to ensure navigation is ready
      const timer = setTimeout(() => {
        router.push("/(modals)/update-suggestion");
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [status, router]);

  // Block app with force update screen
  if (status === "force_update") {
    logger.warn("[AppConfigGuard] Blocking app - force update required");
    return <ForceUpdateScreen storeUrl={config?.store_url} />;
  }

  // During loading, show nothing (splash will be visible)
  if (status === "loading") {
    return null;
  }

  // Allow app to render normally
  return <>{children}</>;
}
