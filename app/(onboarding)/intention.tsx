import {
  FlameIcon,
  HeartIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { INTENTION_OPTIONS } from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export type IntentionOptionKey =
  | "relationship"
  | "casual"
  | "networking"
  | "friendship";

const intentionIconMap: Record<
  IntentionOptionKey,
  React.ComponentType<{ width: number; height: number; color: string }>
> = {
  relationship: HeartIcon,
  casual: FlameIcon,
  networking: ShoppingBagIcon,
  friendship: UsersIcon,
};

function getIntentionLabel(key: IntentionOptionKey) {
  const option = INTENTION_OPTIONS.find((opt) => opt.id === key);
  return option ? t(option.labelKey) : key;
}

export default function IntentionScreen() {
  const colors = useThemeColors();
  // const { userData, completeCurrentStep } = useOnboardingFlow(); // Keeping this line from context but not replacing it if it's outside range
  const { userData, completeCurrentStep } = useOnboardingFlow();
  // Removed useOnboardingOptions hook

  const [selectedIntentions, setSelectedIntentions] = useState<
    IntentionOptionKey[]
  >((userData.intentions as IntentionOptionKey[]) || []);

  // Removed useEffect that filtered based on fetched intentions, as we now have static valid keys
  // validating against INTENTION_OPTIONS could be done but might be overkill if types are strict
  // If we want to ensure only valid keys from constants are used initially:
  useEffect(() => {
    const validKeys = INTENTION_OPTIONS.map(
      (opt) => opt.id
    ) as IntentionOptionKey[];
    setSelectedIntentions((current) =>
      current.filter((key) => validKeys.includes(key))
    );
  }, []);

  const toggleIntention = (value: IntentionOptionKey) => {
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
      <Animated.View entering={FadeInDown.delay(200).duration(500)}>
        <ThemedText style={[styles.heading, { color: colors.text }]}>
          {t("screens.onboarding.intentionTitle")}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("screens.onboarding.intentionSubtitle")}
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(300).duration(500)}
        style={styles.optionsList}
      >
        {INTENTION_OPTIONS.map((option, index) => {
          const key = option.id as IntentionOptionKey;
          const Icon = intentionIconMap[key] ?? UsersIcon;
          const isSelected = selectedIntentions.includes(key);
          return (
            <Animated.View
              key={option.id}
              entering={FadeInUp.delay(400 + index * 75).duration(500)}
            >
              <Pressable
                onPress={() => toggleIntention(key)}
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
                  <Icon
                    width={24}
                    height={24}
                    color={isSelected ? colors.accent : colors.textSecondary}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.optionLabelRow}>
                      <ThemedText
                        style={[styles.optionLabel, { color: colors.text }]}
                      >
                        {t(option.labelKey)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>

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
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  optionsList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
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
