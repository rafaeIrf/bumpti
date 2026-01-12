import {
  checkNotificationPermission,
  openNotificationSettings,
  requestNotificationPermission,
  shouldShowNotificationScreen,
  type NotificationPermissionResult
} from "@/modules/notifications";
import { logger } from "@/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Hook to manage notification permissions
 *
 * Usage:
 * ```tsx
 * const { hasPermission, isLoading, request, shouldShowScreen } = useNotificationPermission();
 *
 * // Check if should show notification screen in onboarding
 * if (shouldShowScreen) {
 *   router.push('/(onboarding)/notifications');
 * }
 *
 * // Request permission
 * const result = await request();
 * if (result.status === 'granted') {
 *   // Permission granted
 * }
 * ```
 */
export function useNotificationPermission() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shouldShowScreen, setShouldShowScreen] = useState<boolean>(false);
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);
  const appState = useRef(AppState.currentState);

  const checkPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const [result, shouldShow] = await Promise.all([
        checkNotificationPermission(),
        shouldShowNotificationScreen(),
      ]);
      setHasPermission(result.status === "granted");
      setCanAskAgain(result.canAskAgain);
      setShouldShowScreen(shouldShow);
    } catch (error) {
      logger.error("Error checking notification permission:", error);
      setHasPermission(false);
      setShouldShowScreen(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Re-check permission when app comes back to foreground (e.g., after changing settings)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        checkPermission();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [checkPermission]);

  const request =
    useCallback(async (): Promise<NotificationPermissionResult> => {
      setIsLoading(true);
      try {
        const result = await requestNotificationPermission();
        setHasPermission(result.status === "granted");
        setCanAskAgain(result.canAskAgain);
        setShouldShowScreen(result.status !== "granted");
        return result;
      } catch (error) {
        logger.error("Error requesting notification permission:", error);
        return {
          status: "denied",
          canAskAgain: false,
        };
      } finally {
        setIsLoading(false);
      }
    }, []);

  const refresh = useCallback(async () => {
    await checkPermission();
  }, [checkPermission]);

  return {
    hasPermission,
    isLoading,
    shouldShowScreen,
    canAskAgain,
    request,
    refresh,
    checkPermission,
    openSettings: openNotificationSettings,
  };
}

