import { MapPinIcon, PlusIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Chip } from "@/components/ui/chip";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

interface CheckinCreditsCardProps {
  readonly credits: number;
  readonly onPurchase: () => void;
}

export function CheckinCreditsCard({
  credits,
  onPurchase,
}: CheckinCreditsCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPurchase}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Icon */}
      <BrandIcon icon={MapPinIcon} size="sm" />

      {/* Title */}
      <ThemedText style={[typography.body, { color: colors.text, flex: 1 }]}>
        {t("screens.profile.earlyCheckin.title")}
      </ThemedText>

      {/* Credits Badge or Plus Icon */}
      {credits > 0 ? (
        <Chip
          label={String(credits)}
          color={colors.accent}
          variant="filled"
          size="md"
        />
      ) : (
        <PlusIcon width={20} height={20} color={colors.accent} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  creditsBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
});
