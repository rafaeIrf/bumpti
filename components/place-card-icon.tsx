import { ArrowRightIcon, UsersIcon } from "@/assets/icons";
import { getCategoryColor, getPlaceIcon } from "@/components/place-card-utils";
import { ThemedText } from "@/components/themed-text";
import { Chip } from "@/components/ui/chip";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { formatDistance } from "@/utils/distance";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export interface PlaceCardIconData {
  id: string;
  name: string;
  category: string; // display label
  tag?: string; // raw internal key (e.g. "bar", "cafe") used for icon lookup
  address: string;
  neighborhood?: string;
  distance: number;
  activeUsers: number;
}

interface PlaceCardIconProps {
  place: PlaceCardIconData;
  onPress: () => void;
}

export default function PlaceCardIcon({ place, onPress }: PlaceCardIconProps) {
  const colors = useThemeColors();
  const hasActiveUsers = place.activeUsers > 0;
  const categoryColor = getCategoryColor(place.tag ?? "default");
  const CategoryIcon = getPlaceIcon(place.tag ?? "default");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.iconCol}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: `${categoryColor}`,
            },
          ]}
        >
          <CategoryIcon width={18} height={18} color="#FFFFFF" />
        </View>
        <ThemedText
          style={[
            typography.caption,
            { color: colors.textSecondary, fontSize: 10 },
          ]}
        >
          {formatDistance(place.distance)}
        </ThemedText>
      </View>

      <View style={styles.textCol}>
        <ThemedText
          style={[typography.body1, { color: colors.text }]}
          numberOfLines={1}
        >
          {place.name}
        </ThemedText>
        <ThemedText
          style={[typography.caption, { color: colors.textSecondary }]}
        >
          {[place.neighborhood].filter(Boolean).join(" · ")}
        </ThemedText>
      </View>

      {/* People badge */}
      {hasActiveUsers && (
        <Chip
          label={String(place.activeUsers)}
          icon={<UsersIcon width={12} height={12} color={colors.accent} />}
          variant="filled"
          size="sm"
        />
      )}
      <ArrowRightIcon color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconCol: {
    alignItems: "center",
    gap: 4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
  },
});
