import { OnboardingProgressBar } from "@/components/onboarding-progress-bar";
import { OnboardingProgressProvider } from "@/components/onboarding-progress-context";
import { useOnboardingSteps } from "@/hooks/use-onboarding-steps";
import { Stack, usePathname } from "expo-router";
import React, { useMemo } from "react";

export const unstable_settings = {
  initialRouteName: "user-name",
};

// Routes that should NOT show the progress bar
const ROUTES_WITHOUT_PROGRESS = new Set(["/complete"]);

const OnboardingHeader = React.memo(() => {
  const pathname = usePathname();
  const { shouldShowLocation, shouldShowNotifications } = useOnboardingSteps();

  const steps = useMemo(() => {
    const base = [
      "/user-name",
      "/user-age",
      "/user-gender",
      "/connect-with",
      "/intention",
      "/user-photos",
      "/favorite-places",
    ];
    if (shouldShowLocation) base.push("/location");
    if (shouldShowNotifications) base.push("/notifications");
    return base;
  }, [shouldShowLocation, shouldShowNotifications]);

  console.log("OnboardingHeader render:", { pathname, steps });

  // Don't show progress bar on welcome and complete screens
  if (ROUTES_WITHOUT_PROGRESS.has(pathname)) {
    console.log("Skipping progress bar for:", pathname);
    return null;
  }

  const currentStep = steps.indexOf(pathname) + 1;
  const totalSteps = steps.length;

  // Don't show if we can't determine the step
  if (!currentStep) {
    console.log("No step found for pathname:", pathname);
    return null;
  }

  console.log("Rendering progress bar:", { currentStep, totalSteps });
  return (
    <OnboardingProgressBar currentStep={currentStep} totalSteps={totalSteps} />
  );
});

OnboardingHeader.displayName = "OnboardingHeader";

// Render function for the header
const renderOnboardingHeader = () => <OnboardingHeader />;

export default function OnboardingLayout() {
  return (
    <OnboardingProgressProvider>
      <Stack
        screenOptions={{
          header: renderOnboardingHeader,
          headerShown: true,
          animation: "none",
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="user-name" />
        <Stack.Screen name="user-age" />
        <Stack.Screen name="user-gender" />
        <Stack.Screen name="connect-with" />
        <Stack.Screen name="intention" />
        <Stack.Screen name="user-photos" />
        <Stack.Screen name="favorite-places" />
        <Stack.Screen name="location" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="complete" />
      </Stack>
    </OnboardingProgressProvider>
  );
}
