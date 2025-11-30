import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { GenderIdentityBottomSheet } from "@/components/gender-identity-bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { SelectionCard } from "@/components/ui/selection-card";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useOnboardingOptions } from "@/hooks/use-onboarding-options";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function UserGenderScreen() {
  const colors = useThemeColors();
  const bottomSheet = useCustomBottomSheet();
  const { userData, completeCurrentStep } = useOnboardingFlow();
  const { genders, isLoading } = useOnboardingOptions();

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
    normalizeInitialGender(userData.gender)
  );

  const genderOptions =
    genders.map((option) => {
      switch (option.key) {
        case "female":
          return {
            value: option.key,
            emoji: "👩",
            label: t("screens.onboarding.genderWoman"),
          };
        case "male":
          return {
            value: option.key,
            emoji: "👨",
            label: t("screens.onboarding.genderMan"),
          };
        case "non-binary":
          return {
            value: option.key,
            emoji: "⚧️",
            label: t("screens.onboarding.genderNonBinary"),
          };
        default:
          return {
            value: option.key,
            emoji: "✨",
            label: t("screens.onboarding.genderOther"),
          };
      }
    }) ?? [];

  const handleGenderSelect = (value: string) => {
    if (value === "non-binary") {
      bottomSheet?.expand({
        content: () => (
          <GenderIdentityBottomSheet
            onSelect={(identity) => {
              setGender("non-binary");
              bottomSheet.close();
            }}
            onClose={() => bottomSheet.close()}
          />
        ),
        snapPoints: ["70%"],
      });
    } else if (value === "other") {
      setGender("other");
    } else {
      setGender(value);
    }
  };

  const handleContinue = () => {
    if (gender) {
      onboardingActions.setUserGender(gender);
      completeCurrentStep("user-gender");
    }
  };

  const isValid = Boolean(gender);
  const isNonBinaryGender = gender === "non-binary";

  if (isLoading && !genderOptions.length) {
    return (
      <BaseTemplateScreen hasStackHeader>
        <View style={styles.loadingContainer}>
          <ThemedText
            style={[styles.subtitle, { color: colors.textSecondary }]}
          >
            {t("screens.onboarding.loading")}
          </ThemedText>
        </View>
      </BaseTemplateScreen>
    );
  }

  return (
    <BaseTemplateScreen hasStackHeader>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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

          {/* Selected identity preview removido */}

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
  buttonContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.caption,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
});
