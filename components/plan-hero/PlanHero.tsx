import MapPinIcon from "@/assets/icons/map-pin.svg";
import SettingsIcon from "@/assets/icons/settings.svg";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";

import { ANALYTICS_EVENTS, trackEvent } from "@/modules/analytics";
import { t } from "@/modules/locales";
import type { ActivePlan } from "@/modules/plans/hooks";
import type { PlanPeriod } from "@/modules/plans/types";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";

interface PlanHeroProps {
  plans: ActivePlan[];
  initialIndex?: number;
  onViewPeoplePress?: (plan: ActivePlan) => void;
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

  return plannedFor;
}

// ──────────────────────────────────────────────
// Pagination Dot (matches intro-carousel pattern)
// ──────────────────────────────────────────────

function PaginationDot({
  index,
  currentIndex,
}: {
  index: number;
  currentIndex: number;
}) {
  const dotAnimStyle = useAnimatedStyle(() => {
    const inputRange = [index - 1, index, index + 1];

    const width = interpolate(
      currentIndex,
      inputRange,
      [6, 18, 6],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      currentIndex,
      inputRange,
      [0.35, 1, 0.35],
      Extrapolation.CLAMP,
    );

    return { width, opacity };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        dotAnimStyle,
        {
          backgroundColor:
            index === currentIndex ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)",
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────────
// Plan Card (single carousel slide)
// ──────────────────────────────────────────────

function PlanCard({
  plan,
  onViewPeople,
  loading,
  showDots,
  totalPlans,
  currentIndex,
  cardIndex,
}: {
  plan: ActivePlan;
  onViewPeople: () => void;
  loading: boolean;
  showDots: boolean;
  totalPlans: number;
  currentIndex: number;
  cardIndex: number;
}) {
  const router = useRouter();
  const confirmedCount = plan.confirmedCount;

  // Conditional border radius: first card (left), last card (right)
  const isFirst = cardIndex === 0;
  const isLast = cardIndex === totalPlans - 1;

  // Alternate gradient direction for visual continuity
  const isEven = cardIndex % 2 === 0;
  const gradientStart = isEven ? { x: 0, y: 0 } : { x: 1, y: 1 };
  const gradientEnd = isEven ? { x: 1, y: 1 } : { x: 0, y: 0 };

  return (
    <LinearGradient
      colors={["#E94B7D", "#FF7A5C"]}
      start={gradientStart}
      end={gradientEnd}
      style={[
        styles.gradient,
        isFirst && {
          borderTopLeftRadius: spacing.lg,
          borderBottomLeftRadius: spacing.lg,
        },
        isLast && {
          borderTopRightRadius: spacing.lg,
          borderBottomRightRadius: spacing.lg,
        },
      ]}
    >
      {/* Settings icon (top-right) */}
      <Pressable
        onPress={() => {
          trackEvent(ANALYTICS_EVENTS.HOME.PLAN_HERO_SETTINGS_CLICKED, {
            activePlansCount: totalPlans,
          });
          Haptics.selectionAsync();
          router.push("/main/my-plans");
        }}
        hitSlop={10}
        style={styles.settingsButton}
      >
        <SettingsIcon width={20} height={20} color="rgba(255,255,255,0.85)" />
      </Pressable>

      <ThemedText
        style={[typography.body1, styles.activeTitle, { color: "#FFFFFF" }]}
      >
        {getPeriodLabel(plan.plannedFor, plan.plannedPeriod)}
      </ThemedText>

      <View style={styles.locationRow}>
        <MapPinIcon width={16} height={16} color="rgba(255,255,255,0.9)" />
        <ThemedText
          style={[
            typography.body,
            styles.locationName,
            { color: "rgba(255,255,255,0.9)" },
          ]}
          numberOfLines={1}
        >
          {plan.locationName}
        </ThemedText>
      </View>

      <View style={styles.activePlanFooter}>
        <ThemedText
          style={[
            typography.caption,
            styles.confirmedText,
            { color: "#FFFFFF" },
          ]}
        >
          {confirmedCount > 0
            ? t("screens.home.planHero.confirmedToday", {
                count: confirmedCount,
              })
            : t("screens.home.planHero.beFirstToConfirm")}
        </ThemedText>

        <Button
          onPress={onViewPeople}
          loading={loading}
          style={[{ backgroundColor: "rgba(255, 255, 255, 0.2)" }]}
          label={t("screens.home.planHero.activeState.viewPeopleButton")}
          textStyle={[typography.caption, { color: "#FFFFFF" }]}
        />
      </View>

      {/* Pagination Dots inside the card */}
      {showDots && (
        <View style={styles.dotsContainer}>
          {Array.from({ length: totalPlans }).map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              currentIndex={currentIndex}
            />
          ))}
        </View>
      )}
    </LinearGradient>
  );
}

// ──────────────────────────────────────────────
// PlanHero (main export)
// ──────────────────────────────────────────────

export function PlanHero({
  plans,
  initialIndex = 0,
  onViewPeoplePress,
  defaultConfirmedCount = 10,
  loading = false,
}: PlanHeroProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLocationPress = () => {
    Haptics.selectionAsync();
    trackEvent(ANALYTICS_EVENTS.HOME.PLAN_HERO_LOCATION_CLICKED, {});
    router.push("/(modals)/create-plan");
  };

  const handleViewPeoplePress = useCallback(
    (plan: ActivePlan) => {
      Haptics.selectionAsync();
      trackEvent(ANALYTICS_EVENTS.HOME.PLAN_HERO_ENTER_CLICKED, {
        planId: plan.id,
      });
      onViewPeoplePress?.(plan);
    },
    [onViewPeoplePress],
  );

  const confirmedCount =
    plans[currentIndex]?.confirmedCount ?? defaultConfirmedCount;

  const hasPlans = plans.length > 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(150).springify().damping(20).mass(0.8)}
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {hasPlans && containerWidth > 0 ? (
        <>
          <Carousel
            loop={false}
            width={containerWidth}
            height={160}
            data={plans}
            defaultIndex={initialIndex}
            scrollAnimationDuration={300}
            overscrollEnabled={false}
            onProgressChange={(_, absoluteProgress) => {
              const newIndex = Math.round(absoluteProgress);
              if (
                newIndex !== currentIndex &&
                newIndex >= 0 &&
                newIndex < plans.length
              ) {
                setCurrentIndex(newIndex);
              }
            }}
            renderItem={({ item, index }) => (
              <PlanCard
                plan={item}
                onViewPeople={() => handleViewPeoplePress(item)}
                loading={loading}
                showDots={plans.length > 1}
                totalPlans={plans.length}
                currentIndex={currentIndex}
                cardIndex={index}
              />
            )}
          />
        </>
      ) : hasPlans ? (
        /* Placeholder while measuring width */
        <LinearGradient
          colors={["#E94B7D", "#FF7A5C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { minHeight: 160 }]}
        />
      ) : (
        /* Empty state */
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

            <View pointerEvents="none">
              <InputText
                value=""
                onChangeText={() => {}}
                placeholder={t(
                  "screens.home.planHero.emptyState.locationButton",
                )}
                editable={false}
                autoFocus={false}
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
            </View>

            {confirmedCount > 0 && (
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
            )}
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
    marginTop: spacing.md,
  },
  gradient: {
    flex: 1,
    padding: spacing.md,
    minHeight: 140,
    justifyContent: "space-between",
  },
  settingsButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
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
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  viewPeopleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 36,
  },
  // Dots
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
