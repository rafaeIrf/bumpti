import { useThemeColors } from "@/hooks/use-theme-colors";
import { StyleSheet, View } from "react-native";

interface RadioButtonProps {
  readonly isSelected: boolean;
  readonly accentColor?: string;
  readonly isHighlighted?: boolean;
  readonly size?: "sm" | "md";
}

/**
 * RadioButton - Generic radio button indicator
 *
 * A reusable radio button visual component that displays
 * a circular indicator with filled state when selected.
 */
export function RadioButton({
  isSelected,
  accentColor,
  isHighlighted = false,
  size = "md",
}: RadioButtonProps) {
  const colors = useThemeColors();

  const getBorderColor = () => {
    if (isSelected) {
      return isHighlighted ? "#FFFFFF" : accentColor ?? colors.accent;
    }
    return isHighlighted ? "rgba(255, 255, 255, 0.5)" : colors.border;
  };

  const getFillColor = () => {
    if (isHighlighted) return "#FFFFFF";
    return accentColor ?? colors.accent;
  };

  const sizeStyles = size === "sm" ? styles.sm : styles.md;
  const innerSizeStyles = size === "sm" ? styles.smInner : styles.mdInner;

  return (
    <View
      style={[
        styles.radioOuter,
        sizeStyles,
        {
          borderColor: getBorderColor(),
        },
      ]}
    >
      {isSelected && (
        <View
          style={[
            styles.radioInner,
            innerSizeStyles,
            {
              backgroundColor: getFillColor(),
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  radioOuter: {
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    borderRadius: 50,
  },
  // Size variants
  md: {
    width: 24,
    height: 24,
  },
  mdInner: {
    width: 14,
    height: 14,
  },
  sm: {
    width: 20,
    height: 20,
  },
  smInner: {
    width: 10,
    height: 10,
  },
});
