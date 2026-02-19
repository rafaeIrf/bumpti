import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface PlaceLoadingSkeletonProps {
  readonly count?: number;
}

function ShimmerBlock({
  width,
  height,
  borderRadius = 4,
  shimmerProgress,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  shimmerProgress: Animated.SharedValue<number>;
}) {
  const colors = useThemeColors();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmerProgress.value, [0, 0.5, 1], [0.25, 0.5, 0.25]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.border,
        },
        animatedStyle,
      ]}
    />
  );
}

function SkeletonCard({ index }: { index: number }) {
  const colors = useThemeColors();
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withDelay(
      index * 100,
      withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [shimmerProgress, index]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Header: title + arrow placeholder */}
        <View style={styles.headerRow}>
          <ShimmerBlock
            width="58%"
            height={17}
            borderRadius={4}
            shimmerProgress={shimmerProgress}
          />
          <ShimmerBlock
            width={14}
            height={14}
            borderRadius={3}
            shimmerProgress={shimmerProgress}
          />
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <ShimmerBlock
            width={56}
            height={13}
            borderRadius={3}
            shimmerProgress={shimmerProgress}
          />
          <View style={styles.dot} />
          <ShimmerBlock
            width={68}
            height={13}
            borderRadius={3}
            shimmerProgress={shimmerProgress}
          />
          <View style={styles.dot} />
          <ShimmerBlock
            width={36}
            height={13}
            borderRadius={3}
            shimmerProgress={shimmerProgress}
          />
        </View>

        {/* Footer: chip */}
        <View style={styles.footerRow}>
          <ShimmerBlock
            width={110}
            height={28}
            borderRadius={14}
            shimmerProgress={shimmerProgress}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * PlaceLoadingSkeleton — Skeleton loader matching PlaceCard layout.
 *
 * Renders shimmering placeholder cards with staggered animations
 * while place data is loading.
 */
export function PlaceLoadingSkeleton({ count = 6 }: PlaceLoadingSkeletonProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={`skeleton-${i}`} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderRadius: spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 8,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(139,152,165,0.3)",
    marginHorizontal: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
});
