import { MapPinIcon, UsersIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { formatDistance } from "@/utils/distance";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export interface PlaceCardIconData {
  id: string;
  name: string;
  category: string;
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
          style={[styles.iconCircle, { backgroundColor: colors.accent + "20" }]}
        >
          <MapPinIcon width={18} height={18} color={colors.accent} />
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
          {[place.category, place.neighborhood].filter(Boolean).join(" · ")}
        </ThemedText>
        {hasActiveUsers && (
          <View style={styles.activePeopleRow}>
            <UsersIcon width={12} height={12} color={colors.accent} />
            <ThemedText
              style={[
                typography.caption,
                { color: colors.accent, fontSize: 11 },
              ]}
            >
              {t(
                place.activeUsers === 1
                  ? "place.onePersonConnecting"
                  : "place.manyPeopleConnecting",
                { count: place.activeUsers },
              )}
            </ThemedText>
          </View>
        )}
      </View>
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
  activePeopleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
});
