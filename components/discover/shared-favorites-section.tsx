import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { SharedFavoriteUser } from "@/modules/discover/types";
import { t } from "@/modules/locales";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

const CARD_WIDTH = 140;
const CARD_SPACING = spacing.sm;
const AVATAR_SIZE = 80;

type SharedFavoritesSectionProps = {
  users: SharedFavoriteUser[];
  onPress?: (user: SharedFavoriteUser) => void;
  onLike?: (user: SharedFavoriteUser) => void;
  onSkip?: (user: SharedFavoriteUser) => void;
  pendingDismissIds?: Set<string>;
  onDismissComplete?: (userId: string) => void;
};

export default function SharedFavoritesSection({
  users,
  onPress,
}: SharedFavoritesSectionProps) {
  const colors = useThemeColors();
  const snapInterval = CARD_WIDTH + CARD_SPACING;

  if (users.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.headerContainer}>
        <Text style={[typography.subheading, { color: colors.text }]}>
          {t("screens.discover.sharedFavorites.title")}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginTop: 2 },
          ]}
        >
          {t("screens.discover.sharedFavorites.subtitle")}
        </Text>
      </View>

      {/* Horizontal carousel */}
      <Animated.FlatList
        data={users}
        keyExtractor={(item) => item.other_user_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        itemLayoutAnimation={LinearTransition.duration(300)}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPress?.(item)}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Avatar */}
            {item.other_photos.length > 0 ? (
              <Image
                source={{ uri: item.other_photos[0] }}
                style={[
                  styles.avatar,
                  { backgroundColor: `${colors.textSecondary}20` },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: `${colors.textSecondary}20` },
                ]}
              >
                <Text
                  style={[typography.heading, { color: colors.textSecondary }]}
                >
                  {item.other_name?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
            )}

            {/* Name */}
            <Text
              style={[
                typography.body,
                { color: colors.text, marginTop: spacing.xs },
              ]}
              numberOfLines={1}
            >
              {item.other_name ?? ""}
              {item.other_age ? `, ${item.other_age}` : ""}
            </Text>

            {/* Shared count */}
            <Text
              style={[
                typography.caption,
                { color: colors.accent, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {t("screens.discover.sharedFavorites.count", {
                count: item.shared_count,
              })}
            </Text>
          </TouchableOpacity>
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
  listContent: {
    gap: CARD_SPACING,
  },
  card: {
    width: CARD_WIDTH,
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
