import { CircleCheckIcon, SparklesIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import type { Milestone, RecurringReward } from "@/modules/referral/hooks";
import React from "react";
import { StyleSheet, View } from "react-native";

interface ReferralMilestonesListProps {
  readonly milestones: Milestone[];
  readonly currentCount: number;
  readonly recurring: RecurringReward | null;
}

export function ReferralMilestonesList({
  milestones,
  currentCount,
  recurring,
}: ReferralMilestonesListProps) {
  const colors = useThemeColors();

  const allMilestonesAchieved = milestones.every((m) => m.achieved);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ThemedText
        style={[typography.body, { color: colors.text, fontWeight: "600" }]}
      >
        {t("referral.hub.milestones.title")}
      </ThemedText>

      <View style={styles.list}>
        {milestones.map((milestone, index) => {
          const showConnector =
            index < milestones.length - 1 ||
            (allMilestonesAchieved && recurring);

          return (
            <View key={milestone.threshold}>
              <View style={styles.milestoneRow}>
                {/* Status icon */}
                <View style={styles.iconColumn}>
                  {milestone.achieved ? (
                    <CircleCheckIcon
                      width={22}
                      height={22}
                      color={colors.accent}
                    />
                  ) : (
                    <View
                      style={[
                        styles.emptyCircle,
                        {
                          borderColor:
                            currentCount > 0 && !milestone.achieved
                              ? colors.textSecondary
                              : colors.border,
                        },
                      ]}
                    />
                  )}
                  {showConnector && (
                    <View
                      style={[
                        styles.connector,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                </View>

                {/* Content */}
                <View style={styles.content}>
                  <View style={styles.milestoneHeader}>
                    <ThemedText
                      style={[
                        typography.body,
                        {
                          color: milestone.achieved
                            ? colors.text
                            : colors.textSecondary,
                          fontWeight: milestone.achieved ? "600" : "400",
                        },
                      ]}
                    >
                      {t("referral.hub.milestones.threshold", {
                        count: milestone.threshold,
                      })}
                    </ThemedText>

                    <View
                      style={[
                        styles.rewardBadge,
                        {
                          backgroundColor: milestone.achieved
                            ? `${colors.accent}20`
                            : `${colors.textSecondary}15`,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          typography.caption,
                          {
                            color: milestone.achieved
                              ? colors.accent
                              : colors.textSecondary,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {t(
                          milestone.reward === 1
                            ? "referral.hub.milestones.reward"
                            : "referral.hub.milestones.reward_plural",
                          { count: milestone.reward },
                        )}
                      </ThemedText>
                    </View>
                  </View>

                  {!milestone.achieved && (
                    <ThemedText
                      style={[
                        typography.caption,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("referral.hub.milestones.progress", {
                        current: currentCount,
                        threshold: milestone.threshold,
                      })}
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* Recurring reward row */}
        {allMilestonesAchieved && recurring && (
          <View style={styles.milestoneRow}>
            <View style={styles.iconColumn}>
              <View
                style={[
                  styles.recurringIcon,
                  { backgroundColor: `${colors.accent}15` },
                ]}
              >
                <SparklesIcon width={14} height={14} color={colors.accent} />
              </View>
            </View>

            <View style={styles.content}>
              <View style={styles.milestoneHeader}>
                <ThemedText
                  style={[
                    typography.body,
                    { color: colors.accent, fontWeight: "600" },
                  ]}
                >
                  {t("referral.hub.milestones.recurring", {
                    interval: recurring.interval,
                  })}
                </ThemedText>

                <View
                  style={[
                    styles.rewardBadge,
                    { backgroundColor: `${colors.accent}20` },
                  ]}
                >
                  <ThemedText
                    style={[
                      typography.caption,
                      { color: colors.accent, fontWeight: "600" },
                    ]}
                  >
                    {t(
                      recurring.credits === 1
                        ? "referral.hub.milestones.reward"
                        : "referral.hub.milestones.reward_plural",
                      { count: recurring.credits },
                    )}
                  </ThemedText>
                </View>
              </View>

              {recurring.timesEarned > 0 && (
                <ThemedText
                  style={[typography.caption, { color: colors.textSecondary }]}
                >
                  {t("referral.hub.milestones.recurringEarned", {
                    count: recurring.timesEarned,
                  })}
                </ThemedText>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  list: {
    gap: 0,
  },
  milestoneRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  iconColumn: {
    alignItems: "center",
    width: 22,
  },
  connector: {
    width: 2,
    flex: 1,
    marginVertical: spacing.xs,
    borderRadius: 1,
  },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  recurringIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.lg,
  },
  milestoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.md,
  },
});
