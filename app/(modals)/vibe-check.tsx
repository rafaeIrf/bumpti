import {
  ArrowRightIcon,
  FlameIcon,
  HeartIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { ALL_INTERESTS } from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { usePlaceClick } from "@/hooks/use-place-click";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { trackEvent } from "@/modules/analytics";
import { ANALYTICS_EVENTS } from "@/modules/analytics/analytics-events";
import { t } from "@/modules/locales";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

// ── Types ─────────────────────────────────────────────────────────────
type CommonInterest = {
  key: string;
  count: number;
};

type VibeCheckData = {
  planning_count: number;
  recent_count: number;
  common_interests: CommonInterest[];
  matches_going: number;
};

// ── Helpers ───────────────────────────────────────────────────────────
function getInterestIcon(key: string): string {
  const interest = ALL_INTERESTS.find((i) => i.key === key);
  return interest?.icon ?? "✨";
}

function getInterestLabel(key: string): string {
  return t(`screens.onboarding.interests.items.${key}` as any);
}

// ── Component ─────────────────────────────────────────────────────────
export default function VibeCheckScreen() {
  const { placeId, placeName, planPeriod } = useLocalSearchParams<{
    placeId: string;
    placeName: string;
    planPeriod?: string;
  }>();
  const colors = useThemeColors();
  const { handlePlaceClick } = usePlaceClick();
  const { location: userLocation } = useCachedLocation();
  const [data, setData] = useState<VibeCheckData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVibeCheck = useCallback(async () => {
    try {
      const { data: result, error } =
        await supabase.functions.invoke<VibeCheckData>("get-vibe-check", {
          body: { place_id: placeId },
        });

      if (error) {
        logger.error("[VibeCheck] Edge function error:", { error });
        return;
      }

      setData(result);
    } catch (err) {
      logger.error("[VibeCheck] Fetch error:", { err });
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    fetchVibeCheck();
  }, [fetchVibeCheck]);

  const handleViewPeople = async () => {
    trackEvent(ANALYTICS_EVENTS.VIBE_CHECK.VIEW_PEOPLE_TAPPED, {
      placeId: placeId ?? "",
      planningCount: data?.planning_count ?? 0,
    });
    router.dismissAll();
    // Delegate navigation to usePlaceClick hook
    await handlePlaceClick({
      placeId: placeId ?? "",
      name: placeName ?? undefined,
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
    });
  };

  const handleDismiss = () => {
    trackEvent(ANALYTICS_EVENTS.VIBE_CHECK.DISMISSED, {
      placeId: placeId ?? "",
    });
    router.dismissAll();
  };

  const showCta = (data?.planning_count ?? 0) + (data?.recent_count ?? 0) > 0;

  return (
    <BaseTemplateScreen isModal scrollEnabled={false}>
      {/* ─── Gradient Header ─── */}
      <LinearGradient
        colors={["#0A2D4F", "#0D1B2A", colors.background]}
        locations={[0, 0.6, 1]}
        style={styles.headerGradient}
      >
        {/* Close button */}
        <Pressable
          style={styles.closeButton}
          onPress={handleDismiss}
          hitSlop={12}
        >
          <XIcon width={18} height={18} color="rgba(255,255,255,0.6)" />
        </Pressable>

        {/* Icon badge */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <LinearGradient
            colors={["#1D9BF0", "#38BDF8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <SparklesIcon width={28} height={28} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(150)}
          style={styles.headerTextContainer}
        >
          <ThemedText style={[typography.heading, styles.headerTitle]}>
            {t("screens.home.vibeCheck.title")}
          </ThemedText>
          <ThemedText style={[typography.body, styles.headerSubtitle]}>
            {t("screens.home.vibeCheck.subtitle", { place: "" })}
            <ThemedText style={[typography.body, { color: colors.accent }]}>
              {placeName ?? ""}
            </ThemedText>
          </ThemedText>
        </Animated.View>

        {/* Period badge */}
        {planPeriod ? (
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <View style={styles.periodBadge}>
              <View style={styles.periodDot} />
              <ThemedText style={[typography.caption, styles.periodText]}>
                {planPeriod}
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}
      </LinearGradient>

      {/* ─── Content ─── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : data ? (
        <View style={styles.statsContainer}>
          {/* Planning count */}
          {data.planning_count > 0 && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(250)}
              style={[styles.statCard, { backgroundColor: colors.surface }]}
            >
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: "rgba(29, 155, 240, 0.15)" },
                ]}
              >
                <UsersIcon width={22} height={22} color="#1D9BF0" />
              </View>
              <View style={styles.statTextContainer}>
                <ThemedText style={styles.statNumber}>
                  {data.planning_count}
                </ThemedText>
                <ThemedText
                  style={[typography.caption, { color: colors.textSecondary }]}
                >
                  {data.planning_count === 1
                    ? t("screens.home.vibeCheck.planningLabelOne")
                    : t("screens.home.vibeCheck.planningLabel")}
                </ThemedText>
              </View>
            </Animated.View>
          )}

          {/* Recent count — gradient card */}
          {data.recent_count > 0 && (
            <Animated.View entering={FadeInDown.duration(400).delay(350)}>
              <LinearGradient
                colors={["#0C4A6E", "#1D9BF0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCard}
              >
                <View
                  style={[
                    styles.statIconContainer,
                    { backgroundColor: "rgba(255,255,255,0.15)" },
                  ]}
                >
                  <FlameIcon width={22} height={22} color="#FFFFFF" />
                </View>
                <View style={styles.statTextContainer}>
                  <ThemedText
                    style={[typography.subheading, styles.trendingTitle]}
                  >
                    {t("screens.home.vibeCheck.trendingTitle")}
                  </ThemedText>
                  <ThemedText
                    style={[typography.caption, styles.trendingSubtitle]}
                  >
                    {data.recent_count === 1
                      ? t("screens.home.vibeCheck.recentLabelOne", {
                          count: data.recent_count,
                        })
                      : t("screens.home.vibeCheck.recentLabel", {
                          count: data.recent_count,
                        })}
                  </ThemedText>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {/* Common interests */}
          {data.common_interests.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(450)}
              style={[styles.statCard, { backgroundColor: colors.surface }]}
            >
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: "rgba(249, 24, 128, 0.15)" },
                ]}
              >
                <HeartIcon width={22} height={22} color="#F91880" />
              </View>
              <View style={styles.interestsContainer}>
                <ThemedText
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginBottom: spacing.xs },
                  ]}
                >
                  {t("screens.home.vibeCheck.commonInterestsLabel")}
                </ThemedText>
                <View style={styles.interestChips}>
                  {data.common_interests.map((interest) => (
                    <View
                      key={interest.key}
                      style={[
                        styles.interestChip,
                        { backgroundColor: colors.surfaceHover },
                      ]}
                    >
                      <ThemedText style={styles.interestEmoji}>
                        {getInterestIcon(interest.key)}
                      </ThemedText>
                      <ThemedText
                        style={[typography.caption, { color: colors.text }]}
                      >
                        {getInterestLabel(interest.key)} ({interest.count})
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Matches going */}
          {data.matches_going > 0 && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(550)}
              style={[styles.statCard, { backgroundColor: colors.surface }]}
            >
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: "rgba(255, 215, 0, 0.15)" },
                ]}
              >
                <HeartIcon width={22} height={22} color={colors.premiumGold} />
              </View>
              <View style={styles.statTextContainer}>
                <ThemedText style={styles.statNumber}>
                  {data.matches_going}
                </ThemedText>
                <ThemedText
                  style={[typography.caption, { color: colors.textSecondary }]}
                >
                  {t("screens.home.vibeCheck.matchesGoingLabel")}
                </ThemedText>
              </View>
            </Animated.View>
          )}

          {/* Empty state */}
          {data.planning_count === 0 &&
            data.recent_count === 0 &&
            data.matches_going === 0 &&
            data.common_interests.length === 0 && (
              <Animated.View
                entering={FadeInDown.duration(400).delay(250)}
                style={styles.emptyContainer}
              >
                <ThemedText
                  style={[
                    typography.body,
                    { color: colors.textSecondary, textAlign: "center" },
                  ]}
                >
                  {t("screens.home.vibeCheck.emptyState")}
                </ThemedText>
              </Animated.View>
            )}
        </View>
      ) : null}

      {/* CTA Button */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(650)}
        style={styles.ctaContainer}
      >
        {showCta ? (
          <Button
            label={t("screens.home.vibeCheck.viewPeople")}
            rightIcon={
              <ArrowRightIcon width={18} height={18} color="#FFFFFF" />
            }
            size="lg"
            fullWidth
            onPress={() => handleViewPeople()}
          />
        ) : (
          <Button
            variant="secondary"
            label={t("screens.home.vibeCheck.gotIt")}
            size="lg"
            fullWidth
            onPress={handleDismiss}
          />
        )}
      </Animated.View>
    </BaseTemplateScreen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerGradient: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.md, // bleed to edges (counteract BaseTemplateScreen padding)
    marginTop: -32, // bleed past top padding
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  closeButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    zIndex: 10,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  headerTextContainer: {
    alignItems: "center",
    gap: spacing.xs,
  },
  headerTitle: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  periodBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  periodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  periodText: {
    color: "rgba(255,255,255,0.8)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flex: 1,
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.md,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statTextContainer: {
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    color: "#1D9BF0",
  },
  trendingTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  trendingSubtitle: {
    color: "rgba(255,255,255,0.7)",
  },
  interestsContainer: {
    flex: 1,
  },
  interestChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    gap: spacing.xs,
  },
  interestEmoji: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  ctaContainer: {
    paddingTop: spacing.lg,
  },
});
