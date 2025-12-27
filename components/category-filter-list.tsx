import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { PlaceCategory } from "@/modules/places/types";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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

          {categories.map((category) => (
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

function FilterChip({
  label,
  isSelected,
  onPress,
  colors,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected ? colors.text : colors.surface,
          borderColor: isSelected ? colors.text : colors.border,
        },
      ]}
    >
      <ThemedText
        variant="caption"
        style={{
          color: isSelected ? colors.background : colors.text,
          fontWeight: isSelected ? "600" : "400",
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
