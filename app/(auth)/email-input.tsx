import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { emailAuthService } from "@/modules/auth";
import { t } from "@/modules/locales";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function EmailInputScreen() {
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isValidEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleSendCode = async () => {
    if (!isValidEmail()) {
      Alert.alert("Erro", t("screens.auth.invalidEmail"));
      return;
    }

    setIsLoading(true);

    try {
      const trimmedEmail = email.toLowerCase().trim();

      await emailAuthService.sendEmailOTP(trimmedEmail);

      // Navigate to code verification screen
      router.push({
        pathname: "/(auth)/verify-code",
        params: { email: trimmedEmail },
      });
    } catch (error: any) {
      const errorMessage =
        error.message || "Ocorreu um erro ao enviar o código. Tente novamente.";

      Alert.alert("Erro", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
            color: colors.icon,
          }}
        />
      }
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Title */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={styles.titleContainer}
        >
          <ThemedText style={styles.title}>
            {t("screens.auth.emailInputTitle")}
          </ThemedText>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          style={styles.subtitleContainer}
        >
          <ThemedText style={styles.subtitle}>
            {t("screens.auth.emailInputSubtitle")}
          </ThemedText>
        </Animated.View>

        {/* Email Input */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.inputContainer}
        >
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("screens.auth.emailPlaceholder")}
            placeholderTextColor="#5B6671"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            autoFocus
            editable={!isLoading}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
        </Animated.View>

        {/* Send Code Button */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          style={styles.buttonContainer}
        >
          <Button
            onPress={handleSendCode}
            disabled={!isValidEmail() || isLoading}
            size="lg"
            fullWidth
            style={styles.sendButton}
            textStyle={styles.sendButtonText}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <ThemedText style={styles.sendButtonText}>
                  {t("screens.onboarding.sending")}
                </ThemedText>
              </View>
            ) : (
              t("screens.onboarding.sendCode")
            )}
          </Button>
        </Animated.View>

        {/* Info */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.infoContainer}
        >
          <ThemedText style={styles.infoText}>
            {t("screens.auth.emailInfo")}
          </ThemedText>
        </Animated.View>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.lg,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
  },
  subtitleContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: "#8B98A5",
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  input: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  buttonContainer: {
    marginBottom: spacing.md,
  },
  sendButton: {
    minHeight: 56,
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonText: {
    ...typography.body,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  infoContainer: {
    alignItems: "center",
  },
  infoText: {
    ...typography.caption,
    color: "#5B6671",
    textAlign: "center",
    lineHeight: 18,
  },
});
