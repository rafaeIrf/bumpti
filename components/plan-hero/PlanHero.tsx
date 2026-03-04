import { ShareIcon } from "@/assets/icons";
import MapPinIcon from "@/assets/icons/map-pin.svg";

import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";

import { ANALYTICS_EVENTS, trackEvent } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { computeExpiresAt, createPlan } from "@/modules/plans/api";
import type { ActivePlan } from "@/modules/plans/hooks";
import { createPlanInvite } from "@/modules/plans/invite";
import { getPeriodLabel } from "@/utils/date";
import { logger } from "@/utils/logger";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";

interface PlanHeroProps {
  plans: ActivePlan[];
  allPlans?: ActivePlan[];
  userHasPlans?: boolean;
  initialIndex?: number;
  onViewPeoplePress?: (plan: ActivePlan) => void;
  defaultConfirmedCount?: number;
  loading?: boolean;
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
  const [sharing, setSharing] = useState(false);
  const [joining, setJoining] = useState(false);

  // Track whether the touch moved horizontally (i.e. was a carousel swipe)
  const touchStartX = useRef<number | null>(null);
  const didScroll = useRef(false);

  // Conditional border radius: first card (left), last card (right)
  const isFirst = cardIndex === 0;
  const isLast = cardIndex === totalPlans - 1;

  // Alternate gradient direction for visual continuity
  const isEven = cardIndex % 2 === 0;
  const gradientStart = isEven ? { x: 0, y: 0 } : { x: 1, y: 1 };
  const gradientEnd = isEven ? { x: 1, y: 1 } : { x: 0, y: 0 };

  const handleCardPress = () => {
    // Suppress press when the user was swiping the carousel
    if (didScroll.current) return;
    // Community plans: card tap is a no-op — use the "Entrar" button instead
    if (!plan.isOwn) return;
    trackEvent(ANALYTICS_EVENTS.HOME.PLAN_HERO_VIBE_CHECK_CLICKED, {});
    Haptics.selectionAsync();
    router.push({
      pathname: "/(modals)/vibe-check",
      params: {
        placeId: plan.placeId,
        placeName: plan.locationName,
        plannedFor: plan.plannedFor,
        planPeriod: t(
          `screens.home.createPlan.period.periodDescriptions.${plan.plannedPeriod}`,
        ),
        // Raw DB key (morning/afternoon/night) used for API calls
        plannedPeriodKey: plan.plannedPeriod ?? "",
      },
    });
  };

