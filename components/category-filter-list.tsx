import Button from "@/components/ui/button";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { PlaceCategory } from "@/modules/places/types";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

interface CategoryFilterListProps {
  categories: PlaceCategory[];
  selectedCategory: PlaceCategory | "all";
  onSelect: (category: PlaceCategory | "all") => void;
}

export function CategoryFilterList({
  categories,
  selectedCategory,
  onSelect,
}: CategoryFilterListProps) {
  const colors = useThemeColors();
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const textA = t(`common.placeCategories.${a}`);
      const textB = t(`common.placeCategories.${b}`);
      return textA.length - textB.length;
    });
  }, [categories]);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.row}>
          <FilterChip
            label={t("common.all")}
            isSelected={selectedCategory === "all"}
            onPress={() => onSelect("all")}
            colors={colors}
          />

          {sortedCategories.map((category) => (
            <FilterChip
              key={category}
              label={t(`common.placeCategories.${category}`)}
              isSelected={selectedCategory === category}
              onPress={() => onSelect(category)}
              colors={colors}
            />
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

export interface FilterChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
  style?: import("react-native").ViewStyle;
}

export function FilterChip({
  label,
  isSelected,
  onPress,
  colors,
  style,
}: FilterChipProps) {
  return (
    <Button
      onPress={onPress}
      variant={isSelected ? "default" : "outline"}
      size="sm"
      label={label}
      style={[
        styles.chip,
        !isSelected && {
          backgroundColor: colors.surfaceHover,
          borderColor: colors.border,
        },
        style,
      ]}
      textStyle={!isSelected ? { color: colors.text } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    minWidth: 60,
  },
});
