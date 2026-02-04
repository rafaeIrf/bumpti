import { OnboardingProgressBar } from "@/components/onboarding-progress-bar";
import { OnboardingProgressProvider } from "@/components/onboarding-progress-context";
import { useOnboardingSteps } from "@/hooks/use-onboarding-steps";
import { isIOS } from "@/utils";
import { Stack, useSegments } from "expo-router";
import React, { useMemo } from "react";

export const unstable_settings = {
  initialRouteName: "welcome",
};

const OnboardingHeader = React.memo(() => {
  const segments = useSegments();
  const { shouldShowLocation, shouldShowNotifications } = useOnboardingSteps();

  const steps = useMemo(() => {
    const base = [
      "user-name",
      "user-age",
      "user-gender",
      "connect-with",
      "intention",
      "user-photos",
      "user-bio",
    ];
    if (shouldShowLocation) base.push("location");
    base.push("favorite-places");
    base.push("university");
    if (shouldShowNotifications) base.push("notifications");
    // Tracking permission is iOS-only (App Tracking Transparency)
    if (isIOS) base.push("tracking");
    return base;
  }, [shouldShowLocation, shouldShowNotifications]);

  // Get current screen name from segments: ["(onboarding)", "user-name"]
  const currentScreenName =
    segments.length > 1 ? segments[segments.length - 1] : null;

  // Don't show progress bar on complete screen, welcome or intro carousel
  if (
    currentScreenName === "complete" ||
    currentScreenName === "welcome" ||
    currentScreenName === "intro-carousel"
  ) {
    return null;
  }

  // Find current step
  let currentStep = currentScreenName
    ? steps.indexOf(currentScreenName) + 1
    : 0;

  const totalSteps = steps.length;

  // Debug logging
  console.log("[OnboardingHeader] Progress calculation:", {
    currentScreenName,
    steps,
    indexOf: currentScreenName ? steps.indexOf(currentScreenName) : -1,
    currentStep,
    totalSteps,
  });

  // Fallback to step 1 when navigating to onboarding for the first time
  if (!currentStep && (segments as string[]).includes("(onboarding)")) {
    currentStep = 1;
  }

  if (!currentStep) {
    return null;
  }

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
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="intro-carousel" options={{ headerShown: false }} />
        <Stack.Screen name="user-name" />
        <Stack.Screen name="user-age" />
        <Stack.Screen name="user-gender" />
        <Stack.Screen name="connect-with" />
        <Stack.Screen name="intention" />
        <Stack.Screen name="user-photos" />
        <Stack.Screen name="user-bio" />
        <Stack.Screen name="university" />
        <Stack.Screen
          name="university-search"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="location" />
        <Stack.Screen name="favorite-places" />
        <Stack.Screen
          name="place-search"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="tracking" />
        <Stack.Screen name="complete" />
      </Stack>
    </OnboardingProgressProvider>
  );
}
