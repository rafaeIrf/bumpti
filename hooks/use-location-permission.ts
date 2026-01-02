import {
  checkLocationPermission,
  getCurrentLocation,
  openLocationSettings,
  requestLocationPermission,
  shouldShowLocationScreen,
  type LocationCoordinates,
  type LocationPermissionResult
} from "@/modules/location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

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
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const appState = useRef(AppState.currentState);

  const checkPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const [result, shouldShow] = await Promise.all([
        checkLocationPermission(),
        shouldShowLocationScreen(),
      ]);
      setHasPermission(result.status === "granted");
      setCanAskAgain(result.canAskAgain);
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


  const request = useCallback(async (): Promise<LocationPermissionResult> => {
    setIsLoading(true);
    try {
      const result = await requestLocationPermission();
      setHasPermission(result.status === "granted");
      setCanAskAgain(result.canAskAgain);
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
    canAskAgain,
    location,
    request,
    getLocation,
    refresh,
    checkPermission,
    openSettings: openLocationSettings,
  };
}
