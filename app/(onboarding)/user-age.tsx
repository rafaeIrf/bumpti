import { CalendarIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import DateTimePicker from "@react-native-community/datetimepicker";
import moment, { Moment } from "moment";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function UserAgeScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();

  const [birthDate, setBirthDate] = useState<Moment | null>(null);
  const [dateText, setDateText] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);

  const calculateAge = (dateOfBirth: Moment): number => {
    return moment().diff(dateOfBirth, "years");
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    // On Android, hide picker after selection
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      const mDate = moment(selectedDate);
      setBirthDate(mDate);
      setDateText(mDate.format("DD/MM/YYYY"));
    }
  };

  const formatDateInput = (text: string): string => {
    // Remove non-numeric characters
    const numbers = text.replace(/\D/g, "");

    // Limit to 8 digits (DDMMYYYY)
    const limitedNumbers = numbers.slice(0, 8);

    // Format as DD/MM/YYYY
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 4) {
      return `${limitedNumbers.slice(0, 2)}/${limitedNumbers.slice(2)}`;
    } else {
      return `${limitedNumbers.slice(0, 2)}/${limitedNumbers.slice(
        2,
        4
      )}/${limitedNumbers.slice(4)}`;
    }
  };

  const parseDateFromText = (text: string): Date | null => {
    const parsed = moment(text, "DD/MM/YYYY", true);
    if (!parsed.isValid()) return null;
    return parsed.toDate();
  };

  const handleTextChange = (text: string) => {
    const formatted = formatDateInput(text);
    setDateText(formatted);

    // Try to parse the date if complete
    if (formatted.length === 10) {
      const parsed = parseDateFromText(formatted);
      if (parsed) {
        setBirthDate(moment(parsed));
      }
    } else {
      // Clear birthDate if text is incomplete
      if (birthDate) {
        setBirthDate(null);
      }
    }
  };

  const handleContinue = () => {
    if (isValid && birthDate) {
      const isoDate = birthDate.toISOString().split("T")[0]; // YYYY-MM-DD
      onboardingActions.setUserBirthdate(isoDate);
      completeCurrentStep("user-age");
    }
  };

  const age = birthDate ? calculateAge(birthDate) : null;
  const isValid = birthDate !== null && age !== null && age >= 18;

  // Get max date (today) and min date (120 years ago)
  const maxDate = new Date();
  const minDate = moment().subtract(120, "years").toDate();

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
            <ThemedText style={[styles.title, { color: colors.text }]}>
              {t("screens.onboarding.ageTitle")}
            </ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.ageSubtitle")}
            </ThemedText>
          </Animated.View>

          {/* Date Input */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(600)}
            style={styles.inputContainer}
          >
            <View
              style={[
                styles.dateInputWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Pressable
                onPress={() => setShowPicker(true)}
                style={styles.iconButton}
              >
                <CalendarIcon width={20} height={20} color={colors.accent} />
              </Pressable>

              <TextInput
                value={dateText}
                onChangeText={handleTextChange}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={10}
                style={[
                  styles.dateInput,
                  {
                    color: colors.text,
                  },
                ]}
              />
            </View>

            {/* Age Preview - Valid */}
            {age !== null && age >= 18 && (
              <Animated.View
                entering={FadeInUp.delay(100).duration(400)}
                style={[styles.agePreview, { borderColor: colors.border }]}
              >
                <ThemedText
                  style={[styles.agePreviewText, { color: colors.accent }]}
                >
                  {t("screens.onboarding.agePreview", { age })}
                </ThemedText>
              </Animated.View>
            )}

            {/* Age Error - Underage */}
            {age !== null && age < 18 && (
              <Animated.View
                entering={FadeInUp.delay(100).duration(400)}
                style={[styles.agePreview, { borderColor: colors.error }]}
              >
                <ThemedText
                  style={[styles.agePreviewText, { color: colors.error }]}
                >
                  {t("screens.onboarding.ageError")}
                </ThemedText>
              </Animated.View>
            )}
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

        {/* Date Picker Modal */}
        {showPicker && (
          <DateTimePicker
            value={birthDate ? birthDate.toDate() : maxDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            maximumDate={maxDate}
            minimumDate={minDate}
            textColor={colors.text}
          />
        )}
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
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  dateInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingRight: spacing.lg,
  },
  iconButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  dateInput: {
    ...typography.body,
    flex: 1,
    height: 56,
    fontWeight: "600",
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  agePreview: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  agePreviewText: {
    ...typography.caption,
    fontWeight: "500",
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
