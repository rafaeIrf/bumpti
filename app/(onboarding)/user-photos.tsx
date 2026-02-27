import { ArrowRightIcon } from "@/assets/icons";
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
  const photoHashes = userData.photoHashes ?? {};

  const handlePhotosChange = (newPhotos: string[]) => {
    setPhotos(newPhotos);
    onboardingActions.setPhotoUris(newPhotos);
  };
  useScreenTracking({
    screenName: "onboarding_photos",
    params: {
      step_name: "photos",
    },
  });

  const handlePhotoHashesChange = (hashes: Record<string, string>) => {
    onboardingActions.setPhotoHashes(hashes);
  };

  const handleContinue = () => {
    if (photos.length >= 2) {
      onboardingActions.setPhotoUris(photos);
      completeCurrentStep("user-photos");
    }
  };

  return (
    <BaseTemplateScreen
      hasStackHeader
      contentContainerStyle={{
        paddingBottom: spacing.xxl * 3,
      }}
      BottomBar={
        <ScreenBottomBar
          variant="wizard"
          onPrimaryPress={handleContinue}
          primaryDisabled={photos.length < 2}
          primaryIcon={ArrowRightIcon}
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
        onPhotosChange={handlePhotosChange}
        onPhotoHashesChange={handlePhotoHashesChange}
        photoHashes={photoHashes}
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
