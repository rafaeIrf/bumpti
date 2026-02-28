import { OnboardingProgressBar } from "@/components/onboarding-progress-bar";
import {
  OnboardingProgressProvider,
  useOnboardingProgress,
} from "@/components/onboarding-progress-context";
import { Stack, useSegments } from "expo-router";
import React from "react";

export const unstable_settings = {
  initialRouteName: "welcome",
};

const OnboardingHeader = React.memo(() => {
  const segments = useSegments();
  const { currentStep, totalSteps } = useOnboardingProgress();

  const currentScreenName =
    segments.length > 1 ? segments[segments.length - 1] : null;

  if (
    currentScreenName === "complete" ||
    currentScreenName === "welcome" ||
    currentScreenName === "intro-carousel"
  ) {
    return null;
  }

  if (!currentStep) {
    return null;
  }

  return (
    <OnboardingProgressBar currentStep={currentStep} totalSteps={totalSteps} />
  );
});

OnboardingHeader.displayName = "OnboardingHeader";

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
        <Stack.Screen name="interests" />
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
        <Stack.Screen name="social-hubs" />
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
