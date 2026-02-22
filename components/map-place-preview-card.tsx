/**
 * MapPlacePreviewCard — compact bottom sheet triggered by tapping a pin.
 *
 * Design:
 *  ┌──────────────────────────────────────────┐
 *  │  ○○○○  StackedAvatars                    │
 *  │  Place Name                        ♥ cat │
 *  │  Neighborhood                            │
 *  │  "X pessoas no radar agora" (blue)       │
 *  │  ┌──────────────┐ ┌──────────────┐       │
 *  │  │ Conectar agora│ │ Criar Plano  │       │
 *  │  └──────────────┘ └──────────────┘       │
 *  └──────────────────────────────────────────┘
 */

import { StackedAvatars } from "@/components/stacked-avatars";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { PlaceSocialSummary } from "@/modules/places/api";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

const ACCENT = "#1D9BF0";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaceFallback {
  active_users: number;
  planning_count: number;
  regulars_count: number;
  preview_avatars?: { user_id: string; url: string }[];
}

interface MapPlacePreviewCardProps {
  place: { name: string; neighborhood: string | null | undefined };
  placeFallback: PlaceFallback;
  summary: PlaceSocialSummary | null;
  loading: boolean;
  onConnect: () => void;
  onCreatePlan: () => void;
  onDismiss: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the semantic copy line + color based on activity signals */
function getSocialCopy(
  summary: PlaceSocialSummary | null,
  fallback: PlaceFallback,
): { text: string; color: string } | null {
  // Use summary values when available, otherwise fall back to pin data
  const activeCount = summary?.active_count ?? fallback.active_users;
  const planningCount = summary?.planning_count ?? fallback.planning_count;
  const regularsCount = summary?.regulars_count ?? fallback.regulars_count;

  // Priority 1: active users → strongest signal
  if (activeCount > 0) {
    return {
      text: t("screens.home.map.preview.activeNow", { count: activeCount }),
      color: ACCENT,
    };
  }

  // Priority 2: confirmed plans this week
  if (planningCount > 0) {
    return {
      text: t("screens.home.map.preview.planningWeek", {
        count: planningCount,
      }),
      color: "#8B98A5",
    };
  }

  // Priority 3: regulars — place is a crowd favorite
  if (regularsCount > 0) {
    return {
      text: t("screens.home.map.preview.regularsFavorite"),
      color: "#8B98A5",
    };
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapPlacePreviewCard({
  place,
  placeFallback,
  summary,
  loading,
  onConnect,
  onCreatePlan,
  onDismiss,
}: MapPlacePreviewCardProps) {
  const colors = useThemeColors();

  const socialCopy = getSocialCopy(summary, placeFallback);
  // Avatars: prefer summary (personalised), fallback to pin preview_avatars
  const avatars = summary?.avatars ?? placeFallback.preview_avatars ?? [];
  const totalCount =
    (summary?.active_count ?? placeFallback.active_users) +
    (summary?.regulars_count ?? placeFallback.regulars_count);

  const handleConnect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConnect();
  };

  const handleCreatePlan = () => {
    Haptics.selectionAsync();
    onCreatePlan();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(280).springify()}
      exiting={FadeOutDown.duration(180)}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      {/* Dismiss handle */}
      <Pressable style={styles.handleArea} onPress={onDismiss}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      </Pressable>

      <View style={styles.content}>
        {/* StackedAvatars — hero element at top */}
        {avatars.length > 0 && (
          <View style={styles.avatarSection}>
            <StackedAvatars
              avatars={avatars}
              totalCount={totalCount}
              maxVisible={5}
              size={36}
            />
          </View>
        )}

        {/* Place identity */}
        <Text
          style={[typography.subheading, { color: colors.text }]}
          numberOfLines={1}
        >
          {place.name}
        </Text>
        {place.neighborhood ? (
          <Text
            style={[typography.caption, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {place.neighborhood}
          </Text>
        ) : null}

        {/* Social copy line */}
        {loading ? (
          <ActivityIndicator
            size="small"
            color={ACCENT}
            style={styles.loader}
          />
        ) : socialCopy ? (
          <View style={styles.socialRow}>
            {socialCopy.color === ACCENT && <View style={styles.liveDot} />}
            <Text
              style={[typography.caption, { color: socialCopy.color, flex: 1 }]}
            >
              {socialCopy.text}
            </Text>
          </View>
        ) : null}

        {/* CTAs */}
        <View style={styles.ctaRow}>
          {/* Primary: Conectar agora */}
          <Pressable
            style={[styles.ctaPrimary, { backgroundColor: ACCENT }]}
            onPress={handleConnect}
          >
            <Text style={[typography.captionBold, styles.ctaPrimaryText]}>
              {t("screens.home.map.preview.connectNow")}
            </Text>
          </Pressable>

          {/* Secondary: Criar Plano */}
          <Pressable
            style={[styles.ctaSecondary, { borderColor: colors.border }]}
            onPress={handleCreatePlan}
          >
            <Text style={[typography.captionBold, { color: colors.text }]}>
              {t("screens.home.map.preview.createPlan")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  handleArea: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  avatarSection: {
    marginBottom: spacing.xs,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  loader: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  ctaRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ctaPrimary: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimaryText: {
    color: "#fff",
  },
  ctaSecondary: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
