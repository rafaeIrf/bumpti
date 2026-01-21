import { HeartIcon, UsersIcon } from "@/assets/icons";
import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";
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
import { RatingBadge } from "./ui/rating-badge";

interface PlaceCardData {
  id: string;
  name: string;
  address: string;
  distance: number;
  activeUsers: number;
  activeUserAvatars?: UserAvatar[]; // Avatars with user_id for real-time removal
  tag?: string;
  rank?: number; // Ranking position (1-based)
  review?: {
    average: number;
    count: number;
    tags?: string[];
  };
}

interface PlaceCardProps {
  place: PlaceCardData;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Medal colors for top 3
const MEDAL_COLORS = {
  1: "#FFD700", // Gold
  2: "#C0C0C0", // Silver
  3: "#CD7F32", // Bronze
};

const getRankBadgeColor = (rank: number): string => {
  return MEDAL_COLORS[rank as keyof typeof MEDAL_COLORS] || "#6B7280"; // Gray for 4+
};

export function PlaceCard({
  place,
  onPress,
  isFavorite,
  onToggleFavorite,
}: PlaceCardProps) {
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

      {/* Rank Badge - Top Left Corner */}
      {place.rank && place.rank <= 3 && (
        <View
          style={[
            styles.rankBadge,
            { backgroundColor: getRankBadgeColor(place.rank) },
          ]}
        >
          <ThemedText style={styles.rankText}>#{place.rank}</ThemedText>
        </View>
      )}

      <View
        style={[
          styles.content,
          place.rank && place.rank <= 3 ? styles.contentWithRank : undefined,
        ]}
      >
        {/* Header: Name + Favorite */}
        <View style={styles.headerRow}>
          <ThemedText style={styles.placeTitle} numberOfLines={1}>
            {place.name.toUpperCase()}
          </ThemedText>
          <Pressable onPress={() => onToggleFavorite?.()} hitSlop={12}>
            <HeartIcon
              width={20}
              height={20}
              color={isFavorite ? colors.accent : colors.textSecondary}
              fill={isFavorite ? colors.accent : "none"}
            />
          </Pressable>
        </View>

        {/* Meta: Category • Distance */}
        <View style={styles.metaRow}>
          {place.tag && (
            <>
              <ThemedText
                style={[styles.tagText, { color: colors.textSecondary }]}
              >
                {t(`place.categories.${place.tag}`)}
              </ThemedText>
              <View style={styles.dot} />
            </>
          )}
          <ThemedText
            style={[styles.metaText, { color: colors.textSecondary }]}
          >
            {formatDistance(place.distance)}
          </ThemedText>
          {/* Rating */}
          {hasReview && (
            <>
              <View style={styles.dot} />
              <RatingBadge rating={place.review!.average} variant="minimal" />
            </>
          )}
        </View>

        {/* Footer: Live Status */}
        <View style={styles.footerRow}>
          {hasAvatars ? (
            <StackedAvatars
              avatars={place.activeUserAvatars!}
              totalCount={place.activeUsers}
              maxVisible={4}
              size={36}
            />
          ) : (
            <View
              style={[
                styles.liveContainer,
                hasActiveUsers && {
                  backgroundColor: "rgba(29, 155, 240, 0.1)",
                },
              ]}
            >
              <UsersIcon
                width={12}
                height={12}
                color={hasActiveUsers ? colors.accent : colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.liveText,
                  hasActiveUsers && { color: colors.accent },
                ]}
              >
                {t(
                  place.activeUsers === 0
                    ? "place.noConnections"
                    : place.activeUsers === 1
                      ? "place.onePersonConnecting"
                      : "place.manyPeopleConnecting",
                  { count: place.activeUsers }
                )}
              </ThemedText>
            </View>
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
  contentWithRank: {
    paddingTop: spacing.xl,
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
    gap: spacing.xs,
    marginBottom: 8,
  },
  metaText: {
    ...typography.caption,
  },
  tagText: {
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
  },
  liveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  liveText: {
    ...typography.caption,
    fontSize: 11,
    color: "#A1A1AA",
    fontWeight: "500",
  },
  rankBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    borderBottomRightRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 10,
  },
  rankText: {
    ...typography.caption,
    fontWeight: "800",
    color: "#000000",
    fontSize: 10,
  },
});
