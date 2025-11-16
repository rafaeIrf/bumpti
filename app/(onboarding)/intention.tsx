import {
  FlameIcon,
  HeartIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export type IntentionOption = "friends" | "casual" | "networking" | "dating";

const intentionOptions: {
  value: IntentionOption;
  label: string;
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
}[] = [
  {
    value: "friends",
    label: t("screens.onboarding.intentionFriends"),
    icon: UsersIcon,
  },
  {
    value: "casual",
    label: t("screens.onboarding.intentionCasual"),
    icon: FlameIcon,
  },
  {
    value: "networking",
    label: t("screens.onboarding.intentionNetworking"),
    icon: ShoppingBagIcon,
  },
  {
    value: "dating",
    label: t("screens.onboarding.intentionDating"),
    icon: HeartIcon,
  },
];

export default function IntentionScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();
  const [selectedIntentions, setSelectedIntentions] = useState<
    IntentionOption[]
  >((userData.intentions as IntentionOption[]) || []);

  const toggleIntention = (value: IntentionOption) => {
    if (selectedIntentions.includes(value)) {
      setSelectedIntentions(selectedIntentions.filter((i) => i !== value));
    } else {
      setSelectedIntentions([...selectedIntentions, value]);
    }
  };

  const handleContinue = () => {
    if (selectedIntentions.length > 0) {
      onboardingActions.setIntentions(selectedIntentions);
      completeCurrentStep("intention");
    }
  };

  return (
    <BaseTemplateScreen
      hasStackHeader
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("screens.onboarding.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={selectedIntentions.length === 0}
        />
      }
    >
      <ThemedText style={[styles.heading, { color: colors.text }]}>
        {t("screens.onboarding.intentionTitle")}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("screens.onboarding.intentionSubtitle")}
      </ThemedText>

      <View style={styles.optionsList}>
        {intentionOptions.map((option) => {
          const isSelected = selectedIntentions.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggleIntention(option.value)}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected
                    ? `${colors.accent}1A`
                    : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={styles.optionContent}>
                <option.icon
                  width={24}
                  height={24}
                  color={isSelected ? colors.accent : colors.textSecondary}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.optionLabelRow}>
                    <ThemedText
                      style={[styles.optionLabel, { color: colors.text }]}
                    >
                      {option.label}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedIntentions.length > 0 && (
        <ThemedText
          style={[styles.selectedInfo, { color: colors.textSecondary }]}
        >
          {selectedIntentions.length === 1
            ? t("screens.onboarding.intentionSelectedOne")
            : t("screens.onboarding.intentionSelectedMany", {
                count: selectedIntentions.length,
              })}
        </ThemedText>
      )}
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.heading,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionsList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: spacing.md,
    borderWidth: 2,
    padding: spacing.md,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  optionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  optionLabel: {
    ...typography.body,
    flex: 1,
  },
  selectedInfo: {
    ...typography.caption,
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
