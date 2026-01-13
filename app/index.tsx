import { useAuthState } from "@/hooks/use-auth-state";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useProfile } from "@/hooks/use-profile";
import { useAppSelector } from "@/modules/store/hooks";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { Redirect } from "expo-router";
import { useEffect } from "react";

export default function RootIndex() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthState();
  const { profile, isLoading: isProfileLoading } = useProfile({
    enabled: !!isAuthenticated,
    force: true, // sempre confirma no backend se o perfil existe
  });
  const { isLoading: isLocationLoading } = useLocationPermission();
  const { isLoading: isNotificationLoading } = useNotificationPermission();
  const onboardingState = useAppSelector((state) => state.onboarding);

  // Check if all loading is complete
  const isLoading = 
    isAuthLoading ||
    (isAuthenticated && isProfileLoading) ||
    isLocationLoading ||
    isNotificationLoading;

  useEffect(() => {
    if (
      isAuthenticated &&
      !isProfileLoading &&
      !profile &&
      (onboardingState.isOnboardingComplete ||
        onboardingState.currentStep === "complete")
    ) {
      onboardingActions.resetOnboarding();
    }
  }, [
    isAuthenticated,
    isProfileLoading,
    profile,
    onboardingState.isOnboardingComplete,
    onboardingState.currentStep,
  ]);

  // Determine destination route
  const getDestinationRoute = () => {
    if (!isAuthenticated) {
      return "/(auth)/welcome";
    }
    if (profile) {
      return "/(tabs)/(home)";
    }
    if (
      !onboardingState.currentStep ||
      onboardingState.currentStep === "complete"
    ) {
      return "/(auth)/welcome";
    }
    const targetStep = onboardingState.currentStep;
    return `/(onboarding)/${targetStep}`;
  };

  const destinationRoute = getDestinationRoute();

  // Show nothing while loading - native splash screen is visible
  // Splash will be hidden by RootLayout when navigation container is ready
  if (isLoading) {
    return null;
  }

  // Render redirect - splash will be hidden by RootLayout
  return <Redirect href={destinationRoute as any} />;
}
