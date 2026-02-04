import { HeartIcon, UserRoundIcon, UsersIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { CONNECT_WITH_OPTIONS } from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useScreenTracking } from "@/modules/analytics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

type ConnectWithOptionKey = string | "all";

const optionIconMap: Record<
  string,
  React.ComponentType<{ width: number; height: number; color: string }>
> = {
  female: UserRoundIcon,
  male: UserRoundIcon,
  "non-binary": UsersIcon,
  all: HeartIcon,
};

export default function ConnectWithScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();

  // Track screen view
  useScreenTracking("onboarding_connect_with", {
    onboarding_step: 4,
    step_name: "connect_with",
  });

  const [selectedOptions, setSelectedOptions] = useState<
    ConnectWithOptionKey[]
  >((userData.connectWith as ConnectWithOptionKey[]) || []);

  // Initialize with 'all' if nothing selected? Or validate?
  // Previous logic had a useEffect to filter valid keys.
  useEffect(() => {
    const validKeys = CONNECT_WITH_OPTIONS.map((opt) => opt.id);
    setSelectedOptions((current) =>
      current.filter((key) => validKeys.includes(key) || key === "all"),
    );
  }, []);

  const handleOptionToggle = (value: ConnectWithOptionKey) => {
    if (value === "all") {
      setSelectedOptions(["all"]);
      return;
    }
    // If selecting a specific gender, remove 'all'
    let newSelection = selectedOptions.filter((opt) => opt !== "all");

    if (newSelection.includes(value)) {
      newSelection = newSelection.filter((opt) => opt !== value);
    } else {
      newSelection = [...newSelection, value];
    }

    setSelectedOptions(newSelection);
  };

  const handleContinue = () => {
    if (selectedOptions.length > 0) {
      const allGenderKeys = CONNECT_WITH_OPTIONS.filter(
        (o) => o.id !== "all",
      ).map((opt) => opt.id as ConnectWithOptionKey);

      const selectedKeys = selectedOptions.includes("all")
        ? allGenderKeys // If 'all' is selected, save all gender keys
        : selectedOptions;

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
          {/* <ThemedText style={[styles.info, { color: colors.textTertiary }]}>
            {t("screens.onboarding.connectWithInfo")}
          </ThemedText> */}
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(300).duration(500)}
          style={styles.optionsGrid}
        >
          {CONNECT_WITH_OPTIONS.filter((o) => o.id !== "all").map(
            (option, index) => {
              const key = option.id as ConnectWithOptionKey;
              const Icon = optionIconMap[key] ?? HeartIcon;
              const isSelected =
                selectedOptions.includes(key) &&
                !selectedOptions.includes("all"); // Visual selection logic
              // Actually, if 'all' is selected, should individual ones look selected?
              // Previous logic: if 'all', only 'all' is selected in state.

              return (
                <Animated.View
                  key={option.id}
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
                        {t(option.labelKey)}
                      </ThemedText>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            },
          )}

          {/* All option */}
          <Animated.View entering={FadeInUp.delay(450 + 3 * 75).duration(500)}>
            <Pressable
              onPress={() => handleOptionToggle("all")}
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    ...typography.heading,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  info: {
    ...typography.caption,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  optionButton: {
    width: 140,
    height: 140,
    borderRadius: spacing.lg,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    // Shadow for depth
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  optionContent: {
    alignItems: "center",
    gap: spacing.sm,
  },
  optionLabel: {
    ...typography.h4,
    textAlign: "center",
  },
  continueButton: {
    marginTop: "auto",
    marginBottom: spacing.md,
  },
  footer: {
    ...typography.caption,
    textAlign: "center",
  },
});
