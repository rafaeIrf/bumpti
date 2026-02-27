import { ArrowRightIcon } from "@/assets/icons";
import { getCategoryColor, getPlaceIcon } from "@/components/place-card-utils";
import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";
import { BrandIcon } from "@/components/ui/brand-icon";
import { RatingBadge } from "@/components/ui/rating-badge";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { UserAvatar } from "@/modules/places/types";
import { formatDistance } from "@/utils/distance";
import { toTitleCase } from "@/utils/string";
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

  const hasAvatars =
    place.activeUserAvatars && place.activeUserAvatars.length > 0;
  const hasReview = place.review && place.review.average > 0;

  const categoryTag = place.tag ?? "default";
  const categoryColor = getCategoryColor(categoryTag);
  const CategoryIcon = getPlaceIcon(categoryTag);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        animatedStyle,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.hoverOverlay, overlayStyle]}
      />

      <View style={styles.content}>
        {/* Category Icon + Distance */}
        <View style={styles.iconCol}>
          <BrandIcon
            icon={CategoryIcon}
            size="md"
            color="#FFFFFF"
            style={{
              backgroundColor: `${categoryColor}`,
              borderWidth: 0,
            }}
          />
          <ThemedText
            style={[styles.distanceLabel, { color: colors.textSecondary }]}
          >
            {formatDistance(place.distance)}
          </ThemedText>
        </View>

        {/* Text Column */}
        <View style={styles.textColumn}>
          {/* Header: Name */}
          <View style={styles.headerRow}>
            <ThemedText style={styles.placeTitle} numberOfLines={1}>
              {toTitleCase(place.name)}
            </ThemedText>
          </View>

          {/* Meta: Category • Neighborhood • Distance • Rating */}
          <View style={styles.metaRow}>
            {place.neighborhood && (
              <>
                <ThemedText
                  style={[styles.metaText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {place.neighborhood}
                </ThemedText>
              </>
            )}
            {hasReview && (
              <>
                <View style={styles.dot} />
                <RatingBadge rating={place.review!.average} variant="minimal" />
              </>
            )}
          </View>

          {/* Footer: avatars */}
          {hasAvatars && (
            <View style={styles.footerRow}>
              <StackedAvatars
                avatars={place.activeUserAvatars!}
                totalCount={place.activeUsers}
                maxVisible={4}
                size={34}
              />
            </View>
          )}
        </View>

        {/* Arrow centered on the right */}
        <ArrowRightIcon color={colors.textSecondary} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.lg,
    overflow: "hidden",
    borderWidth: 0,
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.05)",
    zIndex: 1,
  },
  content: {
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  iconCol: {
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  distanceLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  placeTitle: {
    ...typography.body1,
    flex: 1,
    letterSpacing: 0.5,
  },
  arrowIcon: {
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: spacing.xs,
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
    marginTop: 2,
    gap: spacing.sm,
  },
});
