import { useLocationPermission } from "./use-location-permission";
import { useNotificationPermission } from "./use-notification-permission";

export function useOnboardingSteps() {
  const { shouldShowScreen: shouldShowLocation, isLoading: isLocationLoading } =
    useLocationPermission();
  const {
    shouldShowScreen: shouldShowNotifications,
    isLoading: isNotificationLoading,
  } = useNotificationPermission();

  return {
    shouldShowLocation,
    shouldShowNotifications,
    isLoading: isLocationLoading || isNotificationLoading,
  };
}
