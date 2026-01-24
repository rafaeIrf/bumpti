import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

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
    <BaseTemplateScreen hasStackHeader>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            style={styles.header}
          >
            <ThemedText
              style={[
                styles.title,
                { ...typography.heading, color: colors.text },
              ]}
            >
              {t("screens.onboarding.nameTitle")}
            </ThemedText>
            <ThemedText
              style={[
                styles.subtitle,
                { ...typography.body, color: colors.textSecondary },
              ]}
            >
              {t("screens.onboarding.nameSubtitle")}
            </ThemedText>
          </Animated.View>

          {/* Input */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(600)}
            style={styles.inputContainer}
          >
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("screens.onboarding.namePlaceholder")}
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
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              maxLength={50}
            />
          </Animated.View>

          {/* Continue Button */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(600)}
            style={styles.buttonContainer}
          >
            <Button
              onPress={handleContinue}
              disabled={!isValid}
              size="lg"
              fullWidth
            >
              {t("screens.onboarding.continue")}
            </Button>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: spacing.md,
    justifyContent: "center",
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  input: {
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: 28,
    borderWidth: 1,
    fontSize: 18,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
