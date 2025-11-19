import {
  ArrowRightIcon,
  HeartIcon,
  NavigationIcon,
  Open,
} from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useCallback } from "react";
import {
  GestureResponderEvent,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface PlaceInfo {
  id: string;
  name: string;
  type: string;
  category: string;
  distance: number;
  activeUsers: number;
  image?: string;
  isFavorite?: boolean;
  formattedAddress?: string;
}

interface PlaceCardCompactProps {
  place: PlaceInfo;
  plansCount?: number;
  onClick: () => void;
  onPlansClick?: () => void;
  onToggleFavorite?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCardCompact({
  place,
  plansCount = 0,
  onClick,
  onPlansClick,
  onToggleFavorite,
}: PlaceCardCompactProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
    overlayOpacity.value = withSpring(1);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    overlayOpacity.value = withSpring(0);
  };

  const formatDistance = (km: number) => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m ${t("common.fromYou")}`;
    }
    return `${km.toFixed(1)} km ${t("common.fromYou")}`;
  };

  const handleOpenMaps = useCallback(() => {
    const address = place.formattedAddress || place.name;
    if (!address) return;
    const encodedAddress = encodeURIComponent(address);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    Linking.openURL(mapsUrl).catch(() => {});
  }, [place.formattedAddress, place.name]);

  const handleFavoritePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      onToggleFavorite?.();
    },
    [onToggleFavorite]
  );

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, cardAnimatedStyle]}
    >
      <View
        style={[
          styles.cardInner,
          {
            borderColor: colors.border,
          },
        ]}
      >
        <Animated.View style={[styles.hoverOverlay, overlayStyle]} />

        <View style={styles.topSection}>
          <View
            style={[
              styles.topBackground,
              { backgroundColor: colors.surfaceHover },
            ]}
          />
          <View style={styles.topContent}>
            <View style={styles.topHeader}>
              <View style={styles.titleRow}>
                <ThemedText style={styles.placeName} numberOfLines={1}>
                  {place.name}
                </ThemedText>
                {onToggleFavorite && (
                  <Pressable onPress={handleFavoritePress} hitSlop={8}>
                    <HeartIcon
                      width={18}
                      height={18}
                      color={place.isFavorite ? "#FF4D67" : "#FFFFFF"}
                      stroke={place.isFavorite ? "#FF4D67" : "#FFFFFF"}
                      fill={place.isFavorite ? "#FF4D67" : "none"}
                    />
                  </Pressable>
                )}
              </View>
              <Pressable onPress={onClick} hitSlop={8}>
                <ArrowRightIcon width={24} height={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={styles.distanceRow}>
              <NavigationIcon width={12} height={12} color="#FFFFFF" />
              <ThemedText style={styles.distanceTextTop}>
                {formatDistance(place.distance)}
              </ThemedText>
            </View>
          </View>
        </View>

        {place.formattedAddress && (
          <View
            style={[
              styles.bottomSection,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ThemedText
              style={[
                typography.caption,
                styles.addressText,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              {place.formattedAddress}
            </ThemedText>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                handleOpenMaps();
              }}
            >
              <Open width={12} height={12} color={colors.accent} />
            </Pressable>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
  },
  cardInner: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(41, 151, 255, 0.08)",
    zIndex: 1,
  },
  topSection: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  topBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  topContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    ...typography.body1,
    color: "#FFFFFF",
    flexShrink: 1,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  distanceTextTop: {
    ...typography.caption,
    color: "#FFFFFF",
  },
  bottomSection: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  addressText: {
    flex: 1,
  },
});
