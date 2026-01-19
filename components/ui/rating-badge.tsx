import { StarIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

interface RatingBadgeProps {
  rating: number;
  variant?: "filled" | "minimal";
  style?: ViewStyle;
}

export function RatingBadge({
  rating,
  variant = "filled",
  style,
}: RatingBadgeProps) {
  const colors = useThemeColors();

  if (!rating || rating <= 0) return null;

  const isFilled = variant === "filled";

  return (
    <View
      style={[
        styles.container,
        isFilled && styles.filledContainer,
        // Minimal variant doesn't need extra styles by default here
        style,
      ]}
    >
      <StarIcon
        width={12}
        height={12}
        fill={colors.premiumGold || "#FFD700"}
        color={colors.premiumGold || "#FFD700"}
      />
      <ThemedText
        style={[
          styles.text,
          { color: colors.premiumGold || "#FFD700" }, // Ensure text matches icon
        ]}
      >
        {rating.toFixed(1)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  filledContainer: {
    backgroundColor: "rgba(255, 215, 0, 0.08)", // Gold with low opacity
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  text: {
    ...typography.caption,
    fontWeight: "700",
  },
});
