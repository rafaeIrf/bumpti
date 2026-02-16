import { CalendarIcon, MapPinIcon, UsersIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { createPlan, fetchAndSetUserPlans } from "@/modules/plans/api";
import {
  getPlanInviteDetails,
  type PlanInviteDetails,
} from "@/modules/plans/invite";
import { supabase } from "@/modules/supabase/client";
import { getPeriodLabel } from "@/utils/date";
import { logger } from "@/utils/logger";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── State Machine ────────────────────────────────────────────────────
type ScreenState =
  | "loading"
  | "ready"
  | "joining"
  | "success"
  | "error"
  | "expired";

export default function JoinPlanScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<ScreenState>("loading");
  const [invite, setInvite] = useState<PlanInviteDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // ── Fetch invite details ────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage(t("screens.home.joinPlan.invalidLink"));
      return;
    }

    const fetchInvite = async () => {
      const details = await getPlanInviteDetails(token);
      if (!details) {
        setState("expired");
        return;
      }

      // Check if expired client-side too
      if (new Date(details.expires_at) < new Date()) {
        setState("expired");
        return;
      }

      setInvite(details);
      setState("ready");
    };

    fetchInvite();
  }, [token]);

  // ── Join Plan ───────────────────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    if (!invite) return;

    // Client-side "own plan" guard
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id === invite.creator.id) {
        setState("error");
        setErrorMessage(t("screens.home.joinPlan.ownPlan"));
        return;
      }
    } catch (err) {
      logger.warn("[JoinPlan] Failed to check current user:", err);
    }

    setState("joining");

    const result = await createPlan({
      placeId: invite.place_id,
      plannedFor: invite.planned_for,
      period: invite.planned_period,
      expiresAt: invite.expires_at,
      inviteToken: token as string,
    });

    if (!result) {
      setState("error");
      setErrorMessage(t("screens.home.joinPlan.errorJoining"));
      return;
    }

    // Refresh plans in Redux
    try {
      await fetchAndSetUserPlans();
    } catch (err) {
      logger.warn("[JoinPlan] Failed to refresh plans:", err);
    }

    setState("success");

    // Navigate to vibe-check after a brief delay
    setTimeout(() => {
      router.dismissAll();
      router.push({
        pathname: "/(modals)/vibe-check",
        params: {
          placeId: invite.place_id,
          placeName: invite.place_name ?? "",
          plannedFor: invite.planned_for,
          planPeriod: t(
            `screens.home.createPlan.period.periodDescriptions.${invite.planned_period}`,
          ),
        },
      });
    }, 1200);
  }, [invite, token]);

  // ── Close ───────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    router.dismissAll();
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────
  const renderLoading = () => (
    <View style={styles.centerFull}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );

  const renderExpired = () => (
    <>
      <LinearGradient
        colors={["#92400E", "#78350F", colors.background]}
        locations={[0, 0.55, 1]}
        style={[styles.headerGradient, { paddingTop: insets.top + spacing.lg }]}
      >
        <Pressable
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={12}
        >
          <XIcon width={18} height={18} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <LinearGradient
            colors={["#F59E0B", "#D97706"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <ThemedText style={styles.stateBadgeEmoji}>⏰</ThemedText>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(500).delay(150)}
          style={styles.headerTextContainer}
        >
          <ThemedText style={[typography.heading, styles.headerTitle]}>
            {t("screens.home.joinPlan.expired")}
          </ThemedText>
          <ThemedText style={[typography.body, styles.headerSubtitle]}>
            {t("screens.home.joinPlan.expiredDescription")}
          </ThemedText>
        </Animated.View>
      </LinearGradient>
    </>
  );

  const renderError = () => (
    <>
      <LinearGradient
        colors={["#7C3AED", "#4F46E5", colors.background]}
        locations={[0, 0.55, 1]}
        style={[styles.headerGradient, { paddingTop: insets.top + spacing.lg }]}
      >
        <Pressable
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={12}
        >
          <XIcon width={18} height={18} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <LinearGradient
            colors={["#A855F7", "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <UsersIcon width={28} height={28} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(500).delay(150)}
          style={styles.headerTextContainer}
        >
          <ThemedText style={[typography.heading, styles.headerTitle]}>
            {errorMessage}
          </ThemedText>
        </Animated.View>
      </LinearGradient>
    </>
  );

  const renderInvite = () => {
    if (!invite) return null;

    return (
      <>
        {/* ─── Gradient Header ─── */}
        <LinearGradient
          colors={["#7C3AED", "#4F46E5", colors.background]}
          locations={[0, 0.55, 1]}
          style={[
            styles.headerGradient,
            { paddingTop: insets.top + spacing.lg },
          ]}
        >
          {/* Close button */}
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={12}
          >
            <XIcon width={18} height={18} color="rgba(255,255,255,0.6)" />
          </Pressable>

          {/* Icon badge */}
          <Animated.View entering={FadeInDown.duration(500).delay(100)}>
            <LinearGradient
              colors={["#A855F7", "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <UsersIcon width={28} height={28} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          {/* Title & subtitle */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(150)}
            style={styles.headerTextContainer}
          >
            <ThemedText style={[typography.heading, styles.headerTitle]}>
              {t("screens.home.joinPlan.title")}
            </ThemedText>
            {invite.creator.display_name && (
              <ThemedText style={[typography.body, styles.headerSubtitle]}>
                {t("screens.home.joinPlan.subtitle", {
                  name: invite.creator.display_name,
                })}
              </ThemedText>
            )}
          </Animated.View>

          {/* Creator avatar */}
          {invite.creator.photo_url && (
            <Animated.View entering={FadeInDown.duration(400).delay(200)}>
              <Image
                source={{ uri: invite.creator.photo_url }}
                style={styles.creatorAvatar}
              />
            </Animated.View>
          )}
        </LinearGradient>

        {/* ─── Content ─── */}
        <View style={styles.contentContainer}>
          {/* Place card */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(250)}
            style={[styles.detailCard, { backgroundColor: colors.surface }]}
          >
            <View
              style={[
                styles.detailIconContainer,
                { backgroundColor: "rgba(168, 85, 247, 0.15)" },
              ]}
            >
              <MapPinIcon width={22} height={22} color="#A855F7" />
            </View>
            <View style={styles.detailTextContainer}>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {t("screens.home.joinPlan.placeLabel")}
              </ThemedText>
              <ThemedText
                style={[typography.body, { color: colors.text }]}
                numberOfLines={2}
              >
                {invite.place_name}
              </ThemedText>
            </View>
          </Animated.View>

          {/* When card */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(350)}
            style={[styles.detailCard, { backgroundColor: colors.surface }]}
          >
            <View
              style={[
                styles.detailIconContainer,
                { backgroundColor: "rgba(29, 155, 240, 0.15)" },
              ]}
            >
              <CalendarIcon width={22} height={22} color="#1D9BF0" />
            </View>
            <View style={styles.detailTextContainer}>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {t("screens.home.joinPlan.whenLabel")}
              </ThemedText>
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {getPeriodLabel(invite.planned_for, invite.planned_period)}
              </ThemedText>
            </View>
          </Animated.View>

          {/* Success state */}
          {state === "success" && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={styles.successCard}
            >
              <ThemedText style={styles.successEmoji}>🎉</ThemedText>
              <ThemedText style={[typography.body, { color: "#22C55E" }]}>
                {t("screens.home.joinPlan.success")}
              </ThemedText>
            </Animated.View>
          )}
        </View>
      </>
    );
  };

  // ── Main render ────────────────────────────────────────────────────
  const showBottomBar = state !== "loading";

  return (
    <BaseTemplateScreen
      isModal
      scrollEnabled
      useSafeArea={false}
      contentContainerStyle={{ paddingBottom: spacing.xxl * 3 }}
      BottomBar={
        showBottomBar ? (
          <ScreenBottomBar
            variant="single"
            primaryLabel={
              state === "error" || state === "expired"
                ? t("common.close")
                : state === "success"
                  ? `✓ ${t("screens.home.joinPlan.success")}`
                  : state === "joining"
                    ? t("common.loading")
                    : t("screens.home.joinPlan.joinButton")
            }
            onPrimaryPress={
              state === "error" || state === "expired"
                ? handleClose
                : state === "success"
                  ? handleClose
                  : handleJoin
            }
            primaryDisabled={state === "joining" || state === "success"}
            showBorder
          />
        ) : undefined
      }
    >
      {state === "loading" && renderLoading()}
      {state === "expired" && renderExpired()}
      {state === "error" && renderError()}
      {(state === "ready" || state === "joining" || state === "success") &&
        renderInvite()}
    </BaseTemplateScreen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centerFull: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messageContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  expiredIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 160, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  expiredEmoji: {
    fontSize: 28,
  },
  stateBadgeEmoji: {
    fontSize: 28,
  },

  // ─── Header ────────────────────────────────────────────────────────
  headerGradient: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  closeButton: {
    position: "absolute",
    top: spacing.xl,
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
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  creatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    marginTop: spacing.md,
  },

  // ─── Content ───────────────────────────────────────────────────────
  contentContainer: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  detailCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.md,
  },
  detailIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTextContainer: {
    flex: 1,
    gap: 2,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    gap: spacing.sm,
  },
  successEmoji: {
    fontSize: 20,
  },
});
