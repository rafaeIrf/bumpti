import { MapPinIcon, NavigationIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";

export default function LocationScreen() {
  const colors = useThemeColors();
  const [isRequesting, setIsRequesting] = useState(false);
  const { completeCurrentStep } = useOnboardingFlow();
  const { request } = useLocationPermission();

  const handleEnableLocation = async () => {
    setIsRequesting(true);
    try {
      const result = await request();

      if (result.status === "granted") {
        onboardingActions.setLocationPermission(true);

        // Aguardar um pouco para feedback visual
        setTimeout(() => {
          completeCurrentStep("location");
          setIsRequesting(false);
        }, 500);
      } else {
        // Permissão negada
        Alert.alert(
          t("screens.onboarding.locationDeniedTitle"),
          t("screens.onboarding.locationDeniedMessage")
        );
        setIsRequesting(false);
      }
    } catch (error) {
      console.error("Error requesting location permission:", error);
      Alert.alert(t("common.error"), t("screens.onboarding.locationError"));
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    onboardingActions.setLocationPermission(false);
    completeCurrentStep("location");
  };

  return (
    <BaseTemplateScreen>
      <View style={styles.container}>
        {/* Location Icon */}
        <Animated.View
          entering={ZoomIn.delay(200).duration(600).springify()}
          style={styles.iconContainer}
        >
          <LinearGradient
            colors={["#1D9BF0", "#1A8CD8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <NavigationIcon width={48} height={48} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(500)}
          style={styles.titleContainer}
        >
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {t("screens.onboarding.locationTitle")}
          </ThemedText>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(500)}
          style={styles.subtitleContainer}
        >
          <ThemedText
            style={[styles.subtitle, { color: colors.textSecondary }]}
          >
            {t("screens.onboarding.locationSubtitle")}
          </ThemedText>
        </Animated.View>

        {/* Buttons */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.buttonsContainer}
        >
          <Button
            onPress={handleEnableLocation}
            disabled={isRequesting}
            size="lg"
            fullWidth
            style={styles.enableButton}
          >
            <View style={styles.buttonContent}>
              <MapPinIcon width={20} height={20} color="#FFFFFF" />
              <ThemedText style={styles.enableButtonText}>
                {isRequesting
                  ? t("screens.onboarding.locationRequesting")
                  : t("screens.onboarding.locationEnable")}
              </ThemedText>
            </View>
          </Button>

          <Button
            onPress={handleSkip}
            disabled={isRequesting}
            variant="ghost"
            size="lg"
            fullWidth
            style={styles.skipButton}
          >
            <ThemedText
              style={[styles.skipButtonText, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.locationSkip")}
            </ThemedText>
          </Button>
        </Animated.View>

        {/* Privacy Note */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(500)}
          style={styles.privacyContainer}
        >
          <ThemedText
            style={[styles.privacyText, { color: colors.textTertiary }]}
          >
            {t("screens.onboarding.locationPrivacy")}
          </ThemedText>
        </Animated.View>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    textAlign: "center",
  },
  subtitleContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  buttonsContainer: {
    width: "100%",
    gap: spacing.sm,
  },
  enableButton: {
    minHeight: 56,
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  enableButtonText: {
    ...typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  skipButton: {
    minHeight: 56,
  },
  skipButtonText: {
    ...typography.body,
    fontWeight: "600",
    fontSize: 16,
  },
  privacyContainer: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  privacyText: {
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
  },
});
