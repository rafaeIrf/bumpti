import { ArrowRightIcon, HeartIcon, StarIcon, UsersIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { formatDistance } from "@/utils/distance";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ActionButton } from "./ui/action-button";

interface PlaceCardData {
  id: string;
  name: string;
  address: string;
  distance: number;
  activeUsers: number;
  tag?: string;
  review?: {
    average: number;
    count: number;
    tags?: string[];
  };
}

interface PlaceCardProps {
  place: PlaceCardData;
  onPress: () => void;
  onInfoPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCard({
  place,
  onPress,
  onInfoPress,
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
      <View style={styles.topSection}>
        {/* Line 1: Name + Favorite + Arrow */}
        <View style={styles.headerRow}>
          <View style={styles.nameAndFavorite}>
            <ThemedText style={styles.placeTitle} numberOfLines={1}>
              {place.name}
            </ThemedText>
            <ActionButton
              ariaLabel={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
              size="sm"
              variant={isFavorite ? "accent" : "default"}
              onPress={() => {
                onToggleFavorite?.();
              }}
              icon={(props) => (
                <HeartIcon
                  {...props}
                  fill={isFavorite ? colors.accent : "none"}
                />
              )}
              color={isFavorite ? colors.accent : colors.textSecondary}
            />
          </View>
          <ArrowRightIcon width={18} height={18} color={colors.text} />
        </View>

        {/* Line 2: Pessoas no local */}
        <View style={styles.metaRow}>
          <UsersIcon width={14} height={14} color={colors.textSecondary} />
          <ThemedText style={styles.metaText}>
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

        {/* Line 3: Category • Distance • Rating */}
        <View style={styles.metaRow}>
          {place.tag && (
            <>
              <ThemedText style={styles.tagText}>
                {t(`place.categories.${place.tag}`)}
              </ThemedText>
              <View style={styles.dot} />
            </>
          )}
          <ThemedText style={styles.metaText}>
            {formatDistance(place.distance)}
          </ThemedText>
          {place.review && (
            <>
              <View style={styles.dot} />
              <View style={styles.ratingContainer}>
                <StarIcon
                  width={12}
                  height={12}
                  fill={colors.accent}
                  color={colors.accent}
                />
                <ThemedText style={styles.ratingText}>
                  {place.review.average.toFixed(1)}
                </ThemedText>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Footer: Detalhes */}
      <Pressable
        style={styles.detailsFooter}
        onPress={(e) => {
          e.stopPropagation();
          onInfoPress?.();
        }}
      >
        <ThemedText style={[styles.detailsText, { color: colors.accent }]}>
          {t("actions.details")}
        </ThemedText>
      </Pressable>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#0F0F0F",
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.08)",
    zIndex: 1,
    borderRadius: 20,
  },
  topSection: {
    padding: spacing.md,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  nameAndFavorite: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 4, // 4px distance from name
  },
  placeTitle: {
    ...typography.body1,
    color: "#FFFFFF",
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: "#A1A1AA",
  },
  tagText: {
    ...typography.caption,
    color: "#A1A1AA",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#3F3F46",
    marginHorizontal: 2,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    ...typography.caption,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  detailsFooter: {
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsText: {
    ...typography.captionBold,
  },
});
