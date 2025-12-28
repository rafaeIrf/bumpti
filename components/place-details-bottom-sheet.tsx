import {
  HeartIcon,
  MapPinIcon,
  NavigationIcon,
  StarIcon,
  XIcon,
} from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useOptimisticFavorite } from "@/hooks/use-optimistic-favorite";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { PlaceReview } from "@/modules/places/types";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PlaceDetailsBottomSheetProps {
  placeName: string;
  category: string;
  address: string;
  distance: string; // e.g., "1.2 km de você"
  review?: PlaceReview;
  isFavorite?: boolean;
  placeId: string;
  onNavigate?: () => void;
  onToggleFavorite?: (
    placeId: string,
    options?: {
      optimisticOnly?: boolean;
      sync?: boolean;
      value?: boolean;
    }
  ) => void;
  onClose?: () => void;
  onRate?: () => void;
}

export function PlaceDetailsBottomSheet({
  placeName,
  category,
  address,
  distance,
  review,
  placeId,
  isFavorite = false,
  onNavigate,
  onToggleFavorite,
  onClose,
  onRate,
}: PlaceDetailsBottomSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const { isFavorite: localFavorite, handleToggle: handleFavorite } =
    useOptimisticFavorite({
      initialIsFavorite: isFavorite,
      placeId,
      onToggleFavorite,
    });

  const formattedRating = review?.average
    ? review.average.toFixed(1)
    : undefined;
  const ratingCount = review?.count || 0;

  const vibeTagsDisplay = useMemo(() => {
    if (review?.tags && review.tags.length > 0) return review.tags;
    return [];
  }, [review]);

  const hasRating = review?.average !== undefined && review.average > 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      {/* Drag Handle Area is usually handled by the BottomSheet wrapper, but we add padding */}
      <View style={styles.content}>
        {/* Header Section */}
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <ThemedText
              style={[typography.heading, { color: colors.text }]}
              numberOfLines={2}
            >
              {placeName}
            </ThemedText>
            <ThemedText
              style={[typography.body, { color: colors.textSecondary }]}
            >
              {category}
            </ThemedText>
          </View>
          <Button
            variant="ghost"
            size="icon"
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={8}
          >
            <XIcon width={24} height={24} color={colors.text} />
          </Button>
        </View>

        {/* Address & Distance */}
        <View style={styles.locationInfo}>
          <ThemedText
            style={[typography.body, { color: colors.text }]}
            numberOfLines={1}
          >
            {address}
          </ThemedText>
          <View style={styles.distanceBadge}>
            <MapPinIcon width={12} height={12} color={colors.accent} />
            <ThemedText style={[typography.caption, { color: colors.accent }]}>
              {distance}
            </ThemedText>
          </View>
        </View>

        {/* Actions Row */}
        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <Button
            variant="default"
            size="default"
            fullWidth
            style={[styles.navigateButton, { backgroundColor: colors.accent }]}
            leftIcon={<NavigationIcon width={20} height={20} color="#FFFFFF" />}
            label={t("actions.navigate")}
            onPress={onNavigate}
          />

          <Button
            variant="outline"
            size="icon"
            style={[
              styles.favoriteButton,
              {
                borderColor: colors.border,
                backgroundColor: "transparent",
              },
            ]}
            onPress={handleFavorite}
          >
            <HeartIcon
              width={22}
              height={22}
              color={localFavorite ? "#FF4D67" : colors.text}
              fill={localFavorite ? "#FF4D67" : "none"}
            />
          </Button>
        </View>

        {/* Rate Button */}
        <Button
          variant="outline"
          size="default"
          fullWidth
          label={t("actions.rate")}
          leftIcon={<StarIcon width={16} height={16} color={colors.text} />}
          onPress={onRate}
          style={{ borderColor: colors.border }}
        />

        {/* Rating Section */}
        <View
          style={[styles.sectionBlock, { backgroundColor: colors.background }]}
        >
          {hasRating ? (
            <View style={styles.ratingContent}>
              <View style={styles.ratingScore}>
                <StarIcon
                  width={20}
                  height={20}
                  color={colors.accent}
                  fill={colors.accent}
                />
                <ThemedText
                  style={[typography.subheading, { color: colors.text }]}
                >
                  {formattedRating}
                </ThemedText>
              </View>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {t("place.reviews.count", { count: ratingCount })}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.ratingContent}>
              <View style={styles.ratingScore}>
                <StarIcon width={20} height={20} color={colors.accent} />
                <ThemedText
                  style={[typography.subheading, { color: colors.text }]}
                >
                  {t("place.new")}
                </ThemedText>
              </View>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {t("place.beFirst")}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Vibe Tags Section */}
        <View style={styles.vibeContainer}>
          {vibeTagsDisplay.length > 0 ? (
            <View style={styles.tagsRow}>
              {vibeTagsDisplay.map((tag, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  label={t(`place.vibes.${tag}`)}
                  onPress={() => {}} // No-op for now, acts as a chip
                />
              ))}
            </View>
          ) : (
            <View style={styles.tagsRow}>
              <Button
                variant="outline"
                size="sm"
                label={t("place.vibeDiscovery")}
                disabled
                style={{ borderColor: colors.border, opacity: 0.7 }}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  titleContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  closeButton: {
    marginTop: -4,
    marginRight: -4,
  },
  locationInfo: {
    gap: spacing.xs,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  navigateButton: {
    flex: 1,
    height: 52,
    borderRadius: 999,
  },
  navigateButtonText: {
    ...typography.body,
    fontWeight: "600",
  },
  favoriteButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBlock: {
    borderRadius: 16,
    padding: spacing.md,
  },
  ratingContent: {
    gap: spacing.xs,
  },
  ratingScore: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  vibeContainer: {
    marginTop: spacing.xs,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  vibeChip: {
    // legacy style, can be removed or kept if needed by other components, but for this file it is unused now.
    // keeping empty or removing.
    // removing to clean up
  },
});
