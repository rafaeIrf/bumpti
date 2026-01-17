import { LoadingView } from "@/components/loading-view";
import { useSession } from "@/contexts/session-context";
import { useAppSelector } from "@/modules/store/hooks";
import { Redirect } from "expo-router";

/**
 * Root Index - Entry point router
 *
 * This screen acts as a simple router to determine the initial destination.
 * During loading, shows the animated LoadingView for a polished experience.
 */
export default function RootIndex() {
  const { isAuthenticated, isReady, profile } = useSession();
  const onboardingState = useAppSelector((state) => state.onboarding);

  // Show loading screen while session state is being determined
  if (!isReady) {
    return <LoadingView />;
  }

  // Determine destination based on session state
  const getDestinationRoute = () => {
    if (!isAuthenticated) {
      return "/(auth)/welcome";
    }

    if (profile) {
      return "/(tabs)/(home)";
    }

    // Authenticated but no profile - go to onboarding
    if (
      onboardingState.currentStep &&
      onboardingState.currentStep !== "complete"
    ) {
      return `/(onboarding)/${onboardingState.currentStep}`;
    }

    // No valid onboarding step - go to welcome to restart
    return "/(auth)/welcome";
  };

  return <Redirect href={getDestinationRoute() as any} />;
}
