import { SparklesIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { registerDeviceToken } from "@/modules/notifications";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const [isRequesting, setIsRequesting] = useState(false);
  const { completeCurrentStep } = useOnboardingFlow();
  const { request } = useNotificationPermission();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_notifications",
    params: {
      step_name: "notifications",
    },
  });

  // Animação de balanço do sino
  const bellRotation = useSharedValue(0);

  React.useEffect(() => {
    bellRotation.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 100 }),
          withTiming(10, { duration: 100 }),
          withTiming(-10, { duration: 100 }),
          withTiming(0, { duration: 100 }),
          withTiming(0, { duration: 2000 }),
        ),
        -1,
      ),
    );
  }, [bellRotation]);

  const bellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellRotation.value}deg` }],
  }));

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      const result = await request();

      if (result.status === "granted") {
        onboardingActions.setNotificationPermission(true);
        registerDeviceToken();
      } else {
        onboardingActions.setNotificationPermission(false);
      }

      // Apple 5.1.1: always proceed after native dialog (granted or denied)
      setTimeout(() => {
        completeCurrentStep("notifications");
        setIsRequesting(false);
      }, 500);
    } catch (error) {
      logger.error("Error requesting notification permission:", error);
      Alert.alert(
        t("common.error"),
        t("screens.onboarding.notificationsError"),
      );
      setIsRequesting(false);
    }
  };

  return (
    <BaseTemplateScreen>
      <View style={styles.container}>
        {/* Notification Icon with sparkles */}
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
            <Animated.View style={bellAnimatedStyle}>
              <Ionicons name="notifications" size={48} color="#FFFFFF" />
            </Animated.View>
          </LinearGradient>

          {/* Sparkle 1 - Top Left */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(500)}
            style={[styles.sparkle, styles.sparkleTopLeft]}
          >
            <SparklesIcon width={20} height={20} color={colors.accent} />
          </Animated.View>

          {/* Sparkle 2 - Bottom Right */}
          <Animated.View
            entering={FadeInDown.delay(800).duration(500)}
            style={[styles.sparkle, styles.sparkleBottomRight]}
          >
            <SparklesIcon width={20} height={20} color={colors.accent} />
          </Animated.View>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(500)}
          style={styles.titleContainer}
        >
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {t("screens.onboarding.notificationsTitle")}
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
            {t("screens.onboarding.notificationsSubtitle")}
          </ThemedText>
        </Animated.View>

        {/* Buttons */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.buttonsContainer}
        >
          <Button
            onPress={handleEnableNotifications}
            disabled={isRequesting}
            size="lg"
            fullWidth
            style={styles.enableButton}
          >
            <ThemedText style={styles.enableButtonText}>
              {isRequesting
                ? t("screens.onboarding.notificationsRequesting")
                : t("screens.onboarding.notificationsEnable")}
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
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: spacing.xl,
    position: "relative",
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
  sparkle: {
    position: "absolute",
  },
  sparkleTopLeft: {
    top: -4,
    left: -4,
  },
  sparkleBottomRight: {
    bottom: -4,
    right: -4,
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
});
