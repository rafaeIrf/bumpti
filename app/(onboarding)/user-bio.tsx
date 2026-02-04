import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useScreenTracking } from "@/modules/analytics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { logger } from "@/utils/logger";
import React, { useState } from "react";
import { StyleSheet, TextInput } from "react-native";

const MAX_BIO_LENGTH = 500;

export default function UserBioScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();
  const [bio, setBio] = useState(userData.bio || "");

  // Track screen view
  useScreenTracking("onboarding_bio", {
    onboarding_step: 7,
    step_name: "bio",
  });

  const handleContinue = () => {
    // Save bio to Redux (even if empty, it's optional)
    onboardingActions.setBio(bio.trim());
    logger.log("Bio saved:", bio.trim());

    // Complete this step and navigate to next
    completeCurrentStep("user-bio");
  };

  const characterCount = bio.length;

  return (
    <BaseTemplateScreen
      hasStackHeader
      useKeyboardAvoidingView
      contentContainerStyle={{
        paddingBottom: spacing.xxl * 3,
      }}
      scrollEnabled
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("screens.onboarding.continue")}
          onPrimaryPress={handleContinue}
        />
      }
    >
      <ThemedText style={[styles.heading, { color: colors.text }]}>
        {t("screens.onboarding.bioTitle")}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("screens.onboarding.bioSubtitle")}
      </ThemedText>

      <TextInput
        value={bio}
        onChangeText={(text) => {
          if (text.length <= MAX_BIO_LENGTH) {
            setBio(text);
          }
        }}
        placeholder={t("screens.onboarding.bioPlaceholder")}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            ...typography.body,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        maxLength={MAX_BIO_LENGTH}
        autoFocus
      />
      <ThemedText
        style={[styles.characterCount, { color: colors.textSecondary }]}
      >
        {t("screens.onboarding.bioCharacterCount", {
          count: characterCount,
        })}
      </ThemedText>
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
  input: {
    minHeight: 140,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  characterCount: {
    ...typography.caption,
    marginTop: spacing.sm,
    textAlign: "right",
  },
});
