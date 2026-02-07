import EncounterCard, {
  CARD_SPACING,
  LARGE_CARD_WIDTH,
  MEDIUM_CARD_WIDTH,
} from "@/components/discover/encounter-card";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { DiscoverEncounter } from "@/modules/discover/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

type DiscoverSectionProps = {
  title: string;
  subtitle?: string;
  encounters: DiscoverEncounter[];
  variant: "large" | "medium";
  onLike?: (encounter: DiscoverEncounter) => void;
  onSkip?: (encounter: DiscoverEncounter) => void;
  pendingDismissIds?: Set<string>;
  onDismissComplete?: (userId: string) => void;
};

export default function DiscoverSection({
  title,
  subtitle,
  encounters,
  variant,
  onLike,
  onSkip,
  pendingDismissIds,
  onDismissComplete,
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
      <Animated.FlatList
        data={encounters}
        keyExtractor={(item) => item.other_user_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        itemLayoutAnimation={LinearTransition.duration(300)}
        renderItem={({ item, index }) => (
          <EncounterCard
            encounter={item}
            variant={variant}
            index={index}
            onLike={onLike}
            onSkip={onSkip}
            pendingDismiss={pendingDismissIds?.has(item.other_user_id)}
            onDismissComplete={onDismissComplete}
          />
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
