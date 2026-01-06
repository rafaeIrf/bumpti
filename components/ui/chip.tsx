import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface ChipProps {
  label: string;
  icon?: ReactNode;
  color?: string; // Main color for text and background tint
  style?: StyleProp<ViewStyle>;
  variant?: "filled" | "outlined";
  size?: "sm" | "md";
}

export function Chip({
  label,
  icon,
  color,
  style,
  variant = "filled",
  size = "md",
}: ChipProps) {
  const colors = useThemeColors();
  const activeColor = color ?? colors.accent;

  const backgroundColor =
    variant === "filled" ? `${activeColor}15` : "transparent";
  const borderColor =
    variant === "outlined" ? activeColor : "rgba(255, 255, 255, 0.05)";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor,
          paddingVertical: size === "sm" ? 2 : spacing.xs,
          paddingHorizontal: size === "sm" ? spacing.sm : spacing.md,
        },
        style,
      ]}
    >
      {icon}
      <ThemedText
        style={[
          size === "sm" ? typography.caption : typography.captionBold,
          { color: activeColor },
          icon ? { marginLeft: spacing.xs } : undefined,
        ]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
});
