import { ThemedView } from "@/components/themed-view";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { StyleSheet, View } from "react-native";

interface PlaceLoadingSkeletonProps {
  readonly count?: number;
}

/**
 * PlaceLoadingSkeleton - Skeleton loader para lista de lugares
 *
 * Exibe placeholders animados enquanto os dados estão carregando.
 * Usado em telas de listagem de lugares (categoria, busca, etc).
 */
export function PlaceLoadingSkeleton({ count = 6 }: PlaceLoadingSkeletonProps) {
  const colors = useThemeColors();

  const skeletonItems = React.useMemo(
    () => Array.from({ length: count }, (_, i) => ({ id: `skeleton-${i}` })),
    [count]
  );

  return (
    <ThemedView style={styles.container}>
      {skeletonItems.map((item) => (
        <ThemedView
          key={item.id}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.content}>
            <View style={[styles.image, { backgroundColor: colors.border }]} />
            <View style={styles.textContainer}>
              <View
                style={[
                  styles.line,
                  styles.lineTitle,
                  { backgroundColor: colors.border },
                ]}
              />
              <View
                style={[
                  styles.line,
                  styles.lineSubtitle,
                  { backgroundColor: colors.border },
                ]}
              />
              <View
                style={[
                  styles.line,
                  styles.lineSmall,
                  { backgroundColor: colors.border },
                ]}
              />
            </View>
          </View>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  textContainer: {
    flex: 1,
    gap: spacing.sm,
  },
  line: {
    height: 16,
    borderRadius: 4,
  },
  lineTitle: {
    width: "66%",
    height: 20,
  },
  lineSubtitle: {
    width: "50%",
  },
  lineSmall: {
    width: "33%",
  },
});
