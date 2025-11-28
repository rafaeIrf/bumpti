import { useLocationPermission } from "./use-location-permission";
import { useNotificationPermission } from "./use-notification-permission";

export function useOnboardingSteps() {
  const { shouldShowScreen: shouldShowLocation } = useLocationPermission();
  const { shouldShowScreen: shouldShowNotifications } =
    useNotificationPermission();

  return {
    shouldShowLocation,
    shouldShowNotifications,
  };
}
