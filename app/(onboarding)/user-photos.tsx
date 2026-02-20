import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { UserPhotoGrid } from "@/components/user-photo-grid";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useState } from "react";
import { StyleSheet } from "react-native";

export default function UserPhotosScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();
  const [photos, setPhotos] = useState<string[]>(userData.photoUris || []);

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_photos",
    params: {
      step_name: "photos",
    },
  });

  const handleContinue = () => {
    if (photos.length >= 2) {
      onboardingActions.setPhotoUris(photos);
      completeCurrentStep("user-photos");
    }
  };

  const remainingPhotos = Math.max(0, 2 - photos.length);

  return (
    <BaseTemplateScreen
      hasStackHeader
      contentContainerStyle={{
        paddingBottom: spacing.xxl * 3,
      }}
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("screens.onboarding.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={photos.length < 2}
        />
      }
    >
      <ThemedText style={[styles.heading, { color: colors.text }]}>
        {t("screens.onboarding.photosTitle")}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("screens.onboarding.photosSubtitle")}
      </ThemedText>

      <UserPhotoGrid
        maxPhotos={9}
        minPhotos={2}
        photos={photos}
        onPhotosChange={setPhotos}
      />
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.heading,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
});
