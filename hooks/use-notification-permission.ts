import {
  checkNotificationPermission,
  openNotificationSettings,
  requestNotificationPermission,
  shouldShowNotificationScreen,
  type NotificationPermissionResult
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
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);

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
        setCanAskAgain(result.canAskAgain);
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
    canAskAgain,
    request,
    refresh,
    checkPermission,
    openSettings: openNotificationSettings,
  };
}
