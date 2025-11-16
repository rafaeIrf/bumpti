import { HeartIcon, UserRoundIcon, UsersIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export type ConnectWithOption = "female" | "male" | "nonbinary" | "all";

type ConnectWithScreenProps = object;

const connectOptions: {
  value: ConnectWithOption;
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
  label: string;
}[] = [
  {
    value: "female",
    icon: UserRoundIcon,
    label: t("screens.onboarding.connectWithFemale"),
  },
  {
    value: "male",
    icon: UserRoundIcon,
    label: t("screens.onboarding.connectWithMale"),
  },
  {
    value: "nonbinary",
    icon: UsersIcon,
    label: t("screens.onboarding.connectWithNonBinary"),
  },
  {
    value: "all",
    icon: HeartIcon,
    label: t("screens.onboarding.connectWithAll"),
  },
];

export default function ConnectWithScreen(props: ConnectWithScreenProps) {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();
  const [selectedOptions, setSelectedOptions] = useState<ConnectWithOption[]>(
    (userData.connectWith as ConnectWithOption[]) || []
  );

  const handleOptionToggle = (value: ConnectWithOption) => {
    if (value === "all") {
      if (selectedOptions.includes("all")) {
        setSelectedOptions([]);
      } else {
        setSelectedOptions(["all"]);
      }
    } else {
      let newSelection = selectedOptions.filter((opt) => opt !== "all");
      if (newSelection.includes(value)) {
        newSelection = newSelection.filter((opt) => opt !== value);
      } else {
        newSelection = [...newSelection, value];
      }
      setSelectedOptions(newSelection);
    }
  };

  const handleContinue = () => {
    if (selectedOptions.length > 0) {
      onboardingActions.setConnectWith(selectedOptions);
      completeCurrentStep("connect-with");
    }
  };

  const isValid = selectedOptions.length > 0;

  return (
    <BaseTemplateScreen hasStackHeader>
      <View style={styles.container}>
        <ThemedText style={[styles.heading, { color: colors.text }]}>
          {t("screens.onboarding.connectWithTitle")}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("screens.onboarding.connectWithSubtitle")}
        </ThemedText>
        <ThemedText style={[styles.info, { color: colors.textTertiary }]}>
          {t("screens.onboarding.connectWithInfo")}
        </ThemedText>

        <View style={styles.optionsGrid}>
          {connectOptions.map((option) => {
            const isSelected = selectedOptions.includes(option.value);
            return (
              <Pressable
                key={option.value}
                onPress={() => handleOptionToggle(option.value)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected
                      ? colors.accent
                      : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
              >
                <View style={styles.optionContent}>
                  <option.icon
                    width={32}
                    height={32}
                    color={isSelected ? "#fff" : colors.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? "#fff" : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={[styles.info, { color: colors.textSecondary }]}>
          {t("screens.onboarding.connectWithPrivacy")}
        </ThemedText>

        <Button
          onPress={handleContinue}
          disabled={!isValid}
          size="lg"
          fullWidth
          style={styles.continueButton}
        >
          {t("screens.onboarding.continue")}
        </Button>

        <ThemedText style={[styles.footer, { color: colors.textTertiary }]}>
          {t("screens.onboarding.connectWithFooter")}
        </ThemedText>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heading: {
    ...typography.heading,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  info: {
    ...typography.caption,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  optionButton: {
    width: "45%",
    minWidth: 140,
    paddingVertical: spacing.xl,
    borderRadius: 18,
    borderWidth: 2,
    marginBottom: spacing.md,
  },
  optionContent: {
    alignItems: "center",
    gap: 8,
  },
  emoji: {
    marginBottom: 4,
  },
  optionLabel: {
    ...typography.body,
    textAlign: "center",
  },
  continueButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  footer: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
