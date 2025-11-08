import {
  hasNotificationPermission,
  requestNotificationPermission,
  shouldShowNotificationScreen,
  type NotificationPermissionResult,
} from "@/modules/notifications";
import { useCallback, useEffect, useState } from "react";

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

  const checkPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const [permitted, shouldShow] = await Promise.all([
        hasNotificationPermission(),
        shouldShowNotificationScreen(),
      ]);
      setHasPermission(permitted);
      setShouldShowScreen(shouldShow);
    } catch (error) {
      console.error("Error checking notification permission:", error);
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

  const request =
    useCallback(async (): Promise<NotificationPermissionResult> => {
      setIsLoading(true);
      try {
        const result = await requestNotificationPermission();
        setHasPermission(result.status === "granted");
        setShouldShowScreen(result.status !== "granted");
        return result;
      } catch (error) {
        console.error("Error requesting notification permission:", error);
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
    request,
    refresh,
    checkPermission,
  };
}
