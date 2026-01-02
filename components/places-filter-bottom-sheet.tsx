import { StarIcon, XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export type SortOption = "relevance" | "distance" | "popularity" | "rating";

interface PlacesFilterBottomSheetProps {
  readonly initialSortBy?: SortOption;
  readonly initialMinRating?: number | null;
  readonly onApply: (sortBy: SortOption, minRating: number | null) => void;
  readonly onClose: () => void;
}

const SORT_OPTIONS: { value: SortOption; labelKey: string }[] = [
  { value: "relevance", labelKey: "filters.sortBy.relevance" },
  { value: "distance", labelKey: "filters.sortBy.distance" },
  { value: "popularity", labelKey: "filters.sortBy.popularity" },
  { value: "rating", labelKey: "filters.sortBy.rating" },
];

const RATING_OPTIONS = [1, 2, 3, 4, 5];

export function PlacesFilterBottomSheet({
  initialSortBy = "relevance",
  initialMinRating = null,
  onApply,
  onClose,
}: PlacesFilterBottomSheetProps) {
  const colors = useThemeColors();

  // Internal state for filters
  const [sortBy, setSortBy] = useState<SortOption>(initialSortBy);
  const [minRating, setMinRating] = useState<number | null>(initialMinRating);

  const handleClear = () => {
    setSortBy("relevance");
    setMinRating(null);
  };

  const handleApply = () => {
    onApply(sortBy, minRating);
  };

  const hasActiveFilters = sortBy !== "relevance" || minRating !== null;

  return (
    <View style={styles.container}>
      <View style={styles.dragIndicatorWrapper}>
        <View
          style={[styles.dragIndicator, { backgroundColor: colors.border }]}
        />
      </View>

      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        style={styles.closeButton}
      >
        <XIcon width={24} height={24} color={colors.textSecondary} />
      </Pressable>

      <ThemedText style={[styles.title, { color: colors.text }]}>
        {t("filters.title")}
      </ThemedText>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: colors.textSecondary }]}
        >
          {t("filters.sortBy.title")}
        </ThemedText>

        <View style={styles.chipsContainer}>
          {SORT_OPTIONS.map((option) => {
            const isSelected = sortBy === option.value;
            return (
              <Button
                key={option.value}
                onPress={() => setSortBy(option.value)}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                label={t(option.labelKey)}
                style={[
                  styles.sortChipButton,
                  !isSelected && {
                    backgroundColor: colors.surfaceHover,
                    borderColor: colors.border,
                  },
                ]}
                textStyle={
                  isSelected
                    ? undefined
                    : {
                        color: colors.text,
                      }
                }
              />
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: colors.textSecondary }]}
        >
          {t("filters.minRating.title")}
        </ThemedText>

        <View style={styles.ratingChipsContainer}>
          {RATING_OPTIONS.map((rating) => {
            const isSelected = minRating === rating;
            return (
              <Button
                key={rating}
                onPress={() => setMinRating(isSelected ? null : rating)}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                leftIcon={
                  <StarIcon
                    color={isSelected ? colors.white : colors.accent}
                    stroke={isSelected ? colors.white : colors.accent}
                    fill={"none"}
                  />
                }
                label={`${rating}`}
                style={[
                  styles.ratingChipButton,
                  !isSelected && {
                    backgroundColor: colors.surfaceHover,
                    borderColor: colors.border,
                  },
                ]}
                textStyle={
                  isSelected
                    ? undefined
                    : {
                        color: colors.text,
                      }
                }
              />
            );
          })}
        </View>
      </View>

      <View style={[styles.applyContainer, { borderTopColor: colors.border }]}>
        <Button
          onPress={handleApply}
          variant="default"
          size="lg"
          fullWidth
          label={t("filters.apply")}
        />
        <Button
          onPress={handleClear}
          variant="ghost"
          size="lg"
          fullWidth
          disabled={!hasActiveFilters}
          label={t("filters.clear")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  dragIndicatorWrapper: {
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
  dragIndicator: {
    width: spacing.xxl,
    height: spacing.xs,
    borderRadius: spacing.xs,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.lg,
    width: spacing.xl,
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.subheading,
    textAlign: "center",
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    textTransform: "uppercase",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sortChipButton: {
    flexGrow: 1,
    flexBasis: "48%",
  },
  ratingChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  ratingChipButton: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: "18%",
    minWidth: spacing.xxl,
  },
  applyContainer: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
});
