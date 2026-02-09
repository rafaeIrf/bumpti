import { SparklesIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useScreenTracking } from "@/modules/analytics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { ANALYTICS_EVENTS, trackEvent } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { logger } from "@/utils/logger";
import { LinearGradient } from "expo-linear-gradient";
import * as Tracking from "expo-tracking-transparency";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";

export default function TrackingScreen() {
  const colors = useThemeColors();
  const [isRequesting, setIsRequesting] = useState(false);
  const { completeCurrentStep } = useOnboardingFlow();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_tracking",
    params: {
    onboarding_step: 12,
    step_name: "tracking",
    },
  });

  const handleEnableTracking = async () => {
    setIsRequesting(true);
    try {
      const { status } = await Tracking.requestTrackingPermissionsAsync();

      if (status === "granted") {
        onboardingActions.setTrackingPermission(true);
        trackEvent(ANALYTICS_EVENTS.TRACKING.PERMISSION_GRANTED, {
          screen: "onboarding",
        });

        setTimeout(() => {
          completeCurrentStep("tracking");
          setIsRequesting(false);
        }, 500);
      } else {
        // Permission denied
        trackEvent(ANALYTICS_EVENTS.TRACKING.PERMISSION_DENIED, {
          screen: "onboarding",
        });
        Alert.alert(
          t("screens.onboarding.trackingDeniedTitle"),
          t("screens.onboarding.trackingDeniedMessage"),
        );
        setIsRequesting(false);
      }
    } catch (error) {
      logger.error("Error requesting tracking permission:", error);
      Alert.alert(t("common.error"), t("screens.onboarding.trackingError"));
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    onboardingActions.setTrackingPermission(false);
    trackEvent(ANALYTICS_EVENTS.TRACKING.PERMISSION_SKIPPED, {
      screen: "onboarding",
    });
    completeCurrentStep("tracking");
  };

  return (
    <BaseTemplateScreen>
      <View style={styles.container}>
        {/* Sparkles Icon */}
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
            <SparklesIcon width={48} height={48} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(500)}
          style={styles.titleContainer}
        >
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {t("screens.onboarding.trackingTitle")}
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
            {t("screens.onboarding.trackingSubtitle")}
          </ThemedText>
        </Animated.View>

        {/* Buttons */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.buttonsContainer}
        >
          <Button
            onPress={handleEnableTracking}
            disabled={isRequesting}
            size="lg"
            fullWidth
            style={styles.enableButton}
          >
            <ThemedText style={styles.enableButtonText}>
              {isRequesting
                ? t("screens.onboarding.trackingRequesting")
                : t("screens.onboarding.trackingEnable")}
            </ThemedText>
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
              {t("screens.onboarding.trackingSkip")}
            </ThemedText>
          </Button>
        </Animated.View>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
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
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
});
