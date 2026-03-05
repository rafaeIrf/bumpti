import {
  ArrowRightIcon,
  BriefcaseIcon,
  FlameIcon,
  HeartIcon,
  UsersIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { SelectionCard } from "@/components/ui/selection-card";
import { INTENTION_OPTIONS } from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export type IntentionOptionKey =
  | "relationship"
  | "casual"
  | "networking"
  | "friendship";

const intentionIconMap: Record<
  IntentionOptionKey,
  React.ComponentType<{ width: number; height: number; color: string }>
> = {
  friendship: UsersIcon,
  relationship: HeartIcon,
  casual: FlameIcon,
  networking: BriefcaseIcon,
};

export default function IntentionScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep} = useOnboardingFlow();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_intention",
    params: {
      step_name: "intention",
    },
  });

  const [selectedIntentions, setSelectedIntentions] = useState<
    IntentionOptionKey[]
  >((userData.intentions as IntentionOptionKey[]) || []);

  useEffect(() => {
    const validKeys = INTENTION_OPTIONS.map(
      (opt) => opt.id,
    ) as IntentionOptionKey[];
    setSelectedIntentions((current) =>
      current.filter((key) => validKeys.includes(key)),
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
    }
    completeCurrentStep("intention");
  };

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
          onSecondaryPress={() => completeCurrentStep("intention")}
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
        {INTENTION_OPTIONS.map((option) => {
          const key = option.id as IntentionOptionKey;
          const Icon = intentionIconMap[key] ?? UsersIcon;
          const isSelected = selectedIntentions.includes(key);
          return (
            <SelectionCard
              key={option.id}
              label={t(option.labelKey)}
              isSelected={isSelected}
              onPress={() => toggleIntention(key)}
              icon={Icon}
              showCheckmark={false}
            />
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
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  optionsList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  selectedInfo: {
    ...typography.caption,
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
