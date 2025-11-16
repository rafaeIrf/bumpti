import { useAuthState } from "@/hooks/use-auth-state";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAppSelector } from "@/modules/store/hooks";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function RootIndex() {
  const colors = useThemeColors();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthState();
  const { isOnboardingComplete, currentStep, completedSteps } = useAppSelector(
    (state) => state.onboarding
  );

  // Show loading while checking auth state
  if (isAuthLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // If not authenticated, go to onboarding auth flow
  if (!isAuthenticated) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  // User is authenticated - check onboarding completion
  // If onboarding is complete, go to tabs
  if (isOnboardingComplete) {
    return <Redirect href="/(tabs)/(home)" />;
  }

  // If user has completed some steps, redirect to current step or next incomplete step
  if (completedSteps.length > 0 && currentStep !== "phone-auth") {
    return <Redirect href={`/(onboarding)/${currentStep}`} />;
  }

  // Default: Start from user-name (first post-auth screen)
  return <Redirect href="/(onboarding)/user-name" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
