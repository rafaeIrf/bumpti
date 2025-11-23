import {
  ArrowRightIcon,
  HeartIcon,
  MapIcon,
  MapPinIcon,
  UsersIcon,
} from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useCallback } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
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
}

interface PlaceCardProps {
  place: PlaceCardData;
  onPress: () => void;
  onToggleFavorite?: (placeId: string) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCard({
  place,
  onPress,
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

  const formatDistance = (km: number) => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m ${t("common.fromYou")}`;
    }
    return `${km.toFixed(1)} km ${t("common.fromYou")}`;
  };

  const handleFavorite = useCallback(
    (event: any) => {
      event.stopPropagation();
      onToggleFavorite?.(place.id);
    },
    [onToggleFavorite, place.id]
  );

  const handleOpenMaps = useCallback(
    (event: any) => {
      event.stopPropagation();
      const encoded = encodeURIComponent(place.address);
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encoded}`
      ).catch(() => {});
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
                color={place.isFavorite ? "#FF4D67" : "#FFFFFF"}
                stroke={place.isFavorite ? "#FF4D67" : "#FFFFFF"}
                fill={place.isFavorite ? "#FF4D67" : "none"}
              />
            </Pressable>
            <Pressable
              onPress={onPress}
              hitSlop={8}
              style={[
                styles.actionButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <ArrowRightIcon width={18} height={18} color="#FFFFFF" />
            </Pressable>
          </View>
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
          {place.tag ? (
            <View style={styles.tag}>
              <ThemedText style={styles.tagText}>{place.tag}</ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.bottomSection,
          {
            borderColor: colors.border,
          },
        ]}
      >
        <ThemedText
          style={[styles.address, { color: colors.text }]}
          numberOfLines={2}
        >
          {place.address}
        </ThemedText>
        <Pressable
          onPress={handleOpenMaps}
          hitSlop={8}
          style={[styles.mapButton, { borderColor: colors.border }]}
        >
          <MapIcon width={16} height={16} color={colors.icon} />
        </Pressable>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
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
