import EncounterCard, {
  CARD_SPACING,
  LARGE_CARD_WIDTH,
  MEDIUM_CARD_WIDTH,
} from "@/components/discover/encounter-card";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { DiscoverEncounter } from "@/modules/discover/types";
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

type DiscoverSectionProps = {
  title: string;
  subtitle?: string;
  encounters: DiscoverEncounter[];
  variant: "large" | "medium";
};

export default function DiscoverSection({
  title,
  subtitle,
  encounters,
  variant,
}: DiscoverSectionProps) {
  const colors = useThemeColors();
  const cardWidth = variant === "large" ? LARGE_CARD_WIDTH : MEDIUM_CARD_WIDTH;
  const snapInterval = cardWidth + CARD_SPACING;

  if (encounters.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.headerContainer}>
        <Text style={[typography.subheading, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Horizontal carousel */}
      <FlatList
        data={encounters}
        keyExtractor={(item) => item.other_user_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <EncounterCard encounter={item} variant={variant} index={index} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  headerContainer: {
    marginBottom: spacing.sm,
  },
  listContent: {},
});
