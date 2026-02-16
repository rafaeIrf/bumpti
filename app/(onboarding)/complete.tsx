import { CheckIcon, MapPinIcon, SparklesIcon, UsersIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  trackOnboardingComplete,
  useScreenTracking,
} from "@/modules/analytics";
import { t } from "@/modules/locales";
import { saveOnboarding } from "@/modules/onboarding/onboarding-service";
import { fetchAndSetUserProfile } from "@/modules/profile/index";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { logger } from "@/utils/logger";

import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CompleteScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userData } = useOnboardingFlow();
  const [isSaving, setIsSaving] = useState(false);

  useScreenTracking({
    screenName: "onboarding_complete",
    params: { step_name: "complete" },
  });

  const handleComplete = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      await saveOnboarding(userData);
      await trackOnboardingComplete();
      await fetchAndSetUserProfile();
      onboardingActions.completeOnboarding();
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      logger.error("Error saving onboarding:", error);
      Alert.alert(t("common.error"), error?.message || t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseTemplateScreen
      scrollEnabled
      contentContainerStyle={{ paddingBottom: spacing.xxl * 3 }}
      useSafeArea={false}
    >
      {/* ─── Gradient Header ─── */}
      <LinearGradient
        colors={["#0A2D4F", "#0D1B2A", colors.background]}
        locations={[0, 0.6, 1]}
        style={[
          styles.headerGradient,
          { paddingTop: insets.top + spacing.xxl },
        ]}
      >
        {/* Icon badge */}
        <Animated.View entering={ZoomIn.duration(600).delay(200).springify()}>
          <LinearGradient
            colors={["#1D9BF0", "#38BDF8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <CheckIcon width={40} height={40} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(300)}
          style={styles.headerTextContainer}
        >
          <ThemedText style={[typography.heading, styles.headerTitle]}>
            {t("screens.onboarding.completeTitle")}
          </ThemedText>
          <ThemedText style={[typography.body, styles.headerSubtitle]}>
            {t("screens.onboarding.completeSubtitle")}
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      {/* ─── Feature Cards ─── */}
      <View style={styles.cardsContainer}>
        <Animated.View
          entering={FadeInDown.duration(400).delay(450)}
          style={[styles.featureCard, { backgroundColor: colors.surface }]}
        >
          <View
            style={[
              styles.featureIconContainer,
              { backgroundColor: "rgba(29, 155, 240, 0.15)" },
            ]}
          >
            <MapPinIcon width={22} height={22} color="#1D9BF0" />
          </View>
          <View style={styles.featureTextContainer}>
            <ThemedText style={[typography.subheading, { color: colors.text }]}>
              {t("screens.onboarding.completeFindPlaces")}
            </ThemedText>
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.completeFindPlacesDesc")}
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(550)}
          style={[styles.featureCard, { backgroundColor: colors.surface }]}
        >
          <View
            style={[
              styles.featureIconContainer,
              { backgroundColor: "rgba(168, 85, 247, 0.15)" },
            ]}
          >
            <UsersIcon width={22} height={22} color="#A855F7" />
          </View>
          <View style={styles.featureTextContainer}>
            <ThemedText style={[typography.subheading, { color: colors.text }]}>
              {t("screens.onboarding.completeConnectPeople")}
            </ThemedText>
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.completeConnectPeopleDesc")}
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(650)}
          style={[styles.featureCard, { backgroundColor: colors.surface }]}
        >
          <View
            style={[
              styles.featureIconContainer,
              { backgroundColor: "rgba(249, 24, 128, 0.15)" },
            ]}
          >
            <SparklesIcon width={22} height={22} color="#F91880" />
          </View>
          <View style={styles.featureTextContainer}>
            <ThemedText style={[typography.subheading, { color: colors.text }]}>
              {t("screens.onboarding.completeDiscoverVibes")}
            </ThemedText>
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.completeDiscoverVibesDesc")}
            </ThemedText>
          </View>
        </Animated.View>
      </View>

      {/* ─── CTA Button ─── */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(800)}
        style={styles.buttonContainer}
      >
        <Button
          onPress={handleComplete}
          disabled={isSaving}
          size="lg"
          fullWidth
          style={styles.ctaButton}
        >
          <View style={styles.buttonContent}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <MapPinIcon width={20} height={20} color="#FFFFFF" />
            )}
            <ThemedText style={styles.buttonText}>
              {t("screens.onboarding.completeExplore")}
            </ThemedText>
          </View>
        </Button>
      </Animated.View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    alignItems: "center",
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTextContainer: {
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    maxWidth: 280,
  },
  cardsContainer: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.md,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
    gap: 2,
  },
  buttonContainer: {
    paddingTop: spacing.xl,
  },
  ctaButton: {
    minHeight: 56,
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
