import { CheckIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

interface BenefitRow {
  labelKey: string;
  free: boolean;
  premium: boolean;
  id?: string;
}

const BENEFITS: BenefitRow[] = [
  {
    labelKey: "screens.profile.benefits.unlimitedLikes",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.seeWhoLiked",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.priorityLikes",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.unlimitedRewind",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.visibilityControl",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.earlyCheckinWeekly",
    free: false,
    premium: true,
    id: "earlyCheckin",
  },
  {
    labelKey: "screens.profile.benefits.morePlansDaily",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.exploreCities",
    free: false,
    premium: true,
  },
];

export function BenefitsTable() {
  const colors = useThemeColors();
  const { showSubscriptionBonus } = useUserSubscription();

  const filteredBenefits = useMemo(() => {
    return BENEFITS.filter((benefit) => {
      if (benefit.id === "earlyCheckin") {
        return showSubscriptionBonus;
      }
      return true;
    });
  }, [showSubscriptionBonus]);

  return (
    <LinearGradient
      colors={[
        (colors as any).cardGradientStart ?? colors.surface,
        (colors as any).cardGradientEnd ?? colors.surface,
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ThemedText style={[typography.body, { color: colors.text }]}>
        {t("screens.profile.benefits.title")}
      </ThemedText>

      {/* Table Header */}
      <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.tableHeaderCell} />
        <ThemedText
          style={[
            typography.caption,
            {
              color: colors.textSecondary,
              flex: 1,
              textAlign: "center",
            },
          ]}
        >
          {t("screens.profile.benefits.free")}
        </ThemedText>
        <ThemedText
          style={[
            typography.caption,
            { color: colors.accent, flex: 1, textAlign: "center" },
          ]}
        >
          {t("screens.profile.benefits.premium")}
        </ThemedText>
      </View>

      {/* Table Rows */}
      <View style={styles.tableBody}>
        {filteredBenefits.map((benefit) => (
          <View key={benefit.labelKey} style={styles.tableRow}>
            <ThemedText
              style={[typography.caption, { color: colors.text, flex: 2 }]}
            >
              {t(benefit.labelKey)}
            </ThemedText>
            <View style={styles.tableCell}>
              {benefit.free ? (
                <CheckIcon width={16} height={16} color={colors.accent} />
              ) : (
                <View style={styles.iconPlaceholder}>
                  <ThemedText
                    style={[typography.body, { color: colors.textSecondary }]}
                  >
                    —
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={styles.tableCell}>
              {benefit.premium ? (
                <CheckIcon width={16} height={16} color={colors.accent} />
              ) : (
                <View style={styles.iconPlaceholder}>
                  <ThemedText
                    style={[typography.body, { color: colors.textSecondary }]}
                  >
                    —
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  tableHeaderCell: {
    flex: 2,
  },
  tableBody: {
    gap: spacing.xs,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  tableCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPlaceholder: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
