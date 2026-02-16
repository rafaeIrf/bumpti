import { NavigationIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { logger } from "@/utils/logger";
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

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_location",
    params: {
      step_name: "location",
    },
  });

  const handleEnableLocation = async () => {
    setIsRequesting(true);
    try {
      const result = await request();

      if (result.status === "granted") {
        onboardingActions.setLocationPermission(true);

        setTimeout(() => {
          completeCurrentStep("location");
          setIsRequesting(false);
        }, 500);
      } else {
        // Permission denied — still proceed (Apple 5.1.1 compliance)
        onboardingActions.setLocationPermission(false);
        completeCurrentStep("location");
        setIsRequesting(false);
      }
    } catch (error) {
      logger.error("Error requesting location permission:", error);
      Alert.alert(t("common.error"), t("screens.onboarding.locationError"));
      setIsRequesting(false);
    }
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
            {isRequesting
              ? t("screens.onboarding.locationRequesting")
              : t("screens.onboarding.locationEnable")}
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
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    textAlign: "center",
  },
  subtitleContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl,
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
  },
  privacyContainer: {
    marginTop: spacing.xl,
  },
  privacyText: {
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
  },
});
