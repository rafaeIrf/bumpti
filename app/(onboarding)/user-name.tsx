import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useState } from "react";
import { StyleSheet } from "react-native";

export default function UserNameScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();
  const [name, setName] = useState(userData.name || "");

  const handleContinue = () => {
    if (name.trim()) {
      // Save name to Redux
      onboardingActions.setUserName(name.trim());

      // Complete this step and navigate to next
      completeCurrentStep("user-name");
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <BaseTemplateScreen
      hasStackHeader
      useKeyboardAvoidingView
      contentContainerStyle={{
        paddingBottom: spacing.xxl * 3,
      }}
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("screens.onboarding.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={!isValid}
        />
      }
    >
      <ThemedText style={[styles.title, { color: colors.text }]}>
        {t("screens.onboarding.nameTitle")}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("screens.onboarding.nameSubtitle")}
      </ThemedText>

      <InputText
        value={name}
        onChangeText={setName}
        placeholder={t("screens.onboarding.namePlaceholder")}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleContinue}
        maxLength={50}
        containerStyle={styles.inputContainer}
      />
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.heading,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
});
