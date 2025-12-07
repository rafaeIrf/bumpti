import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

interface PlaceCardSelectionProps {
  placeId: string;
  name: string;
  category?: string;
  categoryIcon?: React.ReactNode;
  isSelected: boolean;
  onToggle: () => void;
}

/**
 * Simple place card for selection mode (onboarding)
 * Shows place name, category icon, and selection checkmark
 */
export function PlaceCardSelection({
  placeId,
  name,
  category,
  categoryIcon,
  isSelected,
  onToggle,
}: PlaceCardSelectionProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.placeItem,
        {
          backgroundColor: isSelected ? `${colors.accent}26` : colors.surface,
          borderColor: isSelected ? colors.accent : colors.border,
          borderWidth: isSelected ? 2 : 1,
        },
        pressed && styles.placeItemPressed,
      ]}
    >
      <View style={styles.placeInfo}>
        {categoryIcon && (
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: colors.background },
            ]}
          >
            {categoryIcon}
          </View>
        )}
        <View style={styles.textContainer}>
          <ThemedText style={styles.placeName}>{name}</ThemedText>
          {category && (
            <ThemedText
              style={[styles.categoryText, { color: colors.textSecondary }]}
            >
              {category}
            </ThemedText>
          )}
        </View>
      </View>

      {isSelected && (
        <Animated.View
          entering={FadeIn}
          style={[styles.checkmark, { backgroundColor: colors.accent }]}
        >
          <ThemedText style={styles.checkmarkText}>✓</ThemedText>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  placeItem: {
    padding: spacing.md,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeItemPressed: {
    opacity: 0.7,
  },
  placeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  placeName: {
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 15,
    color: "#FFFFFF",
  },
  categoryText: {
    fontFamily: "Poppins",
    fontWeight: "400",
    fontSize: 13,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
