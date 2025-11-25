import {
  AppleIcon,
  MapPinIcon,
  SmartphoneIcon,
  SparklesIcon,
  UsersIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { openPrivacyPolicy, openTermsOfUse } from "@/utils";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export default function WelcomeScreen() {
  const colors = useThemeColors();

  // Floating animations for decorative icons
  const mapPinY = useSharedValue(0);
  const sparklesY = useSharedValue(0);

  React.useEffect(() => {
    mapPinY.value = withRepeat(withTiming(-10, { duration: 2000 }), -1, true);
    sparklesY.value = withRepeat(withTiming(10, { duration: 2500 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapPinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mapPinY.value }],
  }));

  const sparklesStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sparklesY.value }],
  }));

  const handlePhoneAuth = () => {
    router.push("/(onboarding)/phone-auth");
  };

  const handleAppleAuth = () => {
    // TODO: Implement Apple auth flow
    console.log("Apple auth");
  };

  const handleTermsPress = async () => {
    await openTermsOfUse();
  };

  const handlePrivacyPress = async () => {
    await openPrivacyPolicy();
  };

  return (
    <BaseTemplateScreen scrollEnabled={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Illustration/Icon */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          style={styles.illustrationContainer}
        >
          <View style={styles.illustration}>
            {/* Center icon with gradient */}
            <LinearGradient
              colors={["#1D9BF0", "#1A8CD8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.centerIcon}
            >
              <UsersIcon width={64} height={64} color="#FFFFFF" />
            </LinearGradient>

            {/* Floating MapPin icon */}
            <Animated.View style={[styles.floatingIconTopRight, mapPinStyle]}>
              <View style={styles.floatingIconCircle}>
                <MapPinIcon width={32} height={32} color="#1D9BF0" />
              </View>
            </Animated.View>

            {/* Floating Sparkles icon */}
            <Animated.View
              style={[styles.floatingIconBottomLeft, sparklesStyle]}
            >
              <View style={styles.floatingIconCircle}>
                <SparklesIcon width={32} height={32} color="#1D9BF0" />
              </View>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.titleContainer}
        >
          <ThemedText style={styles.title}>
            {t("screens.onboarding.title")}
          </ThemedText>
        </Animated.View>

        {/* Terms and Privacy - Moved above buttons */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.termsTopContainer}
        >
          <ThemedText style={styles.termsTopText}>
            {t("screens.onboarding.termsPrefix")}{" "}
            <ThemedText onPress={handleTermsPress} style={styles.termsLink}>
              {t("screens.onboarding.terms")}
            </ThemedText>{" "}
            {t("screens.onboarding.termsAnd")}{" "}
            <ThemedText onPress={handlePrivacyPress} style={styles.termsLink}>
              {t("screens.onboarding.privacy")}
            </ThemedText>
          </ThemedText>
        </Animated.View>

        {/* Buttons */}
        <Animated.View
          entering={FadeInDown.delay(800).duration(500)}
          style={styles.buttonsContainer}
        >
          {/* Primary Button - Phone Auth */}
          <Button
            onPress={handlePhoneAuth}
            size="lg"
            fullWidth
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            leftIcon={<SmartphoneIcon width={20} height={20} color="#FFFFFF" />}
          >
            {t("screens.onboarding.phoneAuth")}
          </Button>

          {/* Secondary Button - Apple ID */}
          <Button
            onPress={handleAppleAuth}
            variant="outline"
            size="lg"
            fullWidth
            style={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
            leftIcon={<AppleIcon width={20} height={20} color="#E7E9EA" />}
          >
            {t("screens.onboarding.appleAuth")}
          </Button>
        </Animated.View>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationContainer: {
    marginBottom: spacing.xxl,
  },
  illustration: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  centerIcon: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingIconTopRight: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  floatingIconBottomLeft: {
    position: "absolute",
    bottom: 16,
    left: 16,
  },
  floatingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#16181C",
    borderWidth: 2,
    borderColor: "#1D9BF0",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  title: {
    ...typography.heading,
    textAlign: "center",
  },
  subtitleContainer: {
    marginBottom: spacing.xxl,
    maxWidth: 400,
  },
  subtitle: {
    ...typography.body,
    color: "#8B98A5",
    textAlign: "center",
  },
  termsTopContainer: {
    maxWidth: 400,
    marginBottom: spacing.xl,
  },
  termsTopText: {
    ...typography.body,
    color: "#E7E9EA",
    textAlign: "center",
    lineHeight: 22,
  },
  buttonsContainer: {
    width: "100%",
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 56,
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    minHeight: 56,
    borderColor: "rgba(231, 233, 234, 0.2)",
  },
  primaryButtonText: {
    ...typography.body,
  },
  secondaryButtonText: {
    ...typography.body,
  },
  termsLink: {
    ...typography.body,
    color: "#1D9BF0",
  },
});
