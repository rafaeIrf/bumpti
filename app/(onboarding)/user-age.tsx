import { CalendarIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { isAndroid } from "@/utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import moment, { Moment } from "moment";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

export default function UserAgeScreen() {
  const colors = useThemeColors();
  const { completeCurrentStep } = useOnboardingFlow();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_age",
    params: {
      step_name: "age",
    },
  });

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
        4,
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
  const MIN_AGE = 18;
  const MAX_AGE = 100; // Maximum realistic age
  const isValid =
    birthDate !== null && age !== null && age >= MIN_AGE && age <= MAX_AGE;

  // Get max date (today) and min date (100 years ago)
  const maxDate = new Date();
  const minDate = moment().subtract(MAX_AGE, "years").toDate();

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
        {t("screens.onboarding.ageTitle")}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("screens.onboarding.ageSubtitle")}
      </ThemedText>

      <View>
        <InputText
          value={dateText}
          onChangeText={handleTextChange}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          leftIcon={CalendarIcon}
          onLeftIconPress={() => setShowPicker(true)}
        />

        {/* Age Preview - Valid */}
        {age !== null && age >= MIN_AGE && age <= MAX_AGE && (
          <View style={[styles.agePreview, { borderColor: colors.border }]}>
            <ThemedText
              style={[styles.agePreviewText, { color: colors.accent }]}
            >
              {t("screens.onboarding.agePreview", { age })}
            </ThemedText>
          </View>
        )}

        {/* Age Error - Underage */}
        {age !== null && age < MIN_AGE && (
          <View style={[styles.agePreview, { borderColor: colors.error }]}>
            <ThemedText
              style={[styles.agePreviewText, { color: colors.error }]}
            >
              {t("screens.onboarding.ageError")}
            </ThemedText>
          </View>
        )}

        {/* Age Error - Too Old */}
        {age !== null && age > MAX_AGE && (
          <View style={[styles.agePreview, { borderColor: colors.error }]}>
            <ThemedText
              style={[styles.agePreviewText, { color: colors.error }]}
            >
              {t("screens.onboarding.ageErrorTooOld")}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Date Picker Modal */}
      {showPicker && isAndroid && (
        <DateTimePicker
          value={birthDate ? birthDate.toDate() : maxDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={maxDate}
          minimumDate={minDate}
          textColor={colors.text}
        />
      )}
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
  agePreview: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  agePreviewText: {
    ...typography.caption,
    fontWeight: "500",
  },
});
