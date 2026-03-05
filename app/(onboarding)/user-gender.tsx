import { ArrowRightIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { SelectionCard } from "@/components/ui/selection-card";
import { GENDER_OPTIONS } from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices";
import { isIOS } from "@/utils";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function UserGenderScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep} = useOnboardingFlow();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_gender",
    params: {
      step_name: "gender",
    },
  });

  const normalizeInitialGender = (value?: string | null) => {
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower.includes("female") || lower.includes("mulher")) return "female";
    if (lower.includes("male") || lower.includes("homem")) return "male";
    if (lower.includes("non-binary") || lower.includes("não bin"))
      return "non-binary";
    if (lower.includes("other")) return "other";
    return "";
  };

  const [gender, setGender] = useState<string>(
    normalizeInitialGender(userData.gender),
  );

  const genderOptions =
    GENDER_OPTIONS.map((option) => {
      switch (option.id) {
        case "female":
          return {
            value: option.id,
            emoji: "👩",
            label: t(option.labelKey),
          };
        case "male":
          return {
            value: option.id,
            emoji: "👨",
            label: t(option.labelKey),
          };
        case "non-binary":
          return {
            value: option.id,
            emoji: "⚧️",
            label: t(option.labelKey),
          };
        default:
          return {
            value: option.id,
            emoji: "✨",
            label: t(option.labelKey),
          };
      }
    }) ?? [];

  const handleGenderSelect = (value: string) => {
    if (value === "other") {
      setGender("other");
    } else {
      setGender(value);
    }
  };

  const handleContinue = () => {
    if (gender) {
      onboardingActions.setUserGender(gender);
    }
    completeCurrentStep("user-gender");
  };

  const isNonBinaryGender = gender === "non-binary";

  return (
    <BaseTemplateScreen
      hasStackHeader
      BottomBar={
        <ScreenBottomBar
          variant="wizard"
          onPrimaryPress={handleContinue}
          primaryDisabled={false}
          primaryIcon={ArrowRightIcon}
          secondaryLabel={t("common.skip")}
          onSecondaryPress={() => completeCurrentStep("user-gender")}
        />
      }
    >
      <KeyboardAvoidingView
        behavior={isIOS ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            style={styles.header}
          >
            <ThemedText style={[styles.title, { color: colors.text }]}>
              {t("screens.onboarding.genderTitle")}
            </ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.genderSubtitle")}
            </ThemedText>
          </Animated.View>

          {/* Gender Options */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(600)}
            style={styles.optionsContainer}
          >
            {genderOptions.map((option) => {
              const isSelected =
                gender === option.value ||
                (option.value === "Não binário" && isNonBinaryGender);

              return (
                <SelectionCard
                  key={option.value}
                  label={option.label}
                  isSelected={Boolean(isSelected)}
                  onPress={() => handleGenderSelect(option.value)}
                />
              );
            })}
          </Animated.View>

          {/* Info text */}
          <ThemedText
            style={[styles.infoText, { color: colors.textSecondary }]}
          >
            {t("screens.onboarding.genderUpdateInfo")}
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
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
  optionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoText: {
    ...typography.caption,
    textAlign: "center",
  },
});
