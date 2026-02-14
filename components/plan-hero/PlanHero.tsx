import MapPinIcon from "@/assets/icons/map-pin.svg";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";

import { ANALYTICS_EVENTS, trackEvent } from "@/modules/analytics";
import { t } from "@/modules/locales";
import type { PlanPeriod } from "@/modules/plans/types";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export interface ActivePlan {
  id: string;
  placeId: string;
  locationName: string;
  confirmedCount: number;
  plannedFor: string; // YYYY-MM-DD
  plannedPeriod: PlanPeriod;
}

interface PlanHeroProps {
  activePlan?: ActivePlan | null;
  onViewPeoplePress?: () => void;
  defaultConfirmedCount?: number;
  loading?: boolean;
}

function getPeriodLabel(plannedFor: string, period: PlanPeriod): string {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const isToday = plannedFor === today;
  const isTomorrow = plannedFor === tomorrow;

  if (isToday) {
    if (period === "morning")
      return t("screens.home.planHero.periodLabels.todayMorning");
    if (period === "afternoon")
      return t("screens.home.planHero.periodLabels.todayAfternoon");
    return t("screens.home.planHero.periodLabels.todayNight");
  }

  if (isTomorrow) {
    if (period === "morning")
      return t("screens.home.planHero.periodLabels.tomorrowMorning");
    if (period === "afternoon")
      return t("screens.home.planHero.periodLabels.tomorrowAfternoon");
    return t("screens.home.planHero.periodLabels.tomorrowNight");
  }

  // Fallback for future dates beyond tomorrow
  return plannedFor;
}

export function PlanHero({
  activePlan,
  onViewPeoplePress,
  defaultConfirmedCount = 10,
  loading = false,
}: PlanHeroProps) {
  const router = useRouter();

  const handleLocationPress = () => {
    Haptics.selectionAsync();
    trackEvent(ANALYTICS_EVENTS.HOME.PLAN_HERO_LOCATION_CLICKED, {});
    router.push("/(modals)/create-plan");
  };

  const handleViewPeoplePress = () => {
    Haptics.selectionAsync();
    trackEvent(ANALYTICS_EVENTS.HOME.PLAN_HERO_VIEW_PEOPLE_CLICKED, {
      planId: activePlan?.id || "",
    });
    onViewPeoplePress?.();
  };

  const confirmedCount = activePlan?.confirmedCount ?? defaultConfirmedCount;

  return (
    <Animated.View
      entering={FadeInDown.delay(150).springify().damping(20).mass(0.8)}
      style={styles.container}
    >
      {activePlan ? (
        <LinearGradient
          colors={["#E94B7D", "#FF7A5C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Active Plan State */}
          <>
            <ThemedText
              style={[
                typography.body1,
                styles.activeTitle,
                { color: "#FFFFFF" },
              ]}
            >
              {t("screens.home.planHero.activeState.title")}
            </ThemedText>

            <View style={styles.locationRow}>
              <MapPinIcon width={16} height={16} color="#FFFFFF" />
              <ThemedText
                style={[
                  typography.body,
                  styles.locationName,
                  { color: "#FFFFFF" },
                ]}
                numberOfLines={1}
              >
                {activePlan.locationName}
              </ThemedText>
            </View>

            <ThemedText
              style={[
                typography.caption,
                styles.periodLabel,
                { color: "rgba(255, 255, 255, 0.9)" },
              ]}
            >
              {getPeriodLabel(activePlan.plannedFor, activePlan.plannedPeriod)}
            </ThemedText>

            <View style={styles.activePlanFooter}>
              <ThemedText
                style={[
                  typography.caption,
                  styles.confirmedText,
                  { color: "#FFFFFF" },
                ]}
              >
                {t("screens.home.planHero.confirmedToday", {
                  count: confirmedCount,
                })}
              </ThemedText>

              {confirmedCount >= 1 && (
                <Button
                  onPress={handleViewPeoplePress}
                  loading={loading}
                  style={[
                    {
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                    },
                  ]}
                  label={t(
                    "screens.home.planHero.activeState.viewPeopleButton",
                  )}
                  textStyle={[typography.caption, { color: "#FFFFFF" }]}
                />
              )}
            </View>
          </>
        </LinearGradient>
      ) : (
        <Pressable onPress={handleLocationPress}>
          <LinearGradient
            colors={["#E94B7D", "#FF7A5C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <ThemedText
              style={[
                typography.subheading2,
                styles.title,
                { color: "#FFFFFF" },
              ]}
            >
              {t("screens.home.planHero.emptyState.title")}
            </ThemedText>

            <ThemedText
              style={[
                typography.caption,
                styles.subtitle,
                { color: "rgba(255, 255, 255, 0.85)" },
              ]}
            >
              {t("screens.home.planHero.emptyState.subtitle")}
            </ThemedText>

            <InputText
              value=""
              onChangeText={() => {}}
              placeholder={t("screens.home.planHero.emptyState.locationButton")}
              editable={false}
              pointerEvents="none"
              leftIcon={MapPinIcon}
              leftIconColor="rgba(255, 255, 255, 0.8)"
              showClearButton={false}
              containerStyle={{ flex: 0, marginBottom: spacing.sm }}
              inputStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.25)",
                borderColor: "transparent",
                color: "#FFFFFF",
              }}
              placeholderTextColor="rgba(255, 255, 255, 0.8)"
            />

            <ThemedText
              style={[
                typography.caption,
                styles.confirmedText,
                { color: "#FFFFFF" },
              ]}
            >
              {t("screens.home.planHero.confirmedToday", {
                count: confirmedCount,
              })}
            </ThemedText>
          </LinearGradient>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.lg,
    overflow: "hidden",
  },
  gradient: {
    padding: spacing.md,
    minHeight: 140,
    justifyContent: "space-between",
  },
  // Empty state styles
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  confirmedText: {
    opacity: 0.9,
  },
  // Active plan state styles
  activeTitle: {
    marginBottom: spacing.xs,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  locationName: {
    fontStyle: "italic",
    flex: 1,
  },
  periodLabel: {
    marginBottom: spacing.md,
  },
  activePlanFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  viewPeopleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 36,
  },
});
