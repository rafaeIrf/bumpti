import { useAuthState } from "@/hooks/use-auth-state";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAppSelector } from "@/modules/store/hooks";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function RootIndex() {
  const colors = useThemeColors();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthState();
  const { profile, isLoading: isProfileLoading } = useProfile({
    enabled: !!isAuthenticated,
    force: true, // sempre confirma no backend se o perfil existe
  });
  const { currentStep } = useAppSelector((state) => state.onboarding);

  console.log("profile", profile);

  // Show loading while checking auth state
  if (isAuthLoading || (isAuthenticated && isProfileLoading)) {
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

  // User authenticated: if profile exists, onboarding is done
  if (profile) {
    return <Redirect href="/(tabs)/(home)" />;
  }

  // No profile yet: continue onboarding from last saved step (persisted) or start
  const onboardingRoute =
    currentStep && currentStep !== "phone-auth"
      ? `/(onboarding)/${currentStep}`
      : "/(onboarding)/user-name";

  return <Redirect href={onboardingRoute} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
