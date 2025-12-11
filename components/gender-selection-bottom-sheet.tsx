import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { SelectionCard } from "@/components/ui/selection-card";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

interface GenderSelectionBottomSheetContentProps {
  readonly initialSelection: string[];
  readonly onConfirm: (selection: string[]) => void;
  readonly options: { id: string; label: string }[];
}

export function GenderSelectionBottomSheetContent({
  initialSelection,
  onConfirm,
  options,
}: GenderSelectionBottomSheetContentProps) {
  const colors = useThemeColors();
  const [tempSelection, setTempSelection] =
    useState<string[]>(initialSelection);

  const toggleGenderOption = (value: string) => {
    setTempSelection((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {t("screens.onboarding.connectWithTitle")}
        </ThemedText>
        <ThemedText
          style={[styles.description, { color: colors.textSecondary }]}
        >
          {t("screens.onboarding.connectWithSubtitle")}
        </ThemedText>
      </View>

      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <SelectionCard
            key={option.id}
            label={option.label}
            isSelected={tempSelection.includes(option.id)}
            onPress={() => toggleGenderOption(option.id)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        {tempSelection.length === 0 && (
          <ThemedText style={[styles.errorText, { color: colors.error }]}>
            {t("filters.gender.selectAtLeastOne")}
          </ThemedText>
        )}
        <Button
          onPress={() => onConfirm(tempSelection)}
          label={t("screens.onboarding.confirm")}
          disabled={tempSelection.length === 0}
          fullWidth
          size="lg"
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    fontSize: 14,
  },
  optionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
  footerText: {
    ...typography.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
});
