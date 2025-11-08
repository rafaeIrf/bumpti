import {
  ArrowLeftIcon,
  CheckIcon,
  FlameIcon,
  HeartIcon,
  MessageCircleIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export type IntentionOption =
  | "friends"
  | "casual"
  | "chat"
  | "networking"
  | "dating";

const intentionOptions: {
  value: IntentionOption;
  label: string;
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
  description: string;
}[] = [
  {
    value: "friends",
    label: t("screens.onboarding.intentionFriends"),
    icon: UsersIcon,
    description: t("screens.onboarding.intentionFriendsDesc"),
  },
  {
    value: "casual",
    label: t("screens.onboarding.intentionCasual"),
    icon: FlameIcon,
    description: t("screens.onboarding.intentionCasualDesc"),
  },
  {
    value: "chat",
    label: t("screens.onboarding.intentionChat"),
    icon: MessageCircleIcon,
    description: t("screens.onboarding.intentionChatDesc"),
  },
  {
    value: "networking",
    label: t("screens.onboarding.intentionNetworking"),
    icon: ShoppingBagIcon,
    description: t("screens.onboarding.intentionNetworkingDesc"),
  },
  {
    value: "dating",
    label: t("screens.onboarding.intentionDating"),
    icon: HeartIcon,
    description: t("screens.onboarding.intentionDatingDesc"),
  },
];

export default function IntentionScreen() {
  const colors = useThemeColors();
  const [selectedIntentions, setSelectedIntentions] = useState<
    IntentionOption[]
  >([]);

  const navigateNext = () => {
    // Navegar para a tela de fotos
    router.push("/(onboarding)/user-photos" as any);
  };

  const toggleIntention = (value: IntentionOption) => {
    if (selectedIntentions.includes(value)) {
      setSelectedIntentions(selectedIntentions.filter((i) => i !== value));
    } else {
      setSelectedIntentions([...selectedIntentions, value]);
    }
  };

  const handleContinue = () => {
    console.log("Selected intentions:", selectedIntentions);
    if (selectedIntentions.length > 0) {
      // TODO: Save to user profile or context
      // updateUserData({ lookingFor: selectedIntentions[0] });
      navigateNext();
    }
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.replace("/(onboarding)/connect-with"),
            ariaLabel: t("common.back"),
          }}
        />
      }
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
                  width={32}
                  height={32}
                  color={isSelected ? colors.accent : colors.textSecondary}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.optionLabelRow}>
                    <ThemedText
                      style={[styles.optionLabel, { color: colors.text }]}
                    >
                      {option.label}
                    </ThemedText>
                    {isSelected && (
                      <View
                        style={[
                          styles.checkIconContainer,
                          { backgroundColor: colors.accent },
                        ]}
                      >
                        <CheckIcon width={18} height={18} color="#fff" />
                      </View>
                    )}
                  </View>
                  <ThemedText
                    style={[styles.optionDesc, { color: colors.textSecondary }]}
                  >
                    {option.description}
                  </ThemedText>
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
    fontSize: 26,
    marginBottom: spacing.sm,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    marginBottom: spacing.xl,
    textAlign: "center",
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
    gap: spacing.md,
    borderRadius: 18,
    borderWidth: 2,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
    fontWeight: "600",
    fontSize: 15,
    flex: 1,
  },
  checkIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  optionDesc: {
    ...typography.caption,
    fontSize: 13,
  },
  selectedInfo: {
    ...typography.caption,
    fontSize: 13,
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
