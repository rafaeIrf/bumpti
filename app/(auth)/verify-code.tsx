import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { phoneAuthService } from "@/modules/auth";
import { t } from "@/modules/locales";
import { fetchAndSetUserProfile } from "@/modules/profile/index";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function VerifyCodeScreen() {
  const colors = useThemeColors();

  const params = useLocalSearchParams<{ phone: string }>();
  const phoneNumber = params.phone || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Format phone number for display
  const formatPhoneForDisplay = (phone: string) => {
    // Remove +55 and format
    const digits = phone.replace("+55", "");
    if (digits.length === 11) {
      return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(
        7
      )}`;
    }
    return phone;
  };

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all fields are filled
    if (newCode.every((digit) => digit !== "") && !isLoading) {
      setTimeout(() => verifyCode(newCode.join("")), 300);
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (verificationCode: string) => {
    setIsLoading(true);

    try {
      // Verify code with Supabase
      await phoneAuthService.verifyCode(verificationCode);

      // Fetch user profile - this populates Redux store
      // SessionContext will update isReady once profile is loaded
      // Guards will then automatically redirect to correct destination:
      // - If profile exists: mainAppGuard becomes true, authGuard becomes false
      // - If no profile: onboardingGuard becomes true, authGuard becomes false
      await fetchAndSetUserProfile();

      // Keep loading state visible - guards will navigate us away
      // No manual router.replace() needed!
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert("Erro", error.message || t("screens.onboarding.invalidCode"));
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const handleVerify = () => {
    const verificationCode = code.join("");
    if (verificationCode.length === 6) {
      verifyCode(verificationCode);
    } else {
      Alert.alert("Erro", t("screens.onboarding.enterCompleteCode"));
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    try {
      await phoneAuthService.resendVerificationCode(phoneNumber);

      Alert.alert(
        "Sucesso",
        t("screens.onboarding.newCodeSent", {
          phone: formatPhoneForDisplay(phoneNumber),
        })
      );

      setCanResend(false);
      setResendTimer(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
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
            {t("screens.onboarding.verifyCodeTitle")}
          </ThemedText>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          style={styles.subtitleContainer}
        >
          <ThemedText style={styles.subtitle}>
            {t("screens.onboarding.verifyCodeSubtitle")}
          </ThemedText>
          <ThemedText style={styles.phoneNumber}>
            {formatPhoneForDisplay(phoneNumber)}
          </ThemedText>
        </Animated.View>

        {/* OTP Input */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.otpContainer}
        >
          <View style={styles.otpInputs}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(value) => handleCodeChange(index, value)}
                onKeyPress={({ nativeEvent: { key } }) =>
                  handleKeyPress(index, key)
                }
                editable={!isLoading}
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: digit ? "#1D9BF0" : colors.border,
                    color: colors.text,
                  },
                ]}
                autoFocus={index === 0}
              />
            ))}
          </View>
        </Animated.View>

        {/* Verify Button */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          style={styles.buttonContainer}
        >
          <Button
            onPress={handleVerify}
            disabled={code.some((digit) => !digit) || isLoading}
            size="lg"
            fullWidth
            style={styles.verifyButton}
            textStyle={styles.verifyButtonText}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <ThemedText style={styles.verifyButtonText}>
                  {t("screens.onboarding.verifying")}
                </ThemedText>
              </View>
            ) : (
              t("screens.onboarding.verify")
            )}
          </Button>
        </Animated.View>

        {/* Resend Code */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.resendContainer}
        >
          {canResend ? (
            <Pressable onPress={handleResend}>
              <ThemedText style={styles.resendLink}>
                {t("screens.onboarding.resendCode")}
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={styles.resendTimer}>
              {t("screens.onboarding.resendCodeIn", { seconds: resendTimer })}
            </ThemedText>
          )}
        </Animated.View>

        {/* Info */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(500)}
          style={styles.infoContainer}
        >
          <ThemedText style={styles.infoText}>
            {t("screens.onboarding.codeNotReceived")}
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
    color: "#E7E9EA",
    textAlign: "center",
  },
  subtitleContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: "#8B98A5",
    textAlign: "center",
  },
  phoneNumber: {
    ...typography.body,
    color: "#E7E9EA",
    textAlign: "center",
    marginTop: 4,
  },
  otpContainer: {
    marginBottom: spacing.lg,
  },
  otpInputs: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    textAlign: "center",
    ...typography.body,
  },
  buttonContainer: {
    marginBottom: spacing.md,
  },
  verifyButton: {
    minHeight: 56,
    shadowColor: "#1D9BF0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonText: {
    ...typography.body,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  resendLink: {
    ...typography.body,
    color: "#1D9BF0",
  },
  resendTimer: {
    ...typography.body,
    color: "#5B6671",
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
