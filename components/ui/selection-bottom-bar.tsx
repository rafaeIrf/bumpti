import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface SelectionBottomBarProps {
  /** Total number of selected items to display */
  selectedCount: number;
  /** Callback when "Done" is pressed */
  onDone: () => void;
  /** Singular label for items (defaults to i18n place/places) */
  singularLabel?: string;
  /** Plural label for items (defaults to i18n place/places) */
  pluralLabel?: string;
}

export function SelectionBottomBar({
  selectedCount,
  onDone,
  singularLabel,
  pluralLabel,
}: SelectionBottomBarProps) {
  const colors = useThemeColors();

  const singular =
    singularLabel ?? t("screens.onboarding.socialHubs.popular.place");
  const plural =
    pluralLabel ?? t("screens.onboarding.socialHubs.popular.places");

  return (
    <ScreenBottomBar variant="custom" showBorder>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
            {t("common.selected")}
          </ThemedText>
          <ThemedText style={[styles.count, { color: colors.text }]}>
            {selectedCount} {selectedCount === 1 ? singular : plural}
          </ThemedText>
        </View>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [
            styles.doneButton,
            { backgroundColor: colors.accent },
            pressed && styles.doneButtonPressed,
          ]}
        >
          <ThemedText style={styles.doneButtonText}>
            {t("common.done")}
          </ThemedText>
        </Pressable>
      </View>
    </ScreenBottomBar>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    ...typography.captionBold,
  },
  count: {
    ...typography.caption,
  },
  doneButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 24,
  },
  doneButtonPressed: {
    opacity: 0.8,
  },
  doneButtonText: {
    ...typography.body1,
    color: "#FFFFFF",
  },
});
