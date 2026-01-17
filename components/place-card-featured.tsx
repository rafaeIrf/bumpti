import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
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
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Helper to darken a hex color
function darkenColor(hex: string, percent: number): string {
  // Validate hex format
  if (!/^#([0-9A-F]{3}){1,2}$/i.test(hex)) return hex;

  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }

  r = Math.max(0, Math.floor(r * (1 - percent)));
  g = Math.max(0, Math.floor(g * (1 - percent)));
  b = Math.max(0, Math.floor(b * (1 - percent)));

  return (
    "#" +
    (r < 16 ? "0" : "") +
    r.toString(16) +
    (g < 16 ? "0" : "") +
    g.toString(16) +
    (b < 16 ? "0" : "") +
    b.toString(16)
  );
}

export function PlaceCardFeatured({
  title,
  icon: Icon,
  onClick,
  containerStyle,
  color = "#2997FF",
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

  // Generate darker icon color (30% darker)
  const iconColor = darkenColor(color, 0.3);

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle, containerStyle]}
    >
      <LinearGradient
        colors={[color, color]} // Use the pastel color as background
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

        {/* Decorative Icon - Bottom Right */}
        {Icon && (
          <View style={styles.decorativeIconContainer} pointerEvents="none">
            <View style={{ opacity: 0.5 }}>
              <Icon width={64} height={64} color={iconColor} />
            </View>
          </View>
        )}

        {/* Content Container */}
        <View style={styles.contentContainer}>
          <ThemedText
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[typography.body2, styles.title]}
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
    height: 90,
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
  decorativeIconContainer: {
    position: "absolute",
    bottom: -10,
    right: -10,
    zIndex: 2,
    transform: [{ rotate: "-15deg" }],
  },
  contentContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "flex-start", // Top alignment
    zIndex: 3,
  },
  title: {
    color: "#FFFFFF", // White text as requested
    fontSize: 14,
    maxWidth: "80%", // Prevent overlap with icon if it grows
  },
});
