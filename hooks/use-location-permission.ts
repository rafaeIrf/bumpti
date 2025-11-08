import {
  getCurrentLocation,
  hasLocationPermission,
  requestLocationPermission,
  shouldShowLocationScreen,
  type LocationCoordinates,
  type LocationPermissionResult,
} from "@/modules/location";
import { useCallback, useEffect, useState } from "react";

/**
 * Hook to manage location permissions
 *
 * Usage:
 * ```tsx
 * const { hasPermission, isLoading, location, request, shouldShowScreen } = useLocationPermission();
 *
 * // Check if should show location screen in onboarding
 * if (shouldShowScreen) {
 *   router.push('/(onboarding)/location');
 * }
 *
 * // Request permission
 * const result = await request();
 * if (result.status === 'granted') {
 *   // Permission granted
 * }
 *
 * // Get current location
 * const coords = await getLocation();
 * ```
 */
export function useLocationPermission() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shouldShowScreen, setShouldShowScreen] = useState<boolean>(false);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);

  const checkPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const [permitted, shouldShow] = await Promise.all([
        hasLocationPermission(),
        shouldShowLocationScreen(),
      ]);
      setHasPermission(permitted);
      setShouldShowScreen(shouldShow);
    } catch (error) {
      console.error("Error checking location permission:", error);
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

  const request = useCallback(async (): Promise<LocationPermissionResult> => {
    setIsLoading(true);
    try {
      const result = await requestLocationPermission();
      setHasPermission(result.status === "granted");
      setShouldShowScreen(result.status !== "granted");
      return result;
    } catch (error) {
      console.error("Error requesting location permission:", error);
      return {
        status: "denied",
        canAskAgain: false,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getLocation =
    useCallback(async (): Promise<LocationCoordinates | null> => {
      try {
        const coords = await getCurrentLocation();
        setLocation(coords);
        return coords;
      } catch (error) {
        console.error("Error getting location:", error);
        return null;
      }
    }, []);

  const refresh = useCallback(async () => {
    await checkPermission();
  }, [checkPermission]);

  return {
    hasPermission,
    isLoading,
    shouldShowScreen,
    location,
    request,
    getLocation,
    refresh,
    checkPermission,
  };
}
