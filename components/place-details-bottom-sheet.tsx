import {
  HeartIcon,
  MapPinIcon,
  NavigationIcon,
  StarIcon,
  UsersIcon,
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
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionButton } from "./ui/action-button";
import { BrandIcon } from "./ui/brand-icon";
import { RatingBadge } from "./ui/rating-badge";

interface PlaceDetailsBottomSheetProps {
  placeName: string;
  category: string;
  address: string;
  neighborhood?: string; // NEW: Bairro name
  distance: string; // e.g., "1.2 km de você"
  review?: PlaceReview;
  isFavorite?: boolean;
  placeId: string;
  activeUsers?: number;
  onNavigate?: () => void;
  onToggleFavorite?: (
    placeId: string,
    options?: {
      optimisticOnly?: boolean;
      sync?: boolean;
      value?: boolean;
    },
  ) => void;
  onClose?: () => void;
  onRate?: () => void;
  onConnect?: () => void;
  onReport?: () => void;
  isLoading?: boolean;
}

export function PlaceDetailsBottomSheet({
  placeName,
  category,
  address,
  neighborhood,
  distance,
  review,
  placeId,
  activeUsers = 0,
  isFavorite = false,
  onNavigate,
  onToggleFavorite,
  onClose,
  onRate,
  onConnect,
  onReport,
  isLoading = false,
}: PlaceDetailsBottomSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const { isFavorite: localFavorite, handleToggle: handleFavorite } =
    useOptimisticFavorite({
      initialIsFavorite: isFavorite,
      placeId,
      onToggleFavorite,
    });

  const ratingCount = review?.count || 0;

  const formattedRating = review?.average
    ? review.average.toFixed(1)
    : undefined;

  const vibeTagsDisplay = useMemo(() => {
    if (!review?.tags || review.tags.length === 0) return [];

    // Sort tags by the length of their translated text (shortest to longest)
    return [...review.tags].sort((a, b) => {
      const textA = t(`place.vibes.${a}`);
      const textB = t(`place.vibes.${b}`);
      return textA.length - textB.length;
    });
  }, [review]);

  const hasRating = review?.average !== undefined && review.average > 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Pressable
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      >
        <XIcon width={24} height={24} color={colors.textSecondary} />
      </Pressable>

      <View style={styles.content}>
        {/* Brand Icon Header - Simplified & Floating */}
        <View style={styles.iconWrapper}>
          <BrandIcon icon={MapPinIcon} size="lg" color={colors.accent} />
        </View>

        {/* Identity Section - Tight & Focused */}
        <View style={styles.identitySection}>
          <ThemedText
            style={[
              typography.subheading2,
              {
                textAlign: "center",
                marginBottom: spacing.sm,
                paddingHorizontal: spacing.xxl,
              },
            ]}
            numberOfLines={2}
          >
            {placeName.toUpperCase()}
          </ThemedText>

          <View style={styles.metaRow}>
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {category}
            </ThemedText>
            <View style={[styles.dot, { backgroundColor: colors.border }]} />
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {distance}
            </ThemedText>

            {hasRating && (
              <>
                <View
                  style={[styles.dot, { backgroundColor: colors.border }]}
                />
                <View style={styles.ratingSummary}>
                  <RatingBadge rating={review.average!} variant="minimal" />
                  <ThemedText
                    style={[
                      typography.caption,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {`(${ratingCount})`}
                  </ThemedText>
                </View>
              </>
            )}
          </View>

          {/* Address with neighborhood */}
          <View style={styles.addressRow}>
            <ThemedText
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                },
              ]}
              numberOfLines={2}
            >
              {address}
            </ThemedText>
            {neighborhood && (
              <>
                <View
                  style={[styles.dot, { backgroundColor: colors.border }]}
                />
                <ThemedText
                  style={[
                    typography.caption,
                    {
                      color: colors.textSecondary,
                      textAlign: "center",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {neighborhood}
                </ThemedText>
              </>
            )}
          </View>
        </View>

        {/* Community & Insights Section (Moved Up & Redesigned) */}
        {(hasRating || activeUsers > 0 || vibeTagsDisplay.length > 0) && (
          <View style={styles.communitySection}>
            {/* Vibe Cloud - Centered & Premium */}
            {vibeTagsDisplay.length > 0 && (
              <View style={styles.vibeCloud}>
                {vibeTagsDisplay.slice(0, 5).map((tag, index) => (
                  <View
                    key={index}
                    style={[
                      styles.vibeTag,
                      {
                        backgroundColor: colors.surfaceHover,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[styles.vibeText, { color: colors.text }]}
                    >
                      {t(`place.vibes.${tag}`)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            {/* Social Proof Row: Active Users Only */}
            {activeUsers > 0 && (
              <View
                style={[
                  styles.socialProofRow,
                  { flexDirection: "row", justifyContent: "center" },
                ]}
              >
                <View style={styles.socialBadge}>
                  <UsersIcon width={12} height={12} color={colors.accent} />
                  <ThemedText
                    style={[styles.socialText, { color: colors.accent }]}
                  >
                    {activeUsers === 1
                      ? t("place.onePersonConnecting")
                      : t("place.manyPeopleConnecting", { count: activeUsers })}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Actions Section - Command Center Layout */}
        <View>
          <Button
            variant="default"
            size="lg"
            fullWidth
            label={t("venue.connection.active.button")}
            onPress={onConnect || (() => {})}
            loading={isLoading}
            disabled={isLoading}
          />

          <View style={styles.secondaryRow}>
            <View style={styles.fabItem}>
              <ActionButton
                ariaLabel={t("actions.navigate")}
                size={48}
                iconSize={22}
                variant="default"
                onPress={onNavigate || (() => {})}
                icon={(props) => <NavigationIcon {...props} />}
                color={colors.text}
              />
              <ThemedText
                style={[styles.fabLabel, { color: colors.textSecondary }]}
              >
                {t("actions.navigate")}
              </ThemedText>
            </View>

            <View style={styles.fabItem}>
              <ActionButton
                ariaLabel={t("actions.rate")}
                size={48}
                iconSize={22}
                variant="default"
                onPress={onRate || (() => {})}
                icon={(props) => <StarIcon {...props} />}
                color={colors.text}
              />
              <ThemedText
                style={[styles.fabLabel, { color: colors.textSecondary }]}
              >
                {t("actions.rate")}
              </ThemedText>
            </View>

            <View style={styles.fabItem}>
              <ActionButton
                ariaLabel={
                  localFavorite ? "Remove from favorites" : "Add to favorites"
                }
                size={48}
                iconSize={22}
                variant={localFavorite ? "accent" : "default"}
                onPress={handleFavorite}
                icon={(props) => (
                  <HeartIcon
                    {...props}
                    fill={localFavorite ? colors.accent : "none"}
                  />
                )}
                color={localFavorite ? colors.accent : colors.text}
              />
              <ThemedText
                style={[styles.fabLabel, { color: colors.textSecondary }]}
              >
                {localFavorite ? t("actions.saved") : t("actions.favorite")}
              </ThemedText>
            </View>
          </View>

          {/* Report button - ghost style at the end */}
          <Button
            variant="ghost"
            size="default"
            textStyle={{ color: colors.textSecondary }}
            label={t("bottomSheets.placeReport.reportButton")}
            onPress={onReport || (() => {})}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    paddingTop: spacing.md,
    position: "relative",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.sm,
    opacity: 0.5,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  iconWrapper: {
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  identitySection: {
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: spacing.sm,
  },
  closeButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  fabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: spacing.xs,
  },
  fabLabel: {
    ...typography.caption,
    textAlign: "center",
  },
  communitySection: {
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  vibeCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  vibeTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  vibeText: {
    ...typography.captionBold,
    fontSize: 12,
  },
  socialProofRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  socialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  socialText: {
    ...typography.caption,
    fontSize: 13,
  },
  ratingSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
});
