import { AppleIcon, GoogleIcon } from "@/assets/icons";
import { BumptiWideLogo } from "@/assets/images";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Colors, spacing, typography } from "@/constants/theme";
import { useScreenTracking } from "@/modules/analytics";
import { socialAuthService } from "@/modules/auth";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { openPrivacyPolicy, openTermsOfUse } from "@/utils";
import { logger } from "@/utils/logger";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

// Welcome screen background image - also prefetched in _layout.tsx
export const WELCOME_BG_IMAGE =
  "https://images.unsplash.com/photo-1562878952-7694a555ad20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcm93ZGVkJTIwYmFyJTIwc29jaWFsJTIwZ2F0aGVyaW5nfGVufDF8fHx8MTc2ODY1NzQwMHww&ixlib=rb-4.1.0&q=80&w=1080";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function WelcomeScreen() {
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState<"apple" | "google" | null>(null);

  // Track screen view
  useScreenTracking({
    screenName: "auth_welcome",
    params: {
      screen_class: "WelcomeScreen",
    },
  });

  useEffect(() => {
    // Configure Google Sign-In on mount
    socialAuthService.configureGoogle();

    // Check Apple availability
    socialAuthService.isAppleAuthAvailable().then(setIsAppleAvailable);
  }, []);

  const handleAppleAuth = async () => {
    if (isLoading) return;

    try {
      setIsLoading("apple");
      const { appleFullName } = await socialAuthService.signInWithApple();

      // Persist auth provider in onboarding state
      onboardingActions.setAuthProvider("apple");

      // If Apple provided the user's name (first authorization only),
      // auto-populate it and skip the manual name input step
      if (appleFullName?.givenName) {
        const firstName = appleFullName.givenName.trim();
        onboardingActions.setUserName(firstName);
        onboardingActions.completeStep("user-name");
        onboardingActions.setCurrentStep("user-age");
        logger.log(
          "Apple name auto-populated, skipping user-name step:",
          firstName,
        );
      }

      // Navigation handled by session context
    } catch (error: any) {
      logger.error("Apple auth error:", error);
      // TODO: Show toast with error.message
    } finally {
      setIsLoading(null);
    }
  };

  const handleGoogleAuth = async () => {
    if (isLoading) return;

    try {
      setIsLoading("google");
      await socialAuthService.signInWithGoogle();
      // Navigation handled by session context
    } catch (error: any) {
      logger.error("Google auth error:", error);
      // TODO: Show toast with error.message
    } finally {
      setIsLoading(null);
    }
  };

  // LEGACY: Phone auth hidden but functional
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePhoneAuth = () => {
    router.push("/(auth)/phone-auth");
  };

  const handleEmailAuth = () => {
    router.push("/(auth)/email-input");
  };

  const handleTermsPress = async () => {
    await openTermsOfUse();
  };

  const handlePrivacyPress = async () => {
    await openPrivacyPolicy();
  };

  return (
    <View style={styles.container}>
      {/* Background Image - Fixed */}
      <Image
        source={{ uri: WELCOME_BG_IMAGE }}
        style={styles.backgroundImage}
        contentFit="cover"
      />

      {/* Gradient Overlays - Fixed */}
      <LinearGradient
        colors={[
          "rgba(0, 0, 0, 0.85)",
          "rgba(0, 0, 0, 0.70)",
          "rgba(0, 0, 0, 0.95)",
        ]}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
      />
      <LinearGradient
        colors={["rgba(0, 0, 0, 0.90)", "transparent", "transparent"]}
        locations={[0, 0.3, 1]}
        style={styles.gradientOverlayBottom}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
      />

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Top Section - Logo + Hero */}
          <View>
            <View style={styles.logoContainer}>
              <BumptiWideLogo height={28} width={100} />
            </View>

            <Animated.View
              entering={FadeInUp.delay(200).duration(600)}
              style={styles.heroContainer}
            >
              <ThemedText style={styles.heroTitle}>
                {t("screens.onboarding.heroTitle1")}
                {"\n"}
                <ThemedText style={styles.heroTitleHighlight}>
                  {t("screens.onboarding.heroTitle2")}
                </ThemedText>
              </ThemedText>
            </Animated.View>
          </View>
          {/* Bottom Section - Auth Buttons */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(600)}
            style={styles.bottomContainer}
          >
            <ThemedText style={styles.heroSubtitle}>
              {t("screens.onboarding.heroSubtitle")}
            </ThemedText>

            {/* Apple Sign-In Button (iOS only) */}
            {Platform.OS === "ios" && isAppleAvailable && (
              <Button
                onPress={handleAppleAuth}
                size="lg"
                fullWidth
                style={styles.appleButton}
                textStyle={styles.appleButtonText}
                disabled={isLoading !== null}
                leftIcon={
                  isLoading === "apple" ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <AppleIcon width={20} height={20} color="#FFFFFF" />
                  )
                }
              >
                {t("screens.onboarding.appleAuth")}
              </Button>
            )}

            {/* Google Sign-In Button */}
            <Button
              onPress={handleGoogleAuth}
              size="lg"
              fullWidth
              style={styles.googleButton}
              textStyle={styles.googleButtonText}
              disabled={isLoading !== null}
              leftIcon={
                isLoading === "google" ? (
                  <ActivityIndicator size="small" color="#1F1F1F" />
                ) : (
                  <GoogleIcon width={20} height={20} />
                )
              }
            >
              {t("screens.onboarding.googleAuth")}
            </Button>

            {/* Email Auth Button (Ghost/Outline) */}
            <Button
              onPress={handleEmailAuth}
              variant="ghost"
              size="lg"
              fullWidth
              style={styles.emailButton}
              textStyle={styles.emailButtonText}
              disabled={isLoading !== null}
            >
              {t("screens.auth.continueWithEmail")}
            </Button>

            {/* Terms and Privacy */}
            <Animated.View
              entering={FadeInUp.delay(600).duration(500)}
              style={styles.termsContainer}
            >
              <ThemedText style={styles.termsText}>
                {t("screens.onboarding.termsPrefix")}{" "}
                <ThemedText onPress={handleTermsPress} style={styles.termsLink}>
                  {t("screens.onboarding.terms")}
                </ThemedText>{" "}
                {t("screens.onboarding.termsAnd")}{" "}
                <ThemedText
                  onPress={handlePrivacyPress}
                  style={styles.termsLink}
                >
                  {t("screens.onboarding.privacy")}
                </ThemedText>
              </ThemedText>
            </Animated.View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  logoContainer: {
    alignItems: "center",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlayBottom: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    minHeight: SCREEN_HEIGHT,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl * 2,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  heroContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  heroTitle: {
    ...typography.heading1,
    fontSize: 28,
    lineHeight: 40,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  heroTitleHighlight: {
    ...typography.heading1,
    fontSize: 28,
    lineHeight: 40,
    color: Colors.dark.accent,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...typography.body,
    fontSize: 16,
    color: "#A8B3BF",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 450,
    marginBottom: spacing.md,
  },
  bottomContainer: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: spacing.md,
  },
  // Apple Button - Black background per Apple guidelines
  appleButton: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#333333",
  },
  appleButtonText: {
    ...typography.body1,
    color: "#FFFFFF",
  },
  // Google Button - White background per Google guidelines
  googleButton: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  googleButtonText: {
    ...typography.body1,
    color: "#1F1F1F",
  },
  // Email Button - Ghost/Outline style for secondary option
  emailButton: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "transparent",
  },
  emailButtonText: {
    ...typography.body1,
    color: "#A8B3BF",
  },
  // LEGACY: Phone button styles kept for reference
  primaryButton: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#1D9BF0",
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    ...typography.body1,
    color: "#FFFFFF",
  },
  termsContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  termsText: {
    ...typography.caption,
    color: "#71767B",
    textAlign: "center",
  },
  termsLink: {
    ...typography.caption,
    color: "#1D9BF0",
    textDecorationLine: "underline",
    textDecorationColor: "#1D9BF0",
  },
});
