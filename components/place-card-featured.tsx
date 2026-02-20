import { MapPinIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { getCardGradientColors } from "@/utils/card-gradient";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export interface PlaceCardFeaturedProps {
  title: string;
  icon?: React.ComponentType<{ width: number; height: number; color: string }>;
  onClick: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  color?: string;
  count?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCardFeatured({
  title,
  icon: Icon,
  onClick,
  containerStyle,
  color = "#2997FF",
  count,
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

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle, containerStyle]}
    >
      <LinearGradient
        colors={getCardGradientColors(color)}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        {/* Gradient Overlay on Hover/Press */}
        <Animated.View style={[styles.hoverOverlay, overlayStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.2)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Count Badge - top-right corner */}
        {count !== undefined && count > 0 && (
          <View style={styles.countBadge}>
            <MapPinIcon width={8} height={8} color="#FFFFFF" />
            <ThemedText style={styles.countText}>{count}</ThemedText>
          </View>
        )}

        {/* Content Container */}
        <View style={styles.contentContainer}>
          {Icon && <Icon width={32} height={32} color="#FFFFFF" />}

          <ThemedText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[typography.body1, styles.title]}
          >
            {title}
          </ThemedText>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 96,
    borderRadius: 16,
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
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  title: {
    textAlign: "center",
  },
  countBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: "rgba(140, 100, 200, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  countText: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: Platform.select({ ios: 13, android: 10 }),
    includeFontPadding: false,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