  return (
    <Pressable
      onPress={handleCardPress}
      onTouchStart={(e) => {
        touchStartX.current = e.nativeEvent.pageX;
        didScroll.current = false;
      }}
      onTouchEnd={(e) => {
        if (
          touchStartX.current !== null &&
          Math.abs(e.nativeEvent.pageX - touchStartX.current) > 5
        ) {
          didScroll.current = true;
        }
      }}
      style={{ flex: 1 }}
    >
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
        {/* Top-right action buttons */}
        <View style={styles.topRightActions}>
          {/* Share invite — for community plans, auto-join first */}
          <Pressable
            onPress={async (e) => {
              e.stopPropagation();
              if (sharing) return;
              setSharing(true);
              Haptics.selectionAsync();
              try {
                let presenceId = plan.isOwn ? plan.id : null;

                // For community plans, join first to get a presence_id
                if (!plan.isOwn) {
                  const result = await createPlan({
                    placeId: plan.placeId,
                    plannedFor: plan.plannedFor,
                    period: plan.plannedPeriod,
                    expiresAt: computeExpiresAt(
                      plan.plannedFor,
                      plan.plannedPeriod,
                    ),
                  });
                  presenceId = result?.id ?? null;
                }

                if (!presenceId) {
                  setSharing(false);
                  return;
                }

                const inviteUrl = await createPlanInvite(presenceId);
                setSharing(false);
                if (inviteUrl) {
                  const message = t("screens.home.planHero.shareMessage", {
                    placeName: plan.locationName,
                  });
                  await Share.share({
                    message:
                      Platform.OS === "android"
                        ? `${message}\n${inviteUrl}`
                        : message,
                    url: inviteUrl,
                  });
                  trackEvent(ANALYTICS_EVENTS.HOME.PLAN_HERO_SHARE_CLICKED, {
                    placeId: plan.placeId,
                  });
                }
              } catch (err) {
                logger.error("[PlanHero] Share invite error:", err);
                setSharing(false);
              }
            }}
            hitSlop={10}
            style={styles.actionButton}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
            ) : (
              <ShareIcon
                width={20}
                height={20}
                color="rgba(255,255,255,0.85)"
              />
            )}
          </Pressable>
        </View>

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
          {plan.previewAvatars && plan.previewAvatars.length > 0 ? (
            <StackedAvatars
              avatars={plan.previewAvatars}
              maxVisible={3}
              avatarStyle={{ borderColor: "rgba(255,255,255,0.6)" }}
            />
          ) : (
            <ThemedText
              style={[
                typography.caption,
                { color: "rgba(255, 255, 255, 0.75)", flex: 1 },
              ]}
              numberOfLines={1}
            >
              {t("screens.home.planHero.beFirstToConfirm")}
            </ThemedText>
          )}

          <Button
            onPress={async (e: any) => {
              e?.stopPropagation?.();
              if (plan.isOwn) {
                onViewPeople();
              } else {
                // Auto-join the community plan, then open vibe-check
                setJoining(true);
                try {
                  const result = await createPlan({
                    placeId: plan.placeId,
                    plannedFor: plan.plannedFor,
                    period: plan.plannedPeriod,
                    expiresAt: computeExpiresAt(
                      plan.plannedFor,
                      plan.plannedPeriod,
                    ),
                  });
                  if (result) {
                    router.push({
                      pathname: "/(modals)/vibe-check",
                      params: {
                        placeId: plan.placeId,
                        placeName: plan.locationName,
                        plannedFor: plan.plannedFor,
                        planPeriod: t(
                          `screens.home.createPlan.period.periodDescriptions.${plan.plannedPeriod}`,
                        ),
                        // Raw DB key (morning/afternoon/night) used for API calls
                        plannedPeriodKey: plan.plannedPeriod ?? "",
                      },
                    });
                  }
                } finally {
                  setJoining(false);
                }
              }
            }}
            loading={loading || joining}
            style={[
              { backgroundColor: "rgba(255, 255, 255, 0.2)", flexShrink: 0 },
            ]}
            label={
              plan.isOwn
                ? t("screens.home.planHero.activeState.viewPeopleButton")
                : t("screens.home.planHero.activeState.joinCommunityButton")
            }
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
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Empty State Slide (carousel-ready)
// ──────────────────────────────────────────────

