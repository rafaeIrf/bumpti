import { HeartIcon, MapPinIcon, StarIcon, UsersIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useOptimisticFavorite } from "@/hooks/use-optimistic-favorite";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { formatDistance } from "@/utils/distance";
import { openMaps } from "@/utils/maps";
import React, { useCallback } from "react";
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
  isFavorite?: boolean;
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
  onToggleFavorite?: (
    placeId: string,
    options?: {
      optimisticOnly?: boolean;
      sync?: boolean;
      value?: boolean;
    }
  ) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCard({
  place,
  onPress,
  onInfoPress,
  onToggleFavorite,
}: PlaceCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);

  const { isFavorite: localFavorite, handleToggle: handleFavorite } =
    useOptimisticFavorite({
      initialIsFavorite: Boolean(place.isFavorite),
      placeId: place.id,
      onToggleFavorite,
    });

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

  const handleOpenMaps = useCallback(
    (event: any) => {
      event.stopPropagation();
      openMaps(place.address);
    },
    [place.address]
  );

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
      <View style={[styles.topSection]}>
        <View style={styles.topHeader}>
          <ThemedText style={styles.placeTitle} numberOfLines={1}>
            {place.name}
          </ThemedText>
          <View style={styles.actions}>
            {/* Info Button */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onInfoPress?.();
              }}
              hitSlop={8}
              style={[
                styles.actionButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <ThemedText
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  fontFamily: "Poppins-Bold",
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                i
              </ThemedText>
            </Pressable>

            {/* Favorite Button */}
            <Pressable
              onPress={handleFavorite}
              hitSlop={8}
              style={[
                styles.actionButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <HeartIcon
                width={18}
                height={18}
                color={localFavorite ? "#FF4D67" : "#FFFFFF"}
                stroke={localFavorite ? "#FF4D67" : "#FFFFFF"}
                fill={localFavorite ? "#FF4D67" : "none"}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.metaRow}>
          {place.tag ? (
            <ThemedText style={styles.tagText}>
              {t(`place.categories.${place.tag}`).toUpperCase()}
            </ThemedText>
          ) : null}
          {place.review ? (
            <>
              {place.tag && <View style={styles.dot} />}
              <View style={styles.ratingContainer}>
                <StarIcon
                  width={12}
                  height={12}
                  fill="#3B82F6"
                  color="#3B82F6"
                />
                <ThemedText style={styles.ratingText}>
                  {place.review.average.toFixed(1)}
                </ThemedText>
              </View>
            </>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MapPinIcon width={14} height={14} color="#FFFFFF" />
            <ThemedText style={styles.metaText}>
              {formatDistance(place.distance)}
            </ThemedText>
          </View>
          <View
            style={[styles.metaBadge, { backgroundColor: colors.surfaceHover }]}
          >
            <UsersIcon width={12} height={12} color={colors.accent} />
            <ThemedText
              style={[styles.metaBadgeText, { color: colors.accent }]}
            >
              {place.activeUsers}
            </ThemedText>
          </View>
        </View>
      </View>
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
    gap: spacing.sm,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  placeTitle: {
    ...typography.body1,
    color: "#FFFFFF",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: "#FFFFFF",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 50,
  },
  metaBadgeText: {
    ...typography.caption,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  tagText: {
    ...typography.caption,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#666666",
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
  bottomSection: {
    borderTopWidth: 1,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  address: {
    ...typography.caption,
    flex: 1,
  },
  mapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
