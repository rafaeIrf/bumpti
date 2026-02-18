import { StarIcon, UsersIcon } from "@/assets/icons";
import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";
import { Chip } from "@/components/ui/chip";
import { RatingBadge } from "@/components/ui/rating-badge";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import type { UserAvatar } from "@/modules/places/types";
import { formatDistance } from "@/utils/distance";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface PlaceCardData {
  id: string;
  name: string;
  address: string;
  distance: number;
  activeUsers: number;
  regularsCount?: number;
  activeUserAvatars?: UserAvatar[];
  tag?: string;
  neighborhood?: string;
  rank?: number;
  review?: {
    average: number;
    count: number;
    tags?: string[];
  };
}

interface PlaceCardProps {
  place: PlaceCardData;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MEDAL_COLORS = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

const getRankBadgeColor = (rank: number): string =>
  MEDAL_COLORS[rank as keyof typeof MEDAL_COLORS] || "#6B7280";

export function PlaceCard({ place, onPress }: PlaceCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
    overlay.value = withSpring(1);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    overlay.value = withSpring(0);
  };

  const hasActiveUsers = place.activeUsers > 0;
  const hasAvatars =
    place.activeUserAvatars && place.activeUserAvatars.length > 0;
  const hasReview = place.review && place.review.average > 0;
  const hasRegulars = (place.regularsCount ?? 0) > 0;

  // Label for active users chip (when no avatars)
  const activeUsersLabel = t(
    place.activeUsers === 0
      ? "place.noConnections"
      : place.activeUsers === 1
        ? "place.onePersonConnecting"
        : "place.manyPeopleConnecting",
    { count: place.activeUsers },
  );

  // Label for regulars chip
  const regularsLabel =
    place.regularsCount === 1
      ? t("place.oneRegularHere")
      : t("place.manyRegularsHere", { count: place.regularsCount });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle, { borderColor: colors.border }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.hoverOverlay, overlayStyle]}
      />

      {/* Rank Indicator */}
      {place.rank && place.rank <= 3 && (
        <View
          style={[
            styles.rankLine,
            { backgroundColor: getRankBadgeColor(place.rank) },
          ]}
        />
      )}

      <View style={styles.content}>
        {/* Header: Name */}
        <ThemedText style={styles.placeTitle} numberOfLines={1}>
          {place.name.toUpperCase()}
        </ThemedText>

        {/* Meta: Category • Neighborhood • Distance • Rating */}
        <View style={styles.metaRow}>
          {place.tag && (
            <>
              <ThemedText
                style={[styles.metaText, { color: colors.textSecondary }]}
              >
                {t(`place.categories.${place.tag}`)}
              </ThemedText>
              <View style={styles.dot} />
            </>
          )}
          {place.neighborhood && (
            <>
              <ThemedText
                style={[styles.metaText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {place.neighborhood}
              </ThemedText>
              <View style={styles.dot} />
            </>
          )}
          <ThemedText
            style={[styles.metaText, { color: colors.textSecondary }]}
          >
            {formatDistance(place.distance)}
          </ThemedText>
          {hasReview && (
            <>
              <View style={styles.dot} />
              <RatingBadge rating={place.review!.average} variant="minimal" />
            </>
          )}
        </View>

        {/* Footer: avatars + chips */}
        <View style={styles.footerRow}>
          {/* Left: avatars (if active) OR active-users chip (if no avatars) */}
          {hasAvatars ? (
            <StackedAvatars
              avatars={place.activeUserAvatars!}
              totalCount={place.activeUsers}
              maxVisible={4}
              size={34}
            />
          ) : (
            <Chip
              label={activeUsersLabel}
              icon={
                <UsersIcon
                  width={12}
                  height={12}
                  color={hasActiveUsers ? colors.accent : colors.textSecondary}
                />
              }
              color={hasActiveUsers ? colors.accent : colors.textSecondary}
              size="sm"
            />
          )}

          {/* Right: regulars chip — always shown when there are regulars */}
          {hasRegulars && (
            <Chip
              label={regularsLabel}
              icon={
                <StarIcon width={11} height={11} color={colors.textSecondary} />
              }
              color={colors.textSecondary}
              size="sm"
            />
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.lg,
    overflow: "hidden",
    backgroundColor: "#0F0F0F",
    borderWidth: 1,
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.05)",
    zIndex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 4,
  },
  placeTitle: {
    ...typography.body1,
    flex: 1,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: 8,
  },
  metaText: {
    ...typography.caption,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#8B98A5",
    marginHorizontal: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    gap: spacing.sm,
  },
  rankLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    zIndex: 1,
  },
});
