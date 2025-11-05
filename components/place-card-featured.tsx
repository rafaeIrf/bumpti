import { ArrowRightIcon, NavigationIcon, UsersIcon } from "@/assets/icons";
import { getPlaceIcon } from "@/components/place-card-utils";
import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/constants/theme";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface PlaceCardFeaturedProps {
  place: {
    id: string;
    name: string;
    type: string;
    category: string;
    distance: number;
    activeUsers: number;
  };
  onClick: () => void;
  index?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCardFeatured({
  place,
  onClick,
  index = 0,
}: PlaceCardFeaturedProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
    opacity.value = withSpring(1);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withSpring(0);
  };

  const Icon = getPlaceIcon(place.type);

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m ${t("common.fromYou")}`;
    }
    return `${km.toFixed(1)} km ${t("common.fromYou")}`;
  };

  const formatActiveUsers = (count: number): string => {
    if (count === 1) return t("common.onePerson");
    return t("common.peopleNow", { count });
  };

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle]}
    >
      <LinearGradient
        colors={["#141414", "#1E1E1E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        {/* Gradient Overlay on Hover/Press */}
        <Animated.View style={[styles.hoverOverlay, overlayStyle]}>
          <LinearGradient
            colors={["rgba(41, 151, 255, 0.05)", "rgba(41, 151, 255, 0.1)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Decorative Icon - Bottom Right */}
        <View style={styles.decorativeIconContainer} pointerEvents="none">
          <View style={{ opacity: 0.3 }}>
            <Icon width={64} height={64} color="#FFFFFF" />
          </View>
        </View>

        {/* Content Container */}
        <View style={styles.contentContainer}>
          {/* Top Section */}
          <View>
            <View style={styles.headerRow}>
              {/* Place Name */}
              <ThemedText
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.placeName}
              >
                {place.name}
              </ThemedText>

              {/* Arrow Icon */}
              <View style={styles.arrowContainer}>
                <ArrowRightIcon width={16} height={16} color="#2997FF" />
              </View>
            </View>

            {/* Info - People and Distance */}
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <UsersIcon width={12} height={12} color="#B0B0B0" />
                <ThemedText style={styles.infoText}>
                  {formatActiveUsers(place.activeUsers)}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <NavigationIcon width={12} height={12} color="#8B98A5" />
                <ThemedText style={styles.distanceText}>
                  {formatDistance(place.distance)}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    height: 130,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2F3336",
    overflow: "hidden",
  },
  gradientContainer: {
    flex: 1,
    position: "relative",
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  decorativeIconContainer: {
    position: "absolute",
    bottom: 12,
    right: 12,
    zIndex: 2,
  },
  contentContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "space-between",
    zIndex: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  placeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    paddingRight: spacing.sm,
  },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(41, 151, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoContainer: {
    gap: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#B0B0B0",
  },
  distanceText: {
    fontSize: 12,
    color: "#8B98A5",
  },
});
