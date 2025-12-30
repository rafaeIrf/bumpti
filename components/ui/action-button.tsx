import { typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { ComponentType } from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SvgProps } from "react-native-svg";

export type ActionButtonSize = "xs" | "sm" | "md" | "lg" | number;
export type ActionButtonVariant = "default" | "accent";

export interface ActionButtonProps {
  icon?: ComponentType<SvgProps>;
  label?: string;
  onPress: () => void;
  ariaLabel: string;
  color?: string;
  size?: ActionButtonSize;
  variant?: ActionButtonVariant;
  iconSize?: number;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const sizeMap = {
  xs: { button: 24, icon: 12 },
  sm: { button: 32, icon: 18 },
  md: { button: 40, icon: 24 },
  lg: { button: 48, icon: 28 },
};

export function ActionButton({
  icon: IconComponent,
  label,
  onPress,
  ariaLabel,
  color,
  size = "md",
  variant = "default",
  iconSize,
  style,
}: ActionButtonProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  // Determine dimensions based on size prop
  let finalButtonSize: number;
  let finalIconSize: number;

  if (typeof size === "number") {
    finalButtonSize = size;
    finalIconSize = iconSize ?? size * 0.6; // Robust default if no iconSize provided
  } else {
    const dimensions = sizeMap[size];
    finalButtonSize = dimensions.button;
    finalIconSize = iconSize ?? dimensions.icon;
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  // Determine colors based on variant
  const isAccent = variant === "accent";
  const backgroundColor = isAccent
    ? (colors as any).accentBorderFaint ??
      (colors as any).accentBlueLight ??
      colors.border
    : "#16181C";
  const borderColor = isAccent ? colors.accent : "#2F3336";
  const iconColor = color ?? (isAccent ? colors.accent : "#FFF");

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.button,
        {
          width: finalButtonSize,
          height: finalButtonSize,
          borderRadius: finalButtonSize / 2,
          backgroundColor,
          borderColor,
        },
        animatedStyle,
        style,
      ]}
      accessibilityLabel={ariaLabel}
    >
      {IconComponent ? (
        <IconComponent
          width={finalIconSize}
          height={finalIconSize}
          color={iconColor}
          stroke={iconColor}
        />
      ) : (
        <Text
          style={[typography.body, { color: iconColor, fontWeight: "600" }]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#16181C",
    borderWidth: 1,
    borderColor: "#2F3336",
    alignItems: "center",
    justifyContent: "center",
  },
});
