import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { StyleSheet, View } from "react-native";

interface ReferralOverviewCardProps {
  readonly acceptedCount: number;
  readonly nextMilestoneThreshold: number | null;
  readonly totalCreditsEarned: number;
}

export function ReferralOverviewCard({
  acceptedCount,
  nextMilestoneThreshold,
  totalCreditsEarned,
}: ReferralOverviewCardProps) {
  const colors = useThemeColors();

  const progress =
    nextMilestoneThreshold !== null && nextMilestoneThreshold > 0
      ? Math.min(acceptedCount / nextMilestoneThreshold, 1)
      : 1;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {/* Two-column hero stats */}
      <View style={styles.heroRow}>
        {/* Credits earned */}
        <View
          style={[styles.statBox, { backgroundColor: `${colors.accent}10` }]}
        >
          <ThemedText
            style={[
              typography.heading,
              { color: colors.accent, fontSize: 32, lineHeight: 38 },
            ]}
          >
            {totalCreditsEarned}
          </ThemedText>
          <ThemedText
            style={[typography.caption, { color: colors.textSecondary }]}
          >
            {t("referral.hub.overview.creditsEarned")}
          </ThemedText>
        </View>

        {/* Friends accepted */}
        <View style={[styles.statBox, { backgroundColor: `${colors.text}08` }]}>
          <ThemedText
            style={[
              typography.heading,
              { color: colors.text, fontSize: 32, lineHeight: 38 },
            ]}
          >
            {acceptedCount}
          </ThemedText>
          <ThemedText
            style={[typography.caption, { color: colors.textSecondary }]}
          >
            {t("referral.hub.overview.accepted")}
          </ThemedText>
        </View>
      </View>

      {/* Progress toward next reward */}
      {nextMilestoneThreshold !== null && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {t("referral.hub.overview.nextReward")}
            </ThemedText>
            <ThemedText
              style={[
                typography.caption,
                { color: colors.text, fontWeight: "600" },
              ]}
            >
              {acceptedCount}/{nextMilestoneThreshold}
            </ThemedText>
          </View>
          <View
            style={[styles.progressBar, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.accent,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: spacing.lg,
    gap: 2,
  },
  progressSection: {
    gap: spacing.xs,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
