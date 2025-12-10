import { MapPinIcon, SparklesIcon, UsersIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { saveOnboarding } from "@/modules/onboarding/onboarding-service";
import { getProfile } from "@/modules/profile/api";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { setProfile } from "@/modules/store/slices/profileActions";
import { calculateAge } from "@/utils/calculate-age";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";

export default function CompleteScreen() {
  const colors = useThemeColors();
  const { userData } = useOnboardingFlow();
  const [isSaving, setIsSaving] = useState(false);

  const handleComplete = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      await saveOnboarding(userData);

      // Sync profile state in Redux
      const profileResponse = await getProfile();
      setProfile({
        id: profileResponse?.id,
        name: profileResponse?.name ?? null,
        birthdate: profileResponse?.birthdate ?? null,
        gender: profileResponse?.gender ?? null,
        connectWith: profileResponse?.connectWith ?? [],
        intentions: profileResponse?.intentions ?? [],
        photos: profileResponse?.photos ?? [],
        updatedAt: profileResponse?.updated_at ?? null,
        age_range_min: profileResponse?.age_range_min ?? null,
        age_range_max: profileResponse?.age_range_max ?? null,
        age: calculateAge(profileResponse?.birthdate ?? null),
        bio: profileResponse?.bio ?? null,
        favoritePlaces: profileResponse?.favoritePlaces ?? [],
        height_cm: profileResponse?.height_cm ?? null,
        job_title: profileResponse?.job_title ?? null,
        company_name: profileResponse?.company_name ?? null,
        smoking_key: profileResponse?.smoking_key ?? null,
        education_key: profileResponse?.education_key ?? null,
        location: profileResponse?.location ?? null,
        languages: profileResponse?.languages ?? [],
        zodiac_key: profileResponse?.zodiac_key ?? null,
        relationship_key: profileResponse?.relationship_key ?? null,
      });
      onboardingActions.completeOnboarding();
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error?.message || "Não foi possível salvar seu onboarding."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseTemplateScreen>
      <View style={styles.container}>
        {/* Success Icon */}
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
            {t("screens.onboarding.completeTitle")}
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
            {t("screens.onboarding.completeSubtitle")}
          </ThemedText>
        </Animated.View>

        {/* Main Button */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.buttonContainer}
        >
          <Button
            onPress={handleComplete}
            disabled={isSaving}
            size="lg"
            fullWidth
            style={styles.exploreButton}
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

        {/* Features */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(500)}
          style={styles.featuresContainer}
        >
          <View style={styles.featureItem}>
            <View
              style={[
                styles.featureIconContainer,
                { backgroundColor: `${colors.accent}1A` },
              ]}
            >
              <MapPinIcon width={24} height={24} color={colors.accent} />
            </View>
            <ThemedText
              style={[styles.featureText, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.completeFindPlaces")}
            </ThemedText>
          </View>

          <View style={styles.featureItem}>
            <View
              style={[
                styles.featureIconContainer,
                { backgroundColor: `${colors.accent}1A` },
              ]}
            >
              <UsersIcon width={24} height={24} color={colors.accent} />
            </View>
            <ThemedText
              style={[styles.featureText, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.completeConnectPeople")}
            </ThemedText>
          </View>
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
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
  },
  buttonContainer: {
    width: "100%",
    marginBottom: spacing.xl,
  },
  exploreButton: {
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
  buttonText: {
    ...typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  featuresContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xxl,
    paddingTop: spacing.lg,
  },
  featureItem: {
    alignItems: "center",
    gap: spacing.sm,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
    maxWidth: 80,
    lineHeight: 16,
  },
});
