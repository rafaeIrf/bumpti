import { useSession } from "@/contexts/session-context";
import { useAppSelector } from "@/modules/store/hooks";
import { Stack } from "expo-router";

/**
 * RootNavigator - Main navigation structure with smart authentication guards
 *
 * KEY INSIGHT: Guards are permissive during loading (!isReady).
 * During loading, all routes are accessible (current screen stays visible).
 * Once ready (isReady=true), guards enforce access and redirect if needed.
 *
 * This hybrid approach:
 * - LOGIN: verify-code navigates manually (avoids waiting for guards, no flash)
 * - LOGOUT: guards automatically redirect to welcome when auth becomes false
 */
export function RootNavigator() {
  const { isAuthenticated, isReady, profile } = useSession();
  const onboardingState = useAppSelector((state) => state.onboarding);

  // Guards are permissive during loading (!isReady)
  // When !isReady, all guards are true -> all routes accessible -> no flash
  // When isReady, guards enforce actual access rules

  // Main app: requires auth + profile
  const mainAppGuard = !isReady || (isAuthenticated && !!profile);

  // Onboarding: requires auth but NO profile
  // Allow access during any onboarding step including "complete"
  const onboardingGuard =
    !isReady || (isAuthenticated && !profile && !!onboardingState.currentStep);

  // Auth: requires NO authentication
  const authGuard = !isReady || !isAuthenticated;

  return (
    <Stack>
      <Stack.Protected guard={mainAppGuard}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(profile)" options={{ headerShown: false }} />
        <Stack.Screen name="main" options={{ headerShown: false }} />
        <Stack.Screen
          name="(modals)"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={onboardingGuard}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={authGuard}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
