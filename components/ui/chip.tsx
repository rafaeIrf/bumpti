import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { ReactNode } from "react";
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChipProps {
  label: string;
  icon?: ReactNode;
  color?: string; // Main color for text and background tint
  style?: StyleProp<ViewStyle>;
  variant?: "filled" | "outlined";
  size?: "sm" | "md";
  /** When provided, chip becomes interactive (Pressable with spring animation) */
  onPress?: () => void;
  /** Toggles selected visual state (accent bg, white text) */
  selected?: boolean;
  /** Dims the chip and disables interaction */
  disabled?: boolean;
}

export const Chip = React.memo(function Chip({
  label,
  icon,
  color,
  style,
  variant = "filled",
  size = "md",
  onPress,
  selected,
  disabled,
}: ChipProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.985, { damping: 20, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 400 });
  };

  // Selected state overrides everything
  let backgroundColor: string;
  let borderColor: string;
  let textColor: string;

  if (selected) {
    backgroundColor = colors.accent;
    borderColor = colors.accent;
    textColor = "#FFFFFF";
  } else {
    const activeColor = color ?? colors.accent;
    backgroundColor = variant === "filled" ? `${activeColor}15` : "transparent";
    borderColor =
      variant === "outlined" ? activeColor : "rgba(255, 255, 255, 0.05)";
    textColor = onPress ? colors.text : (color ?? colors.accent);
  }

  const content = (
    <>
      {icon}
      <ThemedText
        style={[
          size === "sm" ? typography.caption : typography.captionBold,
          { color: textColor },
          icon ? { marginLeft: spacing.xs } : undefined,
        ]}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </>
  );

  const containerStyle = [
    styles.container,
    {
      backgroundColor,
      borderColor,
      paddingVertical: size === "sm" ? 2 : spacing.xs,
      paddingHorizontal: size === "sm" ? spacing.sm : spacing.md,
      opacity: disabled ? 0.4 : 1,
    },
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[animatedStyle, ...containerStyle]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return <View style={containerStyle}>{content}</View>;
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
});
