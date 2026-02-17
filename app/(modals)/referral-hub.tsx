import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ReferralMilestonesList } from "@/components/referral-milestones-list";
import { ReferralOverviewCard } from "@/components/referral-overview-card";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useGetReferralStatsQuery } from "@/modules/referral/hooks";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function ReferralHubScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { data, isLoading, error } = useGetReferralStatsQuery();

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <BaseTemplateScreen
        isModal
        TopHeader={
          <ScreenToolbar
            title={t("referral.hub.title")}
            rightActions={{
              icon: XIcon,
              onClick: handleBack,
              ariaLabel: t("common.close"),
            }}
          />
        }
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </BaseTemplateScreen>
    );
  }

  if (error || !data) {
    return (
      <BaseTemplateScreen
        TopHeader={
          <ScreenToolbar
            title={t("referral.hub.title")}
            rightActions={{
              icon: XIcon,
              onClick: handleBack,
              ariaLabel: t("common.close"),
            }}
          />
        }
      >
        <View style={styles.errorContainer}>
          <ThemedText
            style={[typography.body, { color: colors.textSecondary }]}
          >
            {t("common.error")}
          </ThemedText>
        </View>
      </BaseTemplateScreen>
    );
  }

  const { totalCreditsEarned, types } = data;
  const planInviteData = types.planInvite;

  // Fallback milestones when API returns empty (all show as not achieved)
  const DEFAULT_MILESTONES = [
    { threshold: 3, reward: 1, achieved: false },
    { threshold: 7, reward: 2, achieved: false },
    { threshold: 15, reward: 3, achieved: false },
  ];
  const displayMilestones =
    planInviteData.milestones.length > 0
      ? planInviteData.milestones
      : DEFAULT_MILESTONES;

  // Determine next target: next unachieved milestone, or next recurring threshold
  const nextFixedMilestone = displayMilestones.find((m) => !m.achieved);
  const nextTarget = nextFixedMilestone
    ? nextFixedMilestone.threshold
    : (planInviteData.recurring?.nextAt ?? null);

  return (
    <BaseTemplateScreen
      isModal
      TopHeader={
        <ScreenToolbar
          title={t("referral.hub.title")}
          rightActions={{
            icon: XIcon,
            onClick: handleBack,
            ariaLabel: t("common.close"),
          }}
        />
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <ReferralOverviewCard
            acceptedCount={planInviteData.acceptedCount}
            nextMilestoneThreshold={nextTarget}
            totalCreditsEarned={totalCreditsEarned}
          />
        </Animated.View>

        {/* Milestones — always visible */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <ReferralMilestonesList
            milestones={displayMilestones}
            currentCount={planInviteData.acceptedCount}
            recurring={planInviteData.recurring}
          />
        </Animated.View>

        {/* How It Works */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={[styles.section, { backgroundColor: colors.surface }]}
        >
          <ThemedText
            style={[typography.body, { color: colors.text, fontWeight: "600" }]}
          >
            {t("referral.hub.howItWorks.title")}
          </ThemedText>

          <View style={styles.stepsList}>
            {[1, 2, 3].map((step) => (
              <View key={step} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepNumber,
                    { backgroundColor: `${colors.accent}15` },
                  ]}
                >
                  <ThemedText
                    style={[
                      typography.caption,
                      { color: colors.accent, fontWeight: "700" },
                    ]}
                  >
                    {step}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, flex: 1 },
                  ]}
                >
                  {t(`referral.hub.howItWorks.step${step}`)}
                </ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  scrollContent: {
    gap: spacing.md,
  },
  section: {
    borderRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  stepsList: {
    gap: spacing.sm,
  },
  stepItem: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
