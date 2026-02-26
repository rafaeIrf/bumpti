import { ArrowRightIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { moderateBioText } from "@/modules/moderation";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { logger } from "@/utils/logger";
import React, { useState } from "react";
import { StyleSheet, TextInput } from "react-native";

const MAX_BIO_LENGTH = 500;

export default function UserBioScreen() {
  const colors = useThemeColors();
  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: "" });
  const { userData, completeCurrentStep} = useOnboardingFlow();
  const [bio, setBio] = useState(userData.bio || "");
  const [isValidating, setIsValidating] = useState(false);

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_bio",
    params: {
      step_name: "bio",
    },
  });

  const handleContinue = async () => {
    const trimmedBio = bio.trim();

    // Skip moderation for empty bios (bio is optional)
    if (trimmedBio) {
      setIsValidating(true);

      try {
        const result = await moderateBioText(trimmedBio);

        if (!result.approved) {
          setIsValidating(false);

          // Show semantic error message based on rejection reason
          const errorMessage =
            result.reason === "personal_data_detected"
              ? t("moderation.bioPersonalDataRejected")
              : t("moderation.bioContentRejected");

          setErrorModal({ visible: true, message: errorMessage });
          return;
        }
      } catch (error) {
        logger.error("Bio moderation error:", error);
        // Fail-safe: continue on error
      }

      setIsValidating(false);
    }

    // Save bio to Redux (even if empty, it's optional)
    onboardingActions.setBio(trimmedBio);
    logger.log("Bio saved:", trimmedBio);

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
          variant="wizard"
          onPrimaryPress={handleContinue}
          primaryDisabled={isValidating}
          primaryIcon={ArrowRightIcon}
          secondaryLabel={t("common.skip")}
          onSecondaryPress={() => completeCurrentStep("user-bio")}
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
        editable={!isValidating}
      />
      <ThemedText
        style={[styles.characterCount, { color: colors.textSecondary }]}
      >
        {t("screens.onboarding.bioCharacterCount", {
          count: characterCount,
        })}
      </ThemedText>

      {/* Error Modal */}
      <ConfirmationModal
        isOpen={errorModal.visible}
        onClose={() => setErrorModal({ visible: false, message: "" })}
        title={t("common.error")}
        description={errorModal.message}
        actions={[
          {
            label: t("common.ok"),
            onPress: () => setErrorModal({ visible: false, message: "" }),
          },
        ]}
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
