/**
 * DiscoverLoadingSkeleton
 * Uses the MaskedView-based Shimmer wrapper — gradient is clipped to each
 * shape exactly, so no shimmer bleeds outside cards or bars.
 */
import Shimmer from "@/components/shimmer";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function SkeletonSection({
  cardSize,
  cardCount,
}: {
  cardSize: "large" | "medium";
  cardCount: number;
}) {
  const colors = useThemeColors();
  const cardWidth =
    cardSize === "large" ? SCREEN_WIDTH * 0.72 : SCREEN_WIDTH * 0.52;
  const cardHeight = cardWidth * (4 / 3);

  return (
    <View style={styles.section}>
      {/* Title bar */}
      <Shimmer>
        <View
          style={{
            width: 160,
            height: 16,
            borderRadius: 4,
            backgroundColor: colors.surface,
          }}
        />
      </Shimmer>
      <View style={styles.gap4} />
      {/* Subtitle bar */}
      <Shimmer>
        <View
          style={{
            width: 220,
            height: 12,
            borderRadius: 3,
            backgroundColor: colors.surface,
          }}
        />
      </Shimmer>
      <View style={styles.gap12} />
      {/* Portrait card row */}
      <View style={styles.cards}>
        {Array.from({ length: cardCount }, (_, i) => (
          <Shimmer key={i}>
            <View
              style={{
                width: cardWidth,
                height: cardHeight,
                borderRadius: 20,
                backgroundColor: colors.surface,
              }}
            />
          </Shimmer>
        ))}
      </View>
    </View>
  );
}

export function DiscoverLoadingSkeleton() {
  return (
    <View>
      <SkeletonSection cardSize="large" cardCount={2} />
      <SkeletonSection cardSize="medium" cardCount={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  gap4: { height: 4 },
  gap12: { height: 12 },
  cards: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
