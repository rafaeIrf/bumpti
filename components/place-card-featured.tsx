import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
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
  const colors = useThemeColors();

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

        {/* Content Container */}
        <View style={styles.contentContainer}>
          {Icon && <Icon />}

          {count !== undefined && count > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: "rgba(255, 255, 255, 0.25)",
                },
              ]}
            >
              <ThemedText style={styles.countText}>{count}</ThemedText>
            </View>
          )}

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
    height: 112,
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
    paddingHorizontal: spacing.xs,
    borderRadius: 6,
    width: 28,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  countText: {
    ...typography.caption,
    lineHeight: 0,
    fontSize: 10,
  },
});
