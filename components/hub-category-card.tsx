import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { getCardGradientColors } from "@/utils/card-gradient";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SvgProps } from "react-native-svg";
import { ThemedText } from "./themed-text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface HubCategory {
  id: string;
  title: string;
  color: string;
  category: string[];
  illustration?: React.ComponentType<SvgProps>;
}

interface HubCategoryCardProps {
  category: HubCategory;
  selectedCount: number;
  onPress: () => void;
}

function HubCategoryCardInner({
  category,
  selectedCount,
  onPress,
}: HubCategoryCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const pressOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: pressOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
    pressOpacity.value = withSpring(1);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    pressOpacity.value = withSpring(0);
  };

  const Illustration = category.illustration;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, styles.pressable]}
    >
      <View
        style={[
          styles.container,
          {
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <LinearGradient
          colors={getCardGradientColors(category.color)}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.darkOverlay]} />

        <Animated.View
          pointerEvents="none"
          style={[styles.hoverOverlay, overlayStyle]}
        />

        <View style={styles.content}>
          {Illustration && (
            <View style={styles.illustrationContainer}>
              <Illustration width={48} height={48} />
            </View>
          )}
          <ThemedText style={[typography.body, styles.title]} numberOfLines={2}>
            {category.title}
          </ThemedText>
        </View>

        {selectedCount > 0 && (
          <View style={[styles.badge, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
            <ThemedText style={styles.badgeText}>{selectedCount}</ThemedText>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

export const HubCategoryCard = React.memo(HubCategoryCardInner);

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  container: {
    borderRadius: 20,
    overflow: "hidden",
    height: 120,
    position: "relative",
  },
  darkOverlay: {
    backgroundColor: "rgba(13, 13, 13, 0.25)",
  },
  hoverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  illustrationContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
});