function EmptyStateSlide({
  onPress,
  totalCommunityPlans,
  isFirst,
  isLast,
  showDots,
  totalItems,
  currentIndex,
}: {
  onPress: () => void;
  totalCommunityPlans: number;
  isFirst: boolean;
  isLast: boolean;
  showDots: boolean;
  totalItems: number;
  currentIndex: number;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient
        colors={["#E94B7D", "#FF7A5C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
        <ThemedText
          style={[typography.subheading2, styles.title, { color: "#FFFFFF" }]}
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
          {totalCommunityPlans > 0
            ? totalCommunityPlans === 1
              ? t("screens.home.planHero.emptyState.subtitleWithOne", {
                  count: totalCommunityPlans,
                })
              : t("screens.home.planHero.emptyState.subtitleWithPeople", {
                  count: totalCommunityPlans,
                })
            : t("screens.home.planHero.emptyState.subtitle")}
        </ThemedText>

        <View pointerEvents="none">
          <InputText
            value=""
            onChangeText={() => {}}
            placeholder={t("screens.home.planHero.emptyState.locationButton")}
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

        {/* Pagination Dots */}
        {showDots && (
          <View style={styles.dotsContainer}>
            {Array.from({ length: totalItems }).map((_, index) => (
              <PaginationDot
                key={index}
                index={index}
                currentIndex={currentIndex}
              />
            ))}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// PlanHero (main export)
// ──────────────────────────────────────────────

export function PlanHero({
  plans,
  allPlans = [],
  userHasPlans = false,
  initialIndex = 0,
  onViewPeoplePress,
  defaultConfirmedCount = 0,
  loading = false,
}: PlanHeroProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [containerWidth, setContainerWidth] = useState(0);

  // Once the hero has ever shown content (own or community plans), we never
  // hide it during transient empty states (e.g. async fetchAndSetUserPlans
  // fires and flips userHasPlans=true before allPlans has synced).
  // We only hide when BOTH sources are definitively empty.
  const hasEverHadContent = React.useRef(false);

  // Merge: keep backend sort order, swap in user's version where they overlap
  const visiblePlans = React.useMemo(() => {
    const userByKey = new Map(
      plans.map((p) => [`${p.placeId}_${p.plannedFor}_${p.plannedPeriod}`, p]),
    );
    const usedKeys = new Set<string>();

    // Walk feed in backend order; swap in user plan if it exists for that slot
    const merged = allPlans.map((fp) => {
      const key = `${fp.placeId}_${fp.plannedFor}_${fp.plannedPeriod}`;
      const userPlan = userByKey.get(key);
      if (userPlan) {
        usedKeys.add(key);
        // Keep user's plan (isOwn + presence ID) but preserve feed avatars/count
        return {
          ...userPlan,
          previewAvatars: fp.previewAvatars,
          confirmedCount: fp.confirmedCount,
        };
      }
      return fp;
    });

    // Append user plans that weren't in the feed
    for (const [key, p] of userByKey) {
      if (!usedKeys.has(key)) merged.push(p);
    }

    return merged.slice(0, 10);
  }, [plans, allPlans]);

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
        isOwn: plan.isOwn,
      });

      if (plan.plannedFor) {
        // All PlanHero cards (own or community) are planning-type presences.
        // Navigate to the planning-users view filtered by date/period.
        router.push({
          pathname: "/(modals)/place-people",
          params: {
            placeId: plan.placeId,
            placeName: plan.locationName,
            plannedFor: plan.plannedFor,
            plannedPeriod: plan.plannedPeriod ?? "",
          },
        });
        return;
      }

      // Fallback for check-in plans (no plannedFor) — delegates to parent
      onViewPeoplePress?.(plan);
    },
    [onViewPeoplePress, router],
  );

  const totalCommunityPlans = visiblePlans
    .filter((p) => !p.isOwn)
    .reduce((sum, p) => sum + (p.confirmedCount ?? 0), 0);

  const hasPlans = visiblePlans.length > 0;

  // Mark once we've ever had displayable content
  if (hasPlans || allPlans.length > 0 || !userHasPlans) {
    hasEverHadContent.current = true;
  }
  // Reset only when truly nothing exists anymore
  if (plans.length === 0 && allPlans.length === 0) {
    hasEverHadContent.current = false;
  }

  const showEmptyFirst = !userHasPlans || (userHasPlans && !hasPlans);

  return (
    <Animated.View
      entering={FadeInDown.delay(150).springify().damping(20).mass(0.8)}
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {(hasPlans || showEmptyFirst || hasEverHadContent.current) &&
      containerWidth > 0 ? (
        <>
          <Carousel
            loop={false}
            width={containerWidth}
            height={160}
            data={showEmptyFirst ? [null, ...visiblePlans] : visiblePlans}
            defaultIndex={0}
            scrollAnimationDuration={300}
            overscrollEnabled={false}
            onProgressChange={(_, absoluteProgress) => {
              const newIndex = Math.round(absoluteProgress);
              const total = showEmptyFirst
                ? visiblePlans.length + 1
                : visiblePlans.length;
              if (
                newIndex !== currentIndex &&
                newIndex >= 0 &&
                newIndex < total
              ) {
                setCurrentIndex(newIndex);
              }
            }}
            renderItem={({ item, index }) => {
              // Empty-state card when user has no plans (first item)
              if (item === null) {
                return (
                  <EmptyStateSlide
                    onPress={handleLocationPress}
                    totalCommunityPlans={totalCommunityPlans}
                    isFirst
                    isLast={visiblePlans.length === 0}
                    showDots={visiblePlans.length > 0}
                    totalItems={visiblePlans.length + 1}
                    currentIndex={currentIndex}
                  />
                );
              }
              const adjustedIndex = showEmptyFirst ? index : index;
              const totalItems = showEmptyFirst
                ? visiblePlans.length + 1
                : visiblePlans.length;
              return (
                <PlanCard
                  plan={item}
                  onViewPeople={() => handleViewPeoplePress(item)}
                  loading={loading}
                  showDots={totalItems > 1}
                  totalPlans={totalItems}
                  currentIndex={currentIndex}
                  cardIndex={adjustedIndex}
                />
              );
            }}
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
        /* Empty state — no plans at all, not even community */
        <EmptyStateSlide
          onPress={handleLocationPress}
          totalCommunityPlans={0}
          isFirst
          isLast
          showDots={false}
          totalItems={1}
          currentIndex={0}
        />
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
  topRightActions: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionButton: {
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
  confirmedBadge: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 100,
    zIndex: 5,
  },
});
