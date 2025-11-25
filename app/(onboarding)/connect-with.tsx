import { HeartIcon, UserRoundIcon, UsersIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useOnboardingOptions } from "@/hooks/use-onboarding-options";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

type ConnectWithOptionKey = string | "all";

const optionIconMap: Record<
  ConnectWithOptionKey,
  React.ComponentType<{ width: number; height: number; color: string }>
> = {
  women: UserRoundIcon,
  men: UserRoundIcon,
  "non-binary": UsersIcon,
  all: HeartIcon,
};

function getOptionLabel(key: ConnectWithOptionKey) {
  switch (key) {
    case "female":
      return t("screens.onboarding.connectWithFemale");
    case "male":
      return t("screens.onboarding.connectWithMale");
    case "non-binary":
      return t("screens.onboarding.connectWithNonBinary");
    case "all":
      return t("screens.onboarding.connectWithAll");
    default:
      return key;
  }
}

export default function ConnectWithScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();
  const { genders, isLoading, error, reload } = useOnboardingOptions();
  const [selectedOptions, setSelectedOptions] = useState<
    ConnectWithOptionKey[]
  >((userData.connectWith as ConnectWithOptionKey[]) || []);

  useEffect(() => {
    if (genders.length === 0) return;
    const validKeys = [
      ...genders.map((opt) => opt.key as ConnectWithOptionKey),
      "all",
    ];
    setSelectedOptions((current) =>
      current.filter((key) => validKeys.includes(key))
    );
  }, [genders]);

  const handleOptionToggle = (value: ConnectWithOptionKey) => {
    if (value === "all") {
      setSelectedOptions(["all"]);
      return;
    }
    if (selectedOptions.includes("all")) {
      setSelectedOptions([value]);
      return;
    }

    const newSelection = selectedOptions.includes(value)
      ? selectedOptions.filter((opt) => opt !== value)
      : [...selectedOptions, value];
    setSelectedOptions(newSelection);
  };

  const handleContinue = () => {
    if (selectedOptions.length > 0) {
      const allKeys = genders.map((opt) => opt.key as ConnectWithOptionKey);
      const selectedKeys = selectedOptions.includes("all")
        ? allKeys
        : selectedOptions.filter((key) => key !== "all");
      onboardingActions.setConnectWith(selectedKeys);
      completeCurrentStep("connect-with");
    }
  };

  const isValid = selectedOptions.length > 0;

  return (
    <BaseTemplateScreen hasStackHeader>
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <ThemedText style={[styles.heading, { color: colors.text }]}>
            {t("screens.onboarding.connectWithTitle")}
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: colors.textSecondary }]}
          >
            {t("screens.onboarding.connectWithSubtitle")}
          </ThemedText>
          <ThemedText style={[styles.info, { color: colors.textTertiary }]}>
            {t("screens.onboarding.connectWithInfo")}
          </ThemedText>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(300).duration(500)}
          style={styles.optionsGrid}
        >
          {genders.map((option, index) => {
            const key = option.key as ConnectWithOptionKey;
            const Icon = optionIconMap[key] ?? HeartIcon;
            const isSelected = selectedOptions.includes(key);
            return (
              <Animated.View
                key={option.key}
                entering={FadeInUp.delay(450 + index * 75).duration(500)}
              >
                <Pressable
                  onPress={() => handleOptionToggle(key)}
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
                    <Icon
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
                      {getOptionLabel(key)}
                    </ThemedText>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}

          {/* All option (not returned by backend) - show last */}
          <Animated.View
            entering={FadeInUp.delay(450 + genders.length * 75).duration(500)}
          >
            <Pressable
              onPress={() => setSelectedOptions(["all"])}
              style={[
                styles.optionButton,
                {
                  backgroundColor: selectedOptions.includes("all")
                    ? colors.accent
                    : colors.surface,
                  borderColor: selectedOptions.includes("all")
                    ? colors.accent
                    : colors.border,
                },
              ]}
            >
              <View style={styles.optionContent}>
                <HeartIcon
                  width={32}
                  height={32}
                  color={
                    selectedOptions.includes("all")
                      ? "#fff"
                      : colors.textSecondary
                  }
                />
                <ThemedText
                  style={[
                    styles.optionLabel,
                    {
                      color: selectedOptions.includes("all")
                        ? "#fff"
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {t("screens.onboarding.connectWithAll")}
                </ThemedText>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>

        <ThemedText style={[styles.info, { color: colors.textSecondary }]}>
          {t("screens.onboarding.connectWithPrivacy")}
        </ThemedText>

        <Button
          onPress={handleContinue}
          disabled={!isValid || isLoading}
          size="lg"
          fullWidth
          style={styles.continueButton}
        >
          {t("screens.onboarding.continue")}
        </Button>

        {error ? (
          <ThemedText
            style={[styles.footer, { color: colors.error }]}
            onPress={reload}
          >
            {error}
          </ThemedText>
        ) : null}

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
  },
});
