import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { phoneAuthService } from "@/modules/auth/phone-auth-service";
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

export default function PhoneAuthScreen() {
  const colors = useThemeColors();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Format phone number as user types (Brazilian format)
  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, "");

    // Limit to 11 digits (DDD + 9 digits)
    const limitedNumbers = numbers.slice(0, 11);

    // Apply formatting
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(
        2,
        7
      )}-${limitedNumbers.slice(7)}`;
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
  };

  const getDigitsOnly = (phone: string) => {
    return phone.replace(/\D/g, "");
  };

  const isValidPhone = () => {
    const digits = getDigitsOnly(phoneNumber);
    return digits.length >= 10; // At least 10 digits (DDD + 8 digits)
  };

  const handleSendCode = async () => {
    if (!isValidPhone()) {
      Alert.alert("Erro", t("screens.onboarding.invalidPhone"));
      return;
    }

    setIsLoading(true);

    try {
      const digits = getDigitsOnly(phoneNumber);
      const fullPhoneNumber = `+55${digits}`;

      console.log("Sending verification code to:", fullPhoneNumber);

      // Send verification code via Supabase Auth
      await phoneAuthService.sendVerificationCode(fullPhoneNumber);

      console.log("Verification code sent successfully");

      // Navigate to code verification screen
      router.push({
        pathname: "/(onboarding)/verify-code",
        params: { phone: fullPhoneNumber },
      });
    } catch (error: any) {
      console.error("Error in handleSendCode:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });

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
            {t("screens.onboarding.phoneAuthTitle")}
          </ThemedText>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          style={styles.subtitleContainer}
        >
          <ThemedText style={styles.subtitle}>
            {t("screens.onboarding.phoneAuthSubtitle")}
          </ThemedText>
        </Animated.View>

        {/* Phone Input */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.inputContainer}
        >
          <View style={styles.inputWrapper}>
            <View style={styles.countryCodeContainer}>
              <ThemedText style={styles.countryCode}>+55</ThemedText>
            </View>
            <TextInput
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder={t("screens.onboarding.phonePlaceholder")}
              placeholderTextColor="#5B6671"
              keyboardType="phone-pad"
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
              maxLength={15} // (DD) 99999-9999 = 15 chars
            />
          </View>
        </Animated.View>

        {/* Send Code Button */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          style={styles.buttonContainer}
        >
          <Button
            onPress={handleSendCode}
            disabled={!isValidPhone() || isLoading}
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
            {t("screens.onboarding.phoneInfo")}
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
  iconContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  inputWrapper: {
    position: "relative",
  },
  countryCodeContainer: {
    position: "absolute",
    left: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  countryCode: {
    ...typography.body,
    color: "#8B98A5",
  },
  input: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 56,
    paddingRight: spacing.md,
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
