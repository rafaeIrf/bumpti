import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useRouter } from "expo-router";
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
  const router = useRouter();
  const colors = useThemeColors();
  const [name, setName] = useState("");

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    if (name.trim()) {
      // TODO: Save user name to profile/storage
      console.log("User name:", name.trim());

      // Navigate to age screen
      router.push("/(onboarding)/user-age");
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: handleBack,
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    justifyContent: "center",
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: spacing.lg,
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
