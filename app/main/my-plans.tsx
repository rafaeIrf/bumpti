import {
  ArrowLeftIcon,
  MapPinIcon,
  PlusIcon,
  UsersIcon,
  XIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { GenericConfirmationBottomSheet } from "@/components/generic-confirmation-bottom-sheet";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { spacing, typography } from "@/constants/theme";
import { usePlaceClick } from "@/hooks/use-place-click";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ANALYTICS_EVENTS,
  trackEvent,
  useScreenTracking,
} from "@/modules/analytics";
import { useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { deletePlan, fetchAndSetUserPlans } from "@/modules/plans/api";
import { useUserPlans } from "@/modules/plans/hooks";
import type { PlanPeriod, UserPlan } from "@/modules/plans/types";
import { logger } from "@/utils/logger";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodLabel(planned_for: string, period: PlanPeriod): string {
  const today = new Date().toISOString().split("T")[0];
  const isToday = planned_for === today;

  const periodKey =
    period === "morning"
      ? isToday
        ? "todayMorning"
        : "tomorrowMorning"
      : period === "afternoon"
        ? isToday
          ? "todayAfternoon"
          : "tomorrowAfternoon"
        : isToday
          ? "todayNight"
          : "tomorrowNight";

  return t(`screens.home.planHero.periodLabels.${periodKey}`);
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MyPlansScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const bottomSheet = useCustomBottomSheet();
  const { handlePlaceClick } = usePlaceClick();
  const { plans, loading: plansLoading } = useUserPlans();
  const { isPremium } = useUserSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  // ── Screen tracking ──────────────────────────────────────────────
  useScreenTracking({ screenName: "my_plans" });

  // ── Daily limit check ─────────────────────────────────────────────
  const getTodayPlansCount = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return plans.filter((p) => p.planned_for === today).length;
  }, [plans]);

  const handleCreatePlan = useCallback(() => {
    const todayCount = getTodayPlansCount();
    logger.log("[MyPlans] Today plan count:", todayCount);
    const dailyLimit = isPremium ? 10 : 2;

    trackEvent(ANALYTICS_EVENTS.MY_PLANS.CREATE_TAPPED, {
      todayPlansCount: todayCount,
      isPremium,
    });

    if (todayCount >= dailyLimit) {
      if (!isPremium) {
        // Free user hit limit → show paywall
        router.push("/(modals)/premium-paywall");
      } else {
        // Premium user hit limit → show alert
        Alert.alert(
          t("screens.home.myPlans.dailyLimitReached", { limit: dailyLimit }),
          t("screens.home.myPlans.upgradeForMore"),
          [{ text: t("common.ok"), style: "default" }],
        );
      }
    } else {
      // Within limit → proceed to create plan
      router.push("/(modals)/create-plan");
    }
  }, [getTodayPlansCount, isPremium, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAndSetUserPlans();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleDeletePlan = useCallback(
    (plan: UserPlan) => {
      if (!bottomSheet) return;

      bottomSheet.expand({
        content: () => (
          <GenericConfirmationBottomSheet
            icon={XIcon}
            title={t("screens.home.myPlans.deleteConfirmTitle")}
            description={t("screens.home.myPlans.deleteConfirmDescription")}
            primaryButton={{
              text: t("screens.home.myPlans.deleteConfirmButton"),
              variant: "danger",
              loading: deletingPlanId === plan.id,
              onClick: async () => {
                setDeletingPlanId(plan.id);

                // Re-render with loading state
                bottomSheet.expand({
                  content: () => (
                    <GenericConfirmationBottomSheet
                      icon={XIcon}
                      title={t("screens.home.myPlans.deleteConfirmTitle")}
                      description={t(
                        "screens.home.myPlans.deleteConfirmDescription",
                      )}
                      primaryButton={{
                        text: t("screens.home.myPlans.deleteConfirmButton"),
                        variant: "danger",
                        loading: true,
                        onClick: () => {},
                      }}
                      secondaryButton={{
                        text: t("common.cancel"),
                        variant: "secondary",
                        onClick: () => bottomSheet.close(),
                      }}
                      onClose={() => bottomSheet.close()}
                    />
                  ),
                });

                try {
                  const success = await deletePlan(plan.id);
                  if (success) {
                    trackEvent(ANALYTICS_EVENTS.MY_PLANS.DELETE_CONFIRMED, {});
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  }
                  bottomSheet.close();
                } catch (err) {
                  logger.error("[MyPlans] Delete error:", err);
                  bottomSheet.close();
                } finally {
                  setDeletingPlanId(null);
                }
              },
            }}
            secondaryButton={{
              text: t("common.cancel"),
              variant: "secondary",
              onClick: () => bottomSheet.close(),
            }}
            onClose={() => bottomSheet.close()}
          />
        ),
      });
    },
    [bottomSheet, deletingPlanId],
  );

  const handleViewPeople = useCallback(
    async (plan: UserPlan) => {
      await handlePlaceClick({
        placeId: plan.place_id,
        name: plan.place_name || undefined,
        latitude: 0,
        longitude: 0,
      });
    },
    [handlePlaceClick],
  );

  const handlePlanPress = useCallback(
    (plan: UserPlan) => {
      if (!bottomSheet) return;

      trackEvent(ANALYTICS_EVENTS.MY_PLANS.CARD_TAPPED, {
        activeUsers: plan.active_users,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      bottomSheet.expand({
        content: () => (
          <View style={[styles.sheetContainer, { paddingBottom: spacing.xxl }]}>
            {/* Close button */}
            <Pressable
              onPress={() => bottomSheet.close()}
              style={styles.sheetCloseButton}
              hitSlop={8}
            >
              <XIcon width={24} height={24} color={colors.textSecondary} />
            </Pressable>

            {/* Plan info */}
            <View
              style={[
                styles.sheetIconContainer,
                { backgroundColor: `${colors.accent}15` },
              ]}
            >
              <MapPinIcon width={28} height={28} color={colors.accent} />
            </View>

            <ThemedText
              style={[
                styles.sheetTitle,
                typography.heading,
                { color: colors.text },
              ]}
            >
              {plan.place_name || "—"}
            </ThemedText>

            <ThemedText
              style={[
                styles.sheetSubtitle,
                typography.body,
                { color: colors.textSecondary },
              ]}
            >
              {getPeriodLabel(plan.planned_for, plan.planned_period)}
            </ThemedText>

            {plan.active_users > 0 && (
              <View
                style={[
                  styles.sheetBadge,
                  { backgroundColor: `${colors.accent}15` },
                ]}
              >
                <ThemedText
                  style={[typography.caption, { color: colors.accent }]}
                >
                  {t("screens.home.myPlans.activeUsers", {
                    count: plan.active_users,
                  })}
                </ThemedText>
              </View>
            )}

            {/* Actions */}
            <View style={styles.sheetActions}>
              <Button
                onPress={() => {
                  trackEvent(ANALYTICS_EVENTS.MY_PLANS.ENTER_TAPPED, {
                    activeUsers: plan.active_users,
                  });
                  bottomSheet.close();
                  handleViewPeople(plan);
                }}
                variant="default"
                size="lg"
                fullWidth
                label={t("screens.home.myPlans.viewPeople")}
              />
              <Button
                onPress={() => {
                  trackEvent(ANALYTICS_EVENTS.MY_PLANS.DELETE_TAPPED, {});
                  handleDeletePlan(plan);
                }}
                variant="ghost"
                size="lg"
                fullWidth
                label={t("screens.home.myPlans.deletePlan")}
                textStyle={{ color: colors.error }}
              />
            </View>
          </View>
        ),
        draggable: true,
      });
    },
    [bottomSheet, colors, handleDeletePlan, handleViewPeople],
  );

  const renderPlanCard = useCallback(
    ({ item, index }: { item: UserPlan; index: number }) => (
      <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
        <Pressable
          onPress={() => handlePlanPress(item)}
          style={({ pressed }) => [
            styles.planCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.planCardContent}>
            {/* Location icon */}
            <View
              style={[
                styles.planCardIcon,
                { backgroundColor: `${colors.accent}15` },
              ]}
            >
              <MapPinIcon width={20} height={20} color={colors.accent} />
            </View>

            {/* Info */}
            <View style={styles.planCardInfo}>
              <ThemedText
                style={[typography.body, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.place_name || "—"}
              </ThemedText>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {getPeriodLabel(item.planned_for, item.planned_period)}
              </ThemedText>
            </View>

            {/* People badge */}
            {item.active_users > 0 && (
              <Chip
                label={String(item.active_users)}
                icon={
                  <UsersIcon width={12} height={12} color={colors.accent} />
                }
                variant="filled"
                size="sm"
              />
            )}
          </View>
        </Pressable>
      </Animated.View>
    ),
    [colors, handlePlanPress],
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIconContainer,
            { backgroundColor: `${colors.accent}10` },
          ]}
        >
          <MapPinIcon width={40} height={40} color={colors.accent} />
        </View>
        <ThemedText
          style={[
            typography.subheading,
            styles.emptyTitle,
            { color: colors.text },
          ]}
        >
          {t("screens.home.myPlans.emptyTitle")}
        </ThemedText>
        <ThemedText
          style={[
            typography.body,
            styles.emptyDescription,
            { color: colors.textSecondary },
          ]}
        >
          {t("screens.home.myPlans.emptyDescription")}
        </ThemedText>
        <Button
          onPress={handleCreatePlan}
          variant="default"
          size="lg"
          label={t("screens.home.myPlans.createPlan")}
          style={styles.emptyCta}
        />
      </View>
    ),
    [colors, router, handleCreatePlan],
  );

  const TopHeader = (
    <ScreenToolbar
      title={t("screens.home.myPlans.title")}
      leftAction={{
        icon: ArrowLeftIcon,
        onClick: () => router.back(),
        ariaLabel: t("common.close") || "Close",
      }}
    />
  );

  if (plansLoading && plans.length === 0) {
    return (
      <BaseTemplateScreen TopHeader={TopHeader}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </BaseTemplateScreen>
    );
  }

  return (
    <BaseTemplateScreen
      TopHeader={TopHeader}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      BottomBar={
        plans.length > 0 ? (
          <ScreenBottomBar variant="custom" style={styles.fabBar}>
            <Button
              onPress={handleCreatePlan}
              variant="default"
              size="fab"
              leftIcon={PlusIcon}
            />
          </ScreenBottomBar>
        ) : undefined
      }
    >
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={renderPlanCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={false}
      />
    </BaseTemplateScreen>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  listContent: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
  },
  planCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  planCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  planCardInfo: {
    flex: 1,
    gap: 2,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: spacing.lg,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  emptyCta: {
    minWidth: 200,
  },
  fabBar: {
    alignItems: "flex-end",
    borderTopWidth: 0,
    marginBottom: spacing.xl,
  },

  // ── Bottom Sheet ──────────────────────────────────────────────────────────
  sheetContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: "center",
    position: "relative",
  },
  sheetCloseButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  sheetTitle: {
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  sheetBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 100,
    marginBottom: spacing.lg,
  },
  sheetActions: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
